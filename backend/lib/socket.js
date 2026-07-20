import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://chat-app-frontend-lvqd.onrender.com"
        ],
        credentials: true
    },
    transports: ["websocket", "polling"]
});
export function getReceiverSocketId(userId){
    return userSocketMap[userId]
}

const userSocketMap = {}; // Stores online users: { userId: socketId }

io.on("connection", (socket) => {
    console.log("A user Connected:", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // Notify all clients about online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("markAsRead", ({ senderId, receiverId }) => {
        console.log(`[Socket Server] User ${receiverId} read messages from User ${senderId}`);
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagesRead", { userId: receiverId });
            console.log(`[Socket Server] Forwarded read receipt to sender: ${senderId}`);
        } else {
            console.log(`[Socket Server] Sender ${senderId} is currently offline. Receipt buffered/ignored.`);
        }
    });

    socket.on("disconnect", () => {
        console.log("A user Disconnected:", socket.id);

        // Remove user from userSocketMap
        if (userId) delete userSocketMap[userId];

        // Notify updated online users
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { app, server, io };
