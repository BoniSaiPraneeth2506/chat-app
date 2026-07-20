import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    try {
        const hostname = new URL(origin).hostname;
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith("onrender.com");
    } catch {
        return false;
    }
};

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'), false);
            }
        },
        credentials: true
    },
    transports: ["websocket"]
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

    // Store the new socket (silently replace old one if exists)
    const oldSocketId = userSocketMap[userId];
    if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
            oldSocket.disconnect();
        }
    }
    userSocketMap[userId] = socket.id;
    
    if (oldSocketId) {
        console.log(`User ${userId} reconnected. Old socket: ${oldSocketId}, New socket: ${socket.id}`);
    } else {
        console.log(`User ${userId} connected for first time. Current online users:`, Object.keys(userSocketMap));
    }

    // Notify all clients about online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("markAsRead", ({ senderId, receiverId }) => {
        console.log(`[Socket Server] User ${receiverId} read messages from User ${senderId}`);
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagesRead", { userId: receiverId });
            console.log(`[Socket Server] Forwarded read receipt to sender: ${senderId}`);
        } else {
            console.log(`[Socket Server] Sender ${senderId} is currently offline.`);
        }
    });

    socket.on("disconnect", () => {
        console.log("A user Disconnected:", socket.id, "UserID:", userId);

        // Only remove if THIS socket is currently mapped for this user
        if (userId && userSocketMap[userId] === socket.id) {
            delete userSocketMap[userId];
            console.log("User removed from online map. Current online users:", Object.keys(userSocketMap));
            
            // Notify all clients about updated online users
            io.emit("getOnlineUsers", Object.keys(userSocketMap));
        } else if (userId) {
            console.log(`Ignoring disconnect for old socket of user ${userId}`);
        }
    });
});

export { app, server, io };
