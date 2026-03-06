import { Request, Response, NextFunction } from "express";
import { UserRole } from "@/types/common.types";
import { ApiError } from "@/utils/ApiError";
import { asyncHandler } from "@/utils/asyncHandler";

// Role hierarchy for basic checks
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN]: 3,
  [UserRole.MANAGER]: 2,
  [UserRole.STAFF]: 1,
};

export const authorize = (...roles: UserRole[]) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new ApiError(401, "Authentication required");
      }

      if (!roles.includes(req.user.role)) {
        throw new ApiError(
          403,
          "You do not have permission to perform this action",
        );
      }

      next();
    },
  );
};

export const checkResourceOwnership = (ownerField: string = "createdBy") => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        throw new ApiError(401, "Authentication required");
      }

      // Founder and Admin can access all resources in their scope
      if ([UserRole.ADMIN].includes(req.user.role)) {
        return next();
      }

      const resource = req.body || req.params;
      const ownerId = resource[ownerField];

      if (ownerId && ownerId.toString() !== req.user.id.toString()) {
        throw new ApiError(403, "You do not have access to this resource");
      }

      next();
    },
  );
};
