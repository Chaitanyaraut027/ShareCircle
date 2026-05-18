import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import matchRoutes from "./routes/match.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import donationRoutes from "./routes/donation.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import requestRoutes from "./routes/request.routes.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import "./config/firebase.config.js";

const app = express();

/* =========================
   Global Middleware
========================= */
app.use(express.json());
app.use(cookieParser());

// ─── Allowed web origins ───────────────────────────────────────────────────
// Static dev origins always allowed
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

// Production web origins — set ALLOWED_WEB_ORIGINS env var on Render as a
// comma-separated list, e.g. "https://sharecircle.vercel.app,https://sharecircle.netlify.app"
// By default, always include the deployed Netlify URL to avoid manual env configuration.
const PROD_ORIGINS = [
  "https://sharecircleweb.netlify.app",
  ...(process.env.ALLOWED_WEB_ORIGINS
    ? process.env.ALLOWED_WEB_ORIGINS.split(",").map((o) => o.trim())
    : [])
];

const ALL_ALLOWED_ORIGINS = [...DEV_ORIGINS, ...PROD_ORIGINS];

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // No Origin header → mobile app, Postman, curl — always allow
      if (!requestOrigin) return callback(null, true);

      if (ALL_ALLOWED_ORIGINS.includes(requestOrigin)) {
        return callback(null, requestOrigin); // echo back exact origin (required for credentials)
      }

      console.warn(`⚠️  CORS blocked: ${requestOrigin}`);
      return callback(new Error(`CORS: Origin ${requestOrigin} not allowed`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =========================
   Routes
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/chatbot", chatbotRoutes);

/* =========================
   Health Check
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ShareCircle API is running",
  });
});

app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ShareCircle API is running at /api",
  });
});

export default app;
