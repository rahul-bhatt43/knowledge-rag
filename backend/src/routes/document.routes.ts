// src/routes/document.routes.ts
import { Router } from "express";
import { authenticate } from "@middlewares/auth.middleware";
import { authorize } from "@middlewares/rbac.middleware";
import { validate } from "@middlewares/validation.middleware";
import { uploadMiddleware } from "@config/multer.config";
import { UserRole } from "@/types/common.types";
import {
    uploadDocument,
    listDocuments,
    getDocument,
    getDocumentStatus,
    deleteDocument,
    reprocessDocument,
    getMeetingAnalytics,
    downloadTranscript,
    downloadSummaryPdf,
} from "@controllers/document.controller";
import {
    uploadDocumentValidator,
    listDocumentsValidator,
    documentIdValidator,
} from "@validators/document.validator";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Upload a document (ADMIN, MANAGER) ─────────────────────────────────────────
router.post(
    "/upload",
    authorize(UserRole.ADMIN, UserRole.MANAGER),
    uploadMiddleware.single("file"),
    uploadDocumentValidator,
    validate,
    uploadDocument,
);

// ── List all documents (all roles) ────────────────────────────────────────────
router.get(
    "/",
    listDocumentsValidator,
    validate,
    listDocuments,
);

// ── Get a single document ─────────────────────────────────────────────────────
router.get(
    "/:id",
    documentIdValidator,
    validate,
    getDocument,
);

// ── Get document ingestion status ─────────────────────────────────────────────
router.get(
    "/:id/status",
    documentIdValidator,
    validate,
    getDocumentStatus,
);

// ── Get meeting analytics (audio docs only, all roles) ────────────────────────
router.get(
    "/:id/analytics",
    documentIdValidator,
    validate,
    getMeetingAnalytics,
);

// ── Download raw transcript (.txt) ───────────────────────────────────────────
router.get(
    "/:id/transcript/download",
    documentIdValidator,
    validate,
    downloadTranscript,
);

// ── Download summary PDF ──────────────────────────────────────────────────────
router.get(
    "/:id/summary/pdf",
    documentIdValidator,
    validate,
    downloadSummaryPdf,
);

// ── Reprocess a failed document (ADMIN, MANAGER) ────────────────────────────
router.post(
    "/:id/reprocess",
    authorize(UserRole.ADMIN, UserRole.MANAGER),
    documentIdValidator,
    validate,
    reprocessDocument,
);

// ── Delete a document + its vectors (ADMIN only) ─────────────────────────────
router.delete(
    "/:id",
    authorize(UserRole.ADMIN),
    documentIdValidator,
    validate,
    deleteDocument,
);

export default router;
