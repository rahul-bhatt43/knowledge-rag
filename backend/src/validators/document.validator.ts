// src/validators/document.validator.ts
import { body, query, param } from "express-validator";
import { DocumentStatus } from "@models/Document.model";

export const uploadDocumentValidator = [
    body("description")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Description must be at most 500 characters"),
    body("tags")
        .optional()
        .isString()
        .withMessage("Tags must be a comma-separated string"),
    body("isTemporary")
        .optional()
        .isBoolean()
        .toBoolean(),
];

export const listDocumentsValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),
    query("status")
        .optional()
        .isIn(Object.values(DocumentStatus))
        .withMessage(`Status must be one of: ${Object.values(DocumentStatus).join(", ")}`),
    query("search")
        .optional()
        .isString()
        .trim(),
];

export const documentIdValidator = [
    param("id").isMongoId().withMessage("Invalid document ID"),
];
