import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../middleware/socket.auth";

export const handleNotificationEvents = (
  io: Server,
  socket: AuthenticatedSocket,
) => {
  // Join user's personal notification room
  socket.on("notifications:join", () => {
    socket.join(`user:${socket.userId}`);
    console.log(`User ${socket.userId} joined notification room`);
  });

  // Mark notification as read
  socket.on("notification:read", (notificationId: string) => {
    // You would update the notification status in database here
    socket.emit("notification:marked:read", { notificationId });
  });
};

// Helper function to send notification to specific user
export const sendNotificationToUser = (
  io: Server,
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  },
) => {
  io.to(`user:${userId}`).emit("notification", {
    ...notification,
    timestamp: new Date(),
  });
};