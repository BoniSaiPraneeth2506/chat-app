import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const app = express();
const server = http.createServer(app);

const isOriginAllowed = (origin) => {
    if (process.env.NODE_ENV !== "production") return true;
    if (!origin) return true;
    const allowed = process.env.ALLOWED_ORIGIN
        ? [process.env.ALLOWED_ORIGIN, "http://localhost:5173"]
        : ["http://localhost:5173", "http://localhost:5001"];
    return allowed.includes(origin);
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
        credentials: true,
    },
    transports: ["websocket"],
    maxHttpBufferSize: 1e6, // 1 MB max per socket message
});

// ── Socket.IO JWT Auth Middleware ─────────────────────────────────────────────
io.use((socket, next) => {
    try {
        // Accept token from auth.token (preferred) or query.token (fallback)
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error("Unauthorized: No token provided"));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId; // attach verified userId to socket
        next();
    } catch (err) {
        next(new Error("Unauthorized: Invalid or expired token"));
    }
});

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

const userSocketMap = {}; // { userId: socketId }
const privateUsersSet = new Set(); // users who hide online status

const broadcastOnlineUsers = () => {
    const visibleOnlineUsers = Object.keys(userSocketMap).filter(id => !privateUsersSet.has(id));
    io.emit("getOnlineUsers", visibleOnlineUsers);
};

export function updateUserPrivacyState(userId, isPrivate) {
    if (isPrivate) {
        privateUsersSet.add(userId.toString());
    } else {
        privateUsersSet.delete(userId.toString());
    }
    broadcastOnlineUsers();
}

io.on("connection", async (socket) => {
    // userId is now always verified from JWT — not from client query
    const userId = socket.userId;
    console.log("A user Connected:", socket.id, "UserID:", userId);

    // Store the new socket (silently replace old one if exists)
    const oldSocketId = userSocketMap[userId];
    if (oldSocketId && oldSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
            oldSocket.disconnect();
        }
    }
    userSocketMap[userId] = socket.id;

    // Query onlinePrivacy setting of the connecting user
    try {
        const user = await User.findById(userId).select("onlinePrivacy");
        if (user && user.onlinePrivacy === false) {
            privateUsersSet.add(userId.toString());
        } else {
            privateUsersSet.delete(userId.toString());
        }
    } catch (err) {
        console.error("Error fetching user settings on connection:", err);
    }

    if (oldSocketId) {
        console.log(`User ${userId} reconnected. Old socket: ${oldSocketId}, New socket: ${socket.id}`);
    } else {
        console.log(`User ${userId} connected. Current online users:`, Object.keys(userSocketMap));
    }

    broadcastOnlineUsers();

    // ── Event: markAsRead ───────────────────────────────────────────────────
    socket.on("markAsRead", ({ senderId, receiverId }) => {
        // Validate: only the authenticated user can claim to be the receiver
        if (receiverId !== userId) {
            console.warn(`[Security] User ${userId} tried to spoof markAsRead as ${receiverId}`);
            return;
        }
        console.log(`[Socket] User ${receiverId} read messages from User ${senderId}`);
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messagesRead", { userId: receiverId });
        }
    });

    // ── Event: typing ───────────────────────────────────────────────────────
    socket.on("typing", ({ receiverId, isTyping }) => {
        // Use verified socket.userId as senderId — never trust client
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", { senderId: userId, isTyping });
        }
    });

    // ── Event: callUser ─────────────────────────────────────────────────────
    socket.on("callUser", ({ userToCall, signalData, from, type }) => {
        // Verify: 'from' must match authenticated user
        if (from !== userId) {
            console.warn(`[Security] User ${userId} tried to spoof call as ${from}`);
            return;
        }
        console.log(`[Socket] User ${from} is calling User ${userToCall} (${type})`);
        const receiverSocketId = getReceiverSocketId(userToCall);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callUser", { signal: signalData, from, type });
        }
    });

    // ── Event: answerCall ───────────────────────────────────────────────────
    socket.on("answerCall", ({ signal, to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callAccepted", { signal });
        }
    });

    // ── Event: endCall ──────────────────────────────────────────────────────
    socket.on("endCall", ({ to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callEnded");
        }
    });

    // ── Event: iceCandidate ─────────────────────────────────────────────────
    socket.on("iceCandidate", ({ candidate, to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("iceCandidate", { candidate });
        }
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
        console.log("A user Disconnected:", socket.id, "UserID:", userId);

        if (userId && userSocketMap[userId] === socket.id) {
            delete userSocketMap[userId];
            privateUsersSet.delete(userId.toString());
            console.log("User removed from online map. Current online users:", Object.keys(userSocketMap));

            try {
                await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
            } catch (err) {
                console.error("Error updating lastSeen on disconnect:", err);
            }

            broadcastOnlineUsers();
        } else if (userId) {
            console.log(`Ignoring disconnect for old socket of user ${userId}`);
        }
    });
});

export { app, server, io };
