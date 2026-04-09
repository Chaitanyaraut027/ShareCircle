import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import matchRoutes from "./routes/match.routes.js";
import profileRoutes from "./routes/profile.routes.js";

const app = express();

/* =========================
   Global Middleware
========================= */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: "*", // restrict later in production
    credentials: true,
  })
);

/* =========================
   Routes
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/profile", profileRoutes);

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
