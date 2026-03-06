import { Router } from "express";
import { AuthController } from "@/controllers/auth.controller";
import {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
} from "@/validators/auth.validator";
import { AuditAction } from "@/types/common.types";
import { authenticate } from "@/middlewares/auth.middleware";
import { validate } from "@/middlewares/validation.middleware";
import { auditLog } from "@/middlewares/audit.middleware";

const router = Router();
const authController = new AuthController();

router.post(
  "/register",
  registerValidator,
  validate,
  auditLog(AuditAction.CREATE, "User"),
  authController.register,
);

router.post(
  "/login",
  loginValidator,
  validate,
  auditLog(AuditAction.LOGIN, "User"),
  authController.login,
);

router.post(
  "/refresh-token",
  refreshTokenValidator,
  validate,
  authController.refreshToken,
);

router.get("/profile", authenticate, authController.getProfile);

router.put(
  "/password",
  authenticate,
  updatePasswordValidator,
  validate,
  auditLog(AuditAction.UPDATE, "User"),
  authController.updatePassword,
);

router.post(
  "/logout",
  authenticate,
  auditLog(AuditAction.LOGOUT, "User"),
  authController.logout,
);

router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validate,
  auditLog(AuditAction.REQUEST_RESET_PASSWORD, "User"),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  resetPasswordValidator,
  validate,
  auditLog(AuditAction.RESET_PASSWORD, "User"),
  authController.resetPassword,
);

export default router;
