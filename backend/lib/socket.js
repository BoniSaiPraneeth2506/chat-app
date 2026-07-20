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
    const userId = socket.handshake.query.userId;
    console.log("A user Connected:", socket.id, "UserID:", userId);

    if (!userId) {
        console.log("WARNING: Connection received without userId - disconnecting");
        socket.disconnect();
        return;
    }

    // Replace old socket if user reconnects
    if (userSocketMap[userId]) {
        console.log(`User ${userId} already exists, replacing socket`);
    }
    userSocketMap[userId] = socket.id;
    console.log("Current online users:", Object.keys(userSocketMap));

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
        console.log("A user Disconnected:", socket.id, "UserID:", userId);

        // Remove user from userSocketMap
        if (userId && userSocketMap[userId] === socket.id) {
            delete userSocketMap[userId];
            console.log("User removed, current online users:", Object.keys(userSocketMap));
            
            // Notify updated online users
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        }
    });
});

export { app, server, io };
