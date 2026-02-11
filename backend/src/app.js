import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";

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

/* =========================
   Health Check
========================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "HeartMap API is running",
  });
});

export default app;
