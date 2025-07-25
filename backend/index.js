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
app.use(cors({
  origin:"http://localhost:5173",
  credentials:true
}))
const __dirname = path.resolve();
app.use('/api/auth',authRoutes)
app.use('/api/messages',messageRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
});
}


const PORT =process.env.PORT
server.listen(PORT,()=>{
    console.log("server running on port 5001")
    connectDB();
})
