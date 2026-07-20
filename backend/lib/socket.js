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

    // If user already has a socket (reconnect/duplicate), disconnect the OLD one
    if (userSocketMap[userId]) {
        const oldSocketId = userSocketMap[userId];
        console.log(`User ${userId} already has an active socket (${oldSocketId}), closing it`);
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
            oldSocket.disconnect(true); // true = server-side disconnect
        }
    }
    
    // Add the new socket
    userSocketMap[userId] = socket.id;
    console.log("User added to online map. Current online users:", Object.keys(userSocketMap));

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

        // Only remove if this socket is the current one for this user
        if (userId && userSocketMap[userId] === socket.id) {
            delete userSocketMap[userId];
            console.log("User removed from online map. Current online users:", Object.keys(userSocketMap));
            
            // Notify all clients about updated online users
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        } else if (userId) {
            console.log(`Disconnect event for old socket of user ${userId} (socket ID mismatch) - ignoring`);
        }
    });
});

export { app, server, io };
