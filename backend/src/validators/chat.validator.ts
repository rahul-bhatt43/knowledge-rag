// src/validators/chat.validator.ts
import { body, query, param } from "express-validator";

export const createSessionValidator = [
    body("title")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Title must be at most 200 characters"),
    body("documentIds")
        .optional()
        .isArray()
        .withMessage("documentIds must be an array"),
    body("documentIds.*")
        .optional()
        .isMongoId()
        .withMessage("Each documentId must be a valid Mongo ID"),
];

export const sendMessageValidator = [
    param("sessionId").isMongoId().withMessage("Invalid session ID"),
    body("message")
        .notEmpty()
        .withMessage("Message is required")
        .isString()
        .trim()
        .isLength({ min: 1, max: 4000 })
        .withMessage("Message must be between 1 and 4000 characters"),
];

export const sessionIdValidator = [
    param("sessionId").isMongoId().withMessage("Invalid session ID"),
];

export const listSessionsValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
];
