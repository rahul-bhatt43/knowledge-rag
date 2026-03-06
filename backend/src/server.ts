import http from "http";
import { Server } from "socket.io";

import app from "./app";
import { config } from "./config/env";
import { connectDB } from "./config/database";
import { initializeSocket } from "./sockets";

const isVercel = !!process.env.VERCEL;

const startServer = async () => {
  try {
    console.log("🔄 Starting server initialization...");
    console.log("🌍 Platform:", isVercel ? "Vercel" : "Server");

    // Connect DB (should be singleton internally)
    console.log("📦 Connecting to database...");
    await connectDB();
    console.log("✅ Database connected successfully");

    // 🚫 Vercel: DO NOT create server or socket
    if (isVercel) {
      console.log("⚠️ Skipping HTTP & Socket.IO initialization on Vercel");
      return;
    }

    // ✅ Server / Render / EC2 flow
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
        methods: ["GET", "POST"],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    initializeSocket(io);
    console.log("✅ Socket.IO initialized");

    // Expose io to app
    app.set("io", io);

    // Start listening
    server.listen(config.port, () => {
      console.log("=".repeat(50));
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📝 Environment: ${config.env}`);
      console.log(
        `🔗 API Base URL: http://localhost:${config.port}/api/${config.apiVersion}`,
      );
      console.log(`🔌 Socket.IO: Enabled`);
      console.log("=".repeat(50));
    });

    // Graceful shutdown (ONLY for server env)
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received. Shutting down...`);

      await new Promise<void>((resolve) => {
        io.close(() => {
          console.log("✅ Socket.IO closed");
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log("✅ HTTP server closed");
          resolve();
        });
      });

      process.exit(0);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
};

// 🚀 Start only once
startServer();

// ✅ REQUIRED for Vercel serverless
export default app;
