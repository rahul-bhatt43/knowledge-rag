import { body, param } from "express-validator";
import { UserRole, EntityStatus } from "@/types/common.types";

export const createUserValidator = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long"),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long"),
  body("role").isIn(Object.values(UserRole)).withMessage("Invalid role")
];

export const updateUserValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long"),
  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long"),
  body("role")
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage("Invalid role"),
  body("status")
    .optional()
    .isIn(Object.values(EntityStatus))
    .withMessage("Invalid status"),
];

export const userIdValidator = [
  param("id").isMongoId().withMessage("Invalid user ID"),
];

export const sendInviteValidator = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("role").isIn(Object.values(UserRole)).withMessage("Invalid role"),
  body("projectId")
    .optional()
    .isMongoId()
    .withMessage("Invalid project ID"),
  body("functionalAreaId")
    .optional()
    .isMongoId()
    .withMessage("Invalid functional area ID"),
  body("taskIds")
    .optional()
    .isArray()
    .withMessage("Task IDs must be an array"),
  body("taskIds.*")
    .optional()
    .isMongoId()
    .withMessage("Each task ID must be a valid MongoDB ID"),
];

export const acceptInviteValidator = [
  body("token").notEmpty().withMessage("Token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("firstName")
    .optional()
    .isLength({ min: 2 })
    .withMessage("First name too short"),
  body("lastName")
    .optional()
    .isLength({ min: 2 })
    .withMessage("Last name too short"),
];
