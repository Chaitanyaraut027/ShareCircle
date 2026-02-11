import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import seedAdmins from "./src/utils/admin.seed.js";

const PORT = process.env.PORT || 5000;

/* =========================
   Server Bootstrap
========================= */
const startServer = async () => {
  console.log("🚀 Starting HeartMap backend...");

  try {
    // 1️⃣ Connect Database
    await connectDB();
    console.log("✅ Database connected successfully");

    // 2️⃣ Seed Admins (optional, safe)
    try {
      await seedAdmins();
      console.log("✅ Admin seeding completed");
    } catch (err) {
      console.warn("⚠️ Admin seeding skipped:", err.message);
    }

    // 3️⃣ Start HTTP Server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🔥 Server running at http://0.0.0.0:${PORT}`);
    });

    // 4️⃣ Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      console.error("❌ Unhandled Promise Rejection:", err);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
