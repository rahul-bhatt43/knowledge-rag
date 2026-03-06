import { Server } from "socket.io";
import {
  socketAuthMiddleware,
  AuthenticatedSocket,
} from "./middleware/socket.auth";
import { handleNotificationEvents } from "./handlers/notification.handler";

export const initializeSocket = (io: Server) => {
  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log(`✅ Client connected: ${socket.id} (User: ${socket.userId})`);

    socket.emit("hello", {
      message: "Socket server connected successfully!",
      socketId: socket.id,
    });

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Initialize event handlers
    handleNotificationEvents(io, socket);

    // Handle typing indicator (example)
    socket.on("typing:start", (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit("user:typing", {
        userId: socket.userId,
        taskId: data.taskId,
      });
    });

    socket.on("typing:stop", (data: { taskId: string }) => {
      socket.to(`task:${data.taskId}`).emit("user:stopped:typing", {
        userId: socket.userId,
        taskId: data.taskId,
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(
        `❌ Client disconnected: ${socket.id} (User: ${socket.userId})`,
      );
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};
