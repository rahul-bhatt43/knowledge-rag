import type { Types } from "mongoose";
import type { UserRole } from "@/types/common.types";

/**
 * Shape of user stored in req.user
 */
export interface RequestUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: Types.ObjectId;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
