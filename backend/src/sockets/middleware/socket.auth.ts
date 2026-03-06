import { Socket } from "socket.io";
import { verifyAccessToken } from "@/utils/jwt.util";
import { User } from "@/models/User.model";
import { EntityStatus } from "@/types/common.types";

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void,
) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user || user.status !== EntityStatus.ACTIVE) {
      return next(new Error("User not found or inactive"));
    }

    // Attach user info to socket
    socket.userId = user._id.toString();
    socket.userRole = user.role;

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
};
