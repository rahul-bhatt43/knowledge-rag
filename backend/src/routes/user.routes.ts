import { Router } from "express";
import { UserController } from "@/controllers/user.controller";
import { AuditAction } from "@/types/common.types";
import { UserRole } from "@/types/common.types";
import {
  createUserValidator,
  updateUserValidator,
  userIdValidator,
} from "@/validators/user.validator";
import { authenticate } from "@/middlewares/auth.middleware";
import {
  authorize,
} from "@/middlewares/rbac.middleware";
import { auditLog } from "@/middlewares/audit.middleware";
import { validate } from "@/middlewares/validation.middleware";

const router = Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// Create user (Admin or Founder only)
router.post(
  "/",
  authorize(UserRole.ADMIN , UserRole.MANAGER),
  createUserValidator,
  validate,
  auditLog(AuditAction.CREATE, "User"),
  userController.createUser,
);

// List users (with filters and modes)
router.get(
  "/list",
  authorize(
    UserRole.ADMIN,
    UserRole.MANAGER,
  ),
);

// Get all users (with filters)
router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  userController.getAllUsers,
);

// Get user by ID
router.get("/:id", userIdValidator, validate, userController.getUserById);

// Update user
router.put(
  "/:id",
  authorize(UserRole.ADMIN , UserRole.MANAGER),
  updateUserValidator,
  validate,
  auditLog(AuditAction.UPDATE, "User"),
  userController.updateUser,
);

// Delete user (Soft delete)
router.delete(
  "/:id",
  authorize(UserRole.ADMIN , UserRole.MANAGER),
  userIdValidator,
  validate,
  auditLog(AuditAction.DELETE, "User"),
  userController.deleteUser,
);

// Get users by role
router.get(
  "/role/:role",
  authorize(UserRole.ADMIN , UserRole.MANAGER),
  userController.getUsersByRole,
);

// Check if user has a specific role
router.get("/has-role", userController.hasRole);

export default router;
