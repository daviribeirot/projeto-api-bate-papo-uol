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
        const userExists = await db.collection("participants").findOne({name: user.name})
      
        if(userExists) return res.status(409).send("Esse usuário já está cadastrado!")

        const userData = await db.collection("participants").insertOne({name: user.name, lastStatus: Date.now()})
        console.log(userData)

        await db.collection("messages").insertOne({
            from: user.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(Date.now()).format('HH:MM:SS')
        })

        res.sendStatus(201);
      }

      catch(error) {
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
        type: joi.string().valid('message','private_message').required()
    })

    const validation = messageSchema.validate(messages, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
      }
    
    try {
        const { user } = req.headers;
        console.log(user)
        const userExists = await db.collection("participants").findOne({name: user});
      
        if(!userExists) return res.status(422).send("Esse usuário não existe na lista de participantes!");

        const sendedMessage = await db.collection("messages").insertOne({
            from: user,
            ...messages,
            time: dayjs(Date.now()).format('HH:MM:SS')
        })

        if (sendedMessage) return res.sendStatus(201)
    }

    catch(error){
        console.log(error)
        return res.sendStatus(500)
    }
    
})




server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))