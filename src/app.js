import express, { json } from "express";
import cors from "cors";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";

dotenv.config();
const PORT = 5000;

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
    await mongoClient.connect()
    db = mongoClient.db()
    console.log("Conectou!!!")
} catch (error) {
    console.log('Deu errro no server')
}

const server = express();

server.use(json());
server.use(cors());

server.post("/participants", async (req, res) => {
    const user = req.body;

    const userSchema = joi.object({
        name: joi.string().required(),
    });

    const validation = userSchema.validate(user, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const userExists = await db.collection("participants").findOne({ name: user.name })

        if (userExists) return res.status(409).send("Esse usuário já está cadastrado!")

        const userData = await db.collection("participants").insertOne({ name: user.name, lastStatus: Date.now() })

        await db.collection("messages").insertOne({
            from: user.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })

        res.sendStatus(201);
    }

    catch (error) {
        console.log(error);
        res.status(500).send("Deu algo errado no servidor");
    }
})

server.get("/participants", async (req, res) => {
    try {
        const users = await db.collection("participants").find().toArray()
        return res.send(users)
    } catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }
})

server.post("/messages", async (req, res) => {
    const messages = req.body;

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    })

    const validation = messageSchema.validate(messages, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const { user } = req.headers;
        const userExists = await db.collection("participants").findOne({ name: user });

        if (!userExists) return res.status(422).send("Esse usuário não existe na lista de participantes!");

        const sendedMessage = await db.collection("messages").insertOne({
            from: user,
            ...messages,
            time: dayjs().format('HH:mm:ss')
        })

        if (sendedMessage) return res.sendStatus(201)
    }

    catch (error) {
        console.log(error)
        return res.sendStatus(500)
    }

})

server.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const limit = req.query.limit;

    try {
        const message = await db.collection("messages").find({ $or: [{ "from": user }, { "to": "Todos" }, { "to": user }, { "type": "message" }] }).toArray();

        if (limit) {
            res.send(message.slice(-limit));
            return;
        }

        res.send(message.reverse());

    } catch (error) {
        res.sendStatus(500);
    }
})

server.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
        const userExists = await db.collection("participants").findOne({ name: user });

        if(!userExists) {
            return res.sendStatus(404);
        }

        await db.collection("participants").updateOne({name: user}, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200);

    } catch (error) {
        console.log(error)
        res.sendStatus(500);
    }
})

setInterval(async () => {
   
    const inactiveSeconds = Date.now() - 10 * 1000;

    try {

        const inactveUsers = await db.collection("participants").find({ lastStatus: { $lte: inactiveSeconds } }).toArray();

        if (inactveUsers.length > 0) {

            const inactiveMessage = inactveUsers.map((user) => {
                return {
                    from: user.name,
                    to: "Todos",
                    text: "sai da sala...",
                    type: "status",
                    time: dayjs().format('HH:MM:ss')
                }
            })

            await db.collection("messages").insertMany(inactiveMessage)

            await db.collection("participants").deleteMany({ lastStatus: { $lte: inactiveSeconds } })
        }

    } catch (error) {
        console.log(error);
    }
}, 1500);


server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))