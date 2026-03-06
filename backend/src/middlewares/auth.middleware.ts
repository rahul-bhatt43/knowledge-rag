import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { UserRole } from "@/types/common.types";
import { ApiError } from "@/utils/ApiError";
import { verifyAccessToken } from "@/utils/jwt.util";
import { User } from "@/models/User.model";

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Authentication required");
    }

    const token = authHeader.substring(7);

    try {
      // Verify token
      const decoded = verifyAccessToken(token);

      // Get user from database
      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        throw new ApiError(401, "User not found");
      }

      if (user.status !== "ACTIVE") {
        throw new ApiError(401, "User account is not active");
      }

      // Attach user to request
      req.user = {
        id: user._id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      throw new ApiError(401, "Invalid or expired token");
    }
  },
);
