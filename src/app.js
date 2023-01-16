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

mongoClient.connect()
.then(() => {
    db = mongoClient.db()
    console.log("Conectou!!!")
})
.catch(() => {
    console.log("Deu ruim no banco de dados")
})

const server = express();

server.use(json());
server.use(cors())


server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))