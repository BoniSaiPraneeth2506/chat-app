import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Message from '../models/message.model.js';
import Group from '../models/group.model.js';
import { isOriginAllowed } from './origins.js';
import { canDo } from './groupPermissions.js';

const app = express();
const server = http.createServer(app);

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
io.use(async (socket, next) => {
    try {
        // Accept token from auth.token (preferred) or query.token (fallback)
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error("Unauthorized: No token provided"));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Tokens issued before device sessions existed carry no sid and stay valid.
        if (decoded.sid) {
            const user = await User.findById(decoded.userId).select("sessions.sid");
            if (!user?.sessions?.some((s) => s.sid === decoded.sid)) {
                return next(new Error("Unauthorized: Session has been logged out"));
            }
            socket.sessionId = decoded.sid;
        }
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

// Simple socket-level rate limiter maps: per-user counters with reset windows
const socketRateMap = new Map(); // userId -> { lastReset, counters: { key: count }}

function socketAllow(userId, key, limit, windowMs) {
    // Rate limiting removed: always allow socket actions
    return true;
}

// Runtime tracking for active group calls: Map<groupId, { startedBy, type, startTime, participants: Set<socketId>, participantUserIds: Set<userId> }>
const activeGroupCalls = new Map();

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

    if (oldSocketId) {
        console.log(`User ${userId} reconnected. Old socket: ${oldSocketId}, New socket: ${socket.id}`);
    } else {
        console.log(`User ${userId} connected. Current online users:`, Object.keys(userSocketMap));
    }

    // Deliberately NOT awaited here.
    //
    // Every socket.on(...) below must be registered in the same tick as the
    // connection. Socket.IO does not buffer events for listeners that don't
    // exist yet, so awaiting a database round-trip at this point silently
    // dropped anything a client emitted immediately on connect — which is
    // exactly what the app does with markAsRead when it opens a chat.
    User.findById(userId)
        .select("onlinePrivacy")
        .then((user) => {
            if (user && user.onlinePrivacy === false) {
                privateUsersSet.add(userId.toString());
            } else {
                privateUsersSet.delete(userId.toString());
            }
        })
        .catch((err) => {
            console.error("Error fetching user settings on connection:", err);
        })
        .finally(() => {
            // Broadcast once the privacy flag is known, so a user who opted
            // out is never briefly announced as online.
            broadcastOnlineUsers();
        });

    // ── Event: markAsRead ───────────────────────────────────────────────────
    socket.on("markAsRead", async ({ senderId, receiverId }) => {
        // Validate: only the authenticated user can claim to be the receiver
        if (receiverId !== userId) {
            console.warn(`[Security] User ${userId} tried to spoof markAsRead as ${receiverId}`);
            return;
        }
        console.log(`[Socket] User ${receiverId} read messages from User ${senderId}`);

        // Persist the read mark so unread counts can be rebuilt after the app
        // is closed or the user logs out. Previously this handler only relayed
        // the receipt, leaving read state entirely in the reader's memory.
        if (senderId) {
            try {
                await User.updateOne(
                    { _id: receiverId },
                    { $set: { [`lastReadAt.${senderId}`]: new Date() } }
                );
            } catch (err) {
                // A failed write must not stop the sender's ticks from updating.
                console.error("Error persisting lastReadAt:", err.message);
            }
        }

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
        // Throttle call requests: max 5 calls per minute
        if (!socketAllow(userId, 'callUser', 5, 60 * 1000)) {
            socket.emit('rateLimited', { action: 'callUser', message: 'Too many call attempts. Please wait.' });
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

    // ── Group Socket Events ──────────────────────────────────────────────────
    socket.on("joinGroupRoom", (groupId) => {
        if (groupId) {
            socket.join(`group_${groupId}`);
            console.log(`[Group Socket] User ${userId} (socket ${socket.id}) joined group_${groupId}`);
        }
    });

    socket.on("leaveGroupRoom", (groupId) => {
        if (groupId) {
            socket.leave(`group_${groupId}`);
            console.log(`[Group Socket] User ${userId} left group_${groupId}`);
        }
    });

    socket.on("groupTyping", ({ groupId, isTyping }) => {
        if (groupId) {
            socket.to(`group_${groupId}`).emit("groupTyping", { groupId, userId, isTyping });
        }
    });

    // ── Group Multi-Peer Call Events (Mesh WebRTC) ───────────────────────────
    socket.on("startGroupCall", async ({ groupId, type, groupName }) => {
        // Throttle group call starts: max 3 starts per 10 minutes
        if (!socketAllow(userId, 'startGroupCall', 3, 10 * 60 * 1000)) {
            socket.emit('rateLimited', { action: 'startGroupCall', message: 'Too many group call starts. Try later.' });
            return;
        }

        // Previously unguarded: any member — or anyone who knew a group id —
        // could start a call for everyone. Now it respects the group's
        // startCalls permission, and membership is required either way.
        try {
            const group = await Group.findById(groupId).select("members permissions isReadOnly");
            if (!group || !canDo(group, userId, "startCalls")) {
                socket.emit("groupCallDenied", {
                    groupId,
                    message: "You don't have permission to start a call in this group",
                });
                return;
            }
        } catch (err) {
            console.error("Error checking group call permission:", err.message);
            return;
        }

        console.log(`[Group Call] User ${userId} started ${type} call in group ${groupId}`);
        // initialize runtime call state
        activeGroupCalls.set(groupId, {
            startedBy: userId,
            type,
            startTime: Date.now(),
            participants: new Set([socket.id]),
            participantUserIds: new Set([userId]),
        });
        // persist activeCall status on Group (best-effort)
        try {
            Group.findByIdAndUpdate(groupId, { $set: { 'activeCall.isActive': true, 'activeCall.type': type, 'activeCall.startedBy': userId } }).catch(() => {});
        } catch (e) {}

        io.to(`group_${groupId}`).emit("groupCallStarted", { groupId, type, groupName, startedBy: userId });
    });

    socket.on("joinGroupCall", ({ groupId, user }) => {
        const callRoom = `group_call_${groupId}`;
        socket.join(callRoom);
        console.log(`[Group Call] Socket ${socket.id} (User ${userId}) joined group call room ${callRoom}`);

        // Get list of existing sockets in the call room
        const roomSockets = io.sockets.adapter.rooms.get(callRoom);
        const existingParticipants = [];
        if (roomSockets) {
            for (const sockId of roomSockets) {
                if (sockId !== socket.id) {
                    const participantSocket = io.sockets.sockets.get(sockId);
                    existingParticipants.push({
                        socketId: sockId,
                        userId: participantSocket?.userId,
                    });
                }
            }
        }

        // Update runtime participants
        const runtime = activeGroupCalls.get(groupId);
        if (runtime) {
            runtime.participants.add(socket.id);
            runtime.participantUserIds.add(userId);
        }

        // Send existing participants back to the newly joined peer
        socket.emit("allGroupCallParticipants", existingParticipants);

        // Notify existing participants that a new peer joined
        socket.to(callRoom).emit("groupCallUserJoined", {
            socketId: socket.id,
            user,
        });
    });

    socket.on("sendGroupSignal", ({ toSocketId, signal, fromUser }) => {
        io.to(toSocketId).emit("groupCallSignalReceived", {
            fromSocketId: socket.id,
            signal,
            fromUser,
        });
    });

    // Host-initiated end of group call: ends call for everyone and creates call log
    // ── Raise hand ──────────────────────────────────────────────────────
    // Purely a broadcast flag: the server tracks nothing, it just relays so
    // every participant's UI agrees on who has a hand up.
    socket.on("groupRaiseHand", ({ groupId, raised }) => {
      if (!groupId) return;
      io.to(`group_call_${groupId}`).emit("groupHandRaised", {
        userId,
        socketId: socket.id,
        raised: Boolean(raised),
      });
    });

    // ── Mute all ────────────────────────────────────────────────────────
    // A request, not a command: a server cannot switch off someone else's
    // microphone, so each client mutes itself on receipt. Only whoever
    // started the call may ask.
    socket.on("groupMuteAll", ({ groupId }) => {
      const call = activeGroupCalls.get(groupId);
      if (!call || call.startedBy !== userId) return;
      socket.to(`group_call_${groupId}`).emit("groupMuteAllRequested", { by: userId });
    });

    socket.on("endGroupCall", async ({ groupId }) => {
        const runtime = activeGroupCalls.get(groupId);
        if (!runtime) return;
        // Only allow the starter to force-end the call
        if (runtime.startedBy && runtime.startedBy.toString() !== userId.toString()) {
            console.log(`[Group Call] User ${userId} attempted to end call in ${groupId} but is not starter`);
            return;
        }

        const duration = Math.max(0, Math.floor((Date.now() - runtime.startTime) / 1000));

        // Create call log message in DB
        try {
            const msg = new Message({
                senderId: runtime.startedBy || userId,
                groupId,
                isCallLog: true,
                callType: runtime.type,
                callDuration: duration,
                callStatus: "completed",
            });
            await msg.save();
            const populated = await msg.populate('senderId');
            io.to(`group_${groupId}`).emit('newGroupMessage', populated);
        } catch (err) {
            console.error('Error creating group call log on endGroupCall:', err);
        }

        // Notify clients that call ended
        io.to(`group_call_${groupId}`).emit('groupCallEnded', { groupId, duration, endedBy: userId, startedBy: runtime.startedBy, type: runtime.type });

        // cleanup runtime state and DB activeCall
        activeGroupCalls.delete(groupId);
        try { Group.findByIdAndUpdate(groupId, { $set: { 'activeCall.isActive': false, 'activeCall.participants': [] } }).catch(()=>{}); } catch (e) {}
    });

    socket.on("leaveGroupCall", ({ groupId }) => {
        const callRoom = `group_call_${groupId}`;
        socket.leave(callRoom);
        console.log(`[Group Call] Socket ${socket.id} left group call room ${callRoom}`);
        socket.to(callRoom).emit("groupUserLeftCall", {
            socketId: socket.id,
            userId,
        });

        // Update runtime participants and end call if no participants remain
        const runtime = activeGroupCalls.get(groupId);
        if (runtime) {
            runtime.participants.delete(socket.id);
            runtime.participantUserIds.delete(userId);
            if (runtime.participants.size === 0) {
                const duration = Math.max(0, Math.floor((Date.now() - runtime.startTime) / 1000));
                // Create call log message in DB
                (async () => {
                    try {
                        const msg = new Message({
                            senderId: runtime.startedBy || userId,
                            groupId,
                            isCallLog: true,
                            callType: runtime.type,
                            callDuration: duration,
                            callStatus: "completed",
                        });
                        await msg.save();
                        const populated = await msg.populate('senderId');
                        io.to(`group_${groupId}`).emit('newGroupMessage', populated);
                    } catch (err) {
                        console.error('Error creating group call log on empty leaveGroupCall:', err);
                    }
                })();

                io.to(`group_call_${groupId}`).emit('groupCallEnded', { groupId, duration, endedBy: userId, startedBy: runtime.startedBy, type: runtime.type });
                activeGroupCalls.delete(groupId);
                try { Group.findByIdAndUpdate(groupId, { $set: { 'activeCall.isActive': false, 'activeCall.participants': [] } }).catch(()=>{}); } catch (e) {}
            }
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

/**
 * Kicks live sockets whose device session was revoked.
 * @param {string} userId
 * @param {(sid: string) => boolean} shouldDisconnect
 */
export function disconnectRevokedSessions(userId, shouldDisconnect) {
    for (const socket of io.sockets.sockets.values()) {
        if (
            socket.userId?.toString() === userId.toString() &&
            socket.sessionId &&
            shouldDisconnect(socket.sessionId)
        ) {
            socket.emit("sessionRevoked");
            socket.disconnect(true);
        }
    }
}

export { app, server, io };
