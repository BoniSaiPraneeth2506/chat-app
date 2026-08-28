import dotenv from 'dotenv'
dotenv.config();
import express from 'express'
import helmet from 'helmet'

import authRoutes from './routes/auth.route.js'
import messageRoutes from './routes/message.route.js'
import groupRoutes from './routes/group.route.js'
import uploadRoutes from './routes/upload.route.js'
import giphyRoutes from "./routes/giphy.route.js";
import statusRoutes from "./routes/status.route.js";
import notificationRoutes from "./routes/notification.route.js";
import aiRoutes from "./routes/ai.route.js";
import connectDB from './lib/db.js';
import path from "path";
import fs from "fs";
import cookieParser from 'cookie-parser';
import cors from 'cors'
import { app, server } from './lib/socket.js';
import { startScheduler, startMediaPurge } from './jobs/scheduler.js';
import { startStatusCleanup } from './jobs/statusCleanup.js';
import { startEmailDigest } from './jobs/emailDigest.js';
import { getAllowedOrigins, isOriginAllowed } from './lib/origins.js';

const ALLOWED_ORIGINS = getAllowedOrigins();

// The R2 public origin has to be allowed explicitly or the deployed web app
// silently fails to load video/document attachments under CSP. Empty when
// file sharing isn't configured, in which case nothing is added.
const R2_ORIGIN = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).origin : null;
  } catch {
    console.warn("R2_PUBLIC_URL is not a valid URL — skipping it in CSP.");
    return null;
  }
})();
const R2_CSP = R2_ORIGIN ? [R2_ORIGIN] : [];

// ── Helmet (HTTP security headers) ───────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://res.cloudinary.com",   // profile pics & chat images
          "https://cloudinary.com",
          ...R2_CSP,               // document/video thumbnails
        ],
        mediaSrc: [
          "'self'",
          "blob:",
          "https://res.cloudinary.com",   // voice messages
          ...R2_CSP,                     // video attachments
        ],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          ...ALLOWED_ORIGINS,
          "https://res.cloudinary.com",
          ...R2_CSP,                     // presigned PUT uploads
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // allow Cloudinary media to load
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  // Without this the browser hides these from the response entirely. The frontend
  // and the API are separate origins, so a custom header is unreadable unless it
  // is named here — which is why the pinned-message banner never appeared: the
  // server sent it and the client could not see it.
  exposedHeaders: ["X-Pinned-Message", "X-Window-Anchor", "X-Window-Has-Newer"],
}));

// Rate limiting removed: no express-rate-limit middleware applied.

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/giphy', giphyRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);

app.get('/', (req, res) => {
  res.send("api is working");
});

// ── Static frontend (only if this service also hosts the built SPA) ───────────
const __dirname = path.resolve();
const frontendIndex = path.join(__dirname, "../frontend/dist/index.html");
if (process.env.NODE_ENV === "production" && fs.existsSync(frontendIndex)) {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  // Express 5 requires a named wildcard (/* is invalid and crashes on startup)
  app.get("/{*splat}", (req, res) => {
    res.sendFile(frontendIndex);
  });
}

// ── Last-resort guards ────────────────────────────────────────────────────────
//
// Node terminates the process on an unhandled promise rejection. For a socket
// server that means every connected client is dropped and, on a free instance,
// waits out a cold start — a single bad event taking the whole app down. These
// log loudly and keep serving instead; the rejection is still a bug to fix, but
// it stops being an outage.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("server running on port", PORT || 5001);
  connectDB();
  // Start the scheduled message dispatcher
  startScheduler();
  // Reclaim Cloudinary storage from expired disappearing messages
  startMediaPurge();
  // Delete expired statuses and their B2 media
  startStatusCleanup();
  // Weekly summary and inactivity nudge, allowlisted to named addresses
  startEmailDigest();
});