import dotenv from 'dotenv'
dotenv.config();
import express from 'express'

import authRoutes from './routes/auth.route.js'
import messageRoutes from './routes/message.route.js'
import connectDB from './lib/db.js';
import path from "path";
import cookieParser from 'cookie-parser';
import cors from 'cors'
import { app, server } from './lib/socket.js';


// app.use(express.json())
app.use(cookieParser())
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://chat-app-frontend-lvqd.onrender.com"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}))
const __dirname = path.resolve();
app.use('/api/auth',authRoutes)
app.use('/api/messages',messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.get('/',(req,res)=>{
    res.send("api is working")
})
const PORT =process.env.PORT
server.listen(PORT,()=>{
    console.log("server running on port 5001")
    connectDB();
})