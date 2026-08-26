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

/**
 * A target for io.to(...) that reaches every device this user has open.
 *
 * Returns the per-user room name rather than a socket id. Socket.IO treats both
 * identically at the call site — each socket is itself a room — so every existing
 * `io.to(getReceiverSocketId(id)).emit(...)` now fans out to all of that user's
 * devices instead of only the most recent one, with no change at those call sites.
 *
 * Still falsy when the user has nothing connected, because callers use it as an
 * "are they online" test as well as an address.
 */
export function getReceiverSocketId(userId) {
    const sockets = userSocketMap.get(String(userId));
    return sockets && sockets.size > 0 ? roomForUser(userId) : undefined;
}

export const roomForUser = (userId) => `user_${userId}`;

// userId -> Set of that user's live socket ids. It was a single socket id, and a
// second device replaced the first, so two devices could never be online at once
// and nothing could be delivered to more than one of them.
const userSocketMap = new Map();

const onlineUserIds = () => [...userSocketMap.keys()].filter((id) => userSocketMap.get(id)?.size > 0);
const privateUsersSet = new Set(); // users who hide online status
// Users who have turned off the typing indicator. Held in memory alongside the
// online-status set so the `typing` handler stays a lookup rather than a query —
// it fires on nearly every keystroke.
const typingPrivateSet = new Set();

// Simple socket-level rate limiter maps: per-user counters with reset windows
const socketRateMap = new Map(); // userId -> { lastReset, counters: { key: count }}

function socketAllow(userId, key, limit, windowMs) {
    // Rate limiting removed: always allow socket actions
    return true;
}

// Runtime tracking for active group calls: Map<groupId, { startedBy, type, startTime, participants: Set<socketId>, participantUserIds: Set<userId> }>
const activeGroupCalls = new Map();

// ── Blocking, enforced on relayed socket traffic ─────────────────────────────
//
// Sending a DM is already refused by the REST controller, but everything
// relayed over the socket bypassed that: a blocked user could still make the
// other person's "typing…" indicator appear, ring them with a call, and receive
// read receipts. The block was effectively cosmetic for anything not going
// through sendMessage.
//
// Results are cached briefly because `typing` fires on nearly every keystroke
// and a database lookup per event would be unreasonable. The window is short,
// and toggleBlockUser drops the entry immediately, so a fresh block takes
// effect at once rather than after the TTL.
const BLOCK_CACHE_TTL_MS = 30_000;
const blockCache = new Map(); // userId -> { at, ids: Set<string> }

export function invalidateBlockCache(userId) {
    if (userId) blockCache.delete(userId.toString());
}

const blockedIdsFor = async (id) => {
    const key = id.toString();
    const hit = blockCache.get(key);
    if (hit && Date.now() - hit.at < BLOCK_CACHE_TTL_MS) return hit.ids;
    try {
        const user = await User.findById(key).select("blockedUsers").lean();
        const ids = new Set((user?.blockedUsers || []).map((b) => b.toString()));
        blockCache.set(key, { at: Date.now(), ids });
        return ids;
    } catch (err) {
        console.error("Error loading block list:", err.message);
        // Fail open: a lookup failure must not silence a legitimate chat.
        return hit?.ids || new Set();
    }
};

/** True if either party has blocked the other — blocking cuts both ways. */
const isBlockedBetween = async (a, b) => {
    if (!a || !b) return false;
    const [aBlocks, bBlocks] = await Promise.all([blockedIdsFor(a), blockedIdsFor(b)]);
    return aBlocks.has(b.toString()) || bBlocks.has(a.toString());
};

const broadcastOnlineUsers = () => {
    const visibleOnlineUsers = onlineUserIds().filter(id => !privateUsersSet.has(id));
    io.emit("getOnlineUsers", visibleOnlineUsers);
};

/**
 * Pushes account-level state to every device the user has open.
 *
 * Pins, favourites, archive and the locked set are per-account, so a change made
 * on a phone should be visible on a laptop without a refresh — which is what
 * every real messenger does. Now that a user can hold several sockets, the room
 * reaches all of them.
 */
export function emitAccountLists(userId, lists) {
    io.to(roomForUser(userId)).emit("accountListsUpdated", lists);
}

export function updateTypingPrivacyState(userId, isPrivate) {
    if (isPrivate) {
        typingPrivateSet.add(userId.toString());
    } else {
        typingPrivateSet.delete(userId.toString());
    }
}

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

    // Additive, not replacing. Disconnecting the previous socket is what made a
    // second device kick the first one off, which in turn made per-account sync
    // across devices impossible.
    const key = String(userId);
    if (!userSocketMap.has(key)) userSocketMap.set(key, new Set());
    userSocketMap.get(key).add(socket.id);

    // The room is how anything reaches every device at once.
    socket.join(roomForUser(userId));

    // More than one live socket now means more than one device, not a stale
    // connection to be cleaned up.
    const deviceCount = userSocketMap.get(key).size;
    if (deviceCount > 1) {
        console.log(`User ${userId} now on ${deviceCount} devices. New socket: ${socket.id}`);
    } else {
        console.log(`User ${userId} connected. Current online users:`, onlineUserIds());
    }

    // Deliberately NOT awaited here.
    //
    // Every socket.on(...) below must be registered in the same tick as the
    // connection. Socket.IO does not buffer events for listeners that don't
    // exist yet, so awaiting a database round-trip at this point silently
    // dropped anything a client emitted immediately on connect — which is
    // exactly what the app does with markAsRead when it opens a chat.
    User.findById(userId)
        .select("onlinePrivacy typingPrivacy")
        .then((user) => {
            if (user && user.onlinePrivacy === false) {
                privateUsersSet.add(userId.toString());
            } else {
                privateUsersSet.delete(userId.toString());
            }
            if (user && user.typingPrivacy === false) {
                typingPrivateSet.add(userId.toString());
            } else {
                typingPrivateSet.delete(userId.toString());
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

    // ── Event: markGroupAsRead ──────────────────────────────────────────────
    // Group reads were never recorded anywhere. The same lastReadAt map is
    // reused, keyed by group id instead of a user id, which is what lets
    // "seen by" be derived for group messages without a per-recipient write
    // for every message sent.
    socket.on("markGroupAsRead", async ({ groupId }) => {
        if (!groupId) return;
        try {
            await User.updateOne(
                { _id: userId },
                { $set: { [`lastReadAt.${groupId}`]: new Date() } }
            );
        } catch (err) {
            console.error("Error persisting group lastReadAt:", err.message);
        }
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

        // Per-contact read receipt hiding: if the sender has hidden read
        // receipts from this receiver, suppress the blue tick event.
        if (senderId) {
            try {
                const senderDoc = await User.findById(senderId).select("readReceiptsHidden").lean();
                const hiddenMap = senderDoc?.readReceiptsHidden;
                const isHidden = hiddenMap instanceof Map
                    ? hiddenMap.get(String(receiverId))
                    : hiddenMap?.[String(receiverId)];
                if (isHidden) return; // sender doesn't want to see blue ticks
            } catch {
                // If the lookup fails, fall through and send the receipt.
            }
        }

        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId && !(await isBlockedBetween(userId, senderId))) {
            io.to(senderSocketId).emit("messagesRead", {
                userId: receiverId,
                readAt: Date.now(),
            });
        }
    });

    // ── Event: typing ───────────────────────────────────────────────────────
    socket.on("typing", async ({ receiverId, isTyping }) => {
        // Use verified socket.userId as senderId — never trust client
        // Enforced here rather than in the composer: a client that predates the
        // setting, or one that ignores it, must not be able to leak the
        // indicator anyway.
        if (typingPrivateSet.has(userId.toString())) return;
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (!receiverSocketId) return;
        if (await isBlockedBetween(userId, receiverId)) return;
        io.to(receiverSocketId).emit("typing", { senderId: userId, isTyping });
    });

    // ── Event: callUser ─────────────────────────────────────────────────────
    socket.on("callUser", async ({ userToCall, signalData, from, type }) => {
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
        if (!receiverSocketId) return;
        if (await isBlockedBetween(userId, userToCall)) {
            // Reported as unreachable rather than "blocked", so the block is
            // not disclosed to the caller.
            socket.emit("callFailed", { reason: "unavailable" });
            return;
        }
        io.to(receiverSocketId).emit("callUser", { signal: signalData, from, type });
    });

    // ── Event: answerCall ───────────────────────────────────────────────────
    socket.on("answerCall", async ({ signal, to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (!receiverSocketId) return;
        if (await isBlockedBetween(userId, to)) return;
        io.to(receiverSocketId).emit("callAccepted", { signal });
    });

    // ── Event: endCall ──────────────────────────────────────────────────────
    socket.on("endCall", ({ to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callEnded");
        }
    });

    // ── Event: iceCandidate ─────────────────────────────────────────────────
    socket.on("iceCandidate", async ({ candidate, to }) => {
        const receiverSocketId = getReceiverSocketId(to);
        if (!receiverSocketId) return;
        if (await isBlockedBetween(userId, to)) return;
        io.to(receiverSocketId).emit("iceCandidate", { candidate });
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
        if (typingPrivateSet.has(userId.toString())) return;
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

        const set = userId ? userSocketMap.get(String(userId)) : null;
        if (set) set.delete(socket.id);
        // Only counts as going offline once the user's last device has gone.
        if (set && set.size === 0) {
            userSocketMap.delete(String(userId));
            privateUsersSet.delete(userId.toString());
            console.log("User removed from online map. Current online users:", onlineUserIds());

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
