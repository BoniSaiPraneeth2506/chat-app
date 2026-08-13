import dotenv from 'dotenv'
dotenv.config();
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import authRoutes from './routes/auth.route.js'
import messageRoutes from './routes/message.route.js'
import groupRoutes from './routes/group.route.js'
import connectDB from './lib/db.js';
import path from "path";
import cookieParser from 'cookie-parser';
import cors from 'cors'
import { app, server } from './lib/socket.js';
import { startScheduler } from './jobs/scheduler.js';

// ── Allowed origins ──────────────────────────────────────────────────────────
const buildAllowedOrigins = () => {
  const prod = process.env.ALLOWED_ORIGIN; // e.g. https://your-app.onrender.com
  const base = ["http://localhost:5173", "http://localhost:5001"];
  if (prod) base.push(prod);
  return base;
};
const ALLOWED_ORIGINS = buildAllowedOrigins();

const isOriginAllowed = (origin) => {
  if (process.env.NODE_ENV !== "production") return true;
  if (!origin) return true; // allow same-origin / server-to-server
  return ALLOWED_ORIGINS.includes(origin);
};

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
        ],
        mediaSrc: [
          "'self'",
          "blob:",
          "https://res.cloudinary.com",   // voice messages
        ],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          ...ALLOWED_ORIGINS,
          "https://res.cloudinary.com",
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
}));

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Auth routes: max 10 attempts per 15 minutes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true, // only count failed attempts
});

// General API: max 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api", generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// ── Static (production) ───────────────────────────────────────────────────────
const __dirname = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.get('/', (req, res) => {
  res.send("api is working");
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log("server running on port", PORT || 5001);
  connectDB();
  // Start the scheduled message dispatcher
  startScheduler();
});