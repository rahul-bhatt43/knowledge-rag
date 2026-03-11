// src/controllers/document.controller.ts
import { Request, Response } from "express";
import path from "path";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import { ApiResponse } from "@utils/ApiResponse";
import { DocumentModel, DocumentStatus } from "@models/Document.model";
import { DocumentChunk } from "@models/DocumentChunk.model";
import { enqueueIngestionJob } from "@jobs/ingestDocument.job";
import { deleteVectorsByDocumentId } from "@services/vectorDb.service";
import { analyzeMeetingTranscript } from "@services/ai.service";
import logger from "@utils/logger.util";
import { generateMeetingSummaryPdf } from "@services/pdf.service";

// ── POST /api/v1/documents/upload ─────────────────────────────────────────────
export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new ApiError(400, "No file uploaded");
    }

    const { description, tags } = req.body as { description?: string; tags?: string };
    const file = req.file;

    // Create Document record in MongoDB
    const doc = await DocumentModel.create({
        fileName: file.originalname,
        storedFileName: file.filename,
        filePath: file.path,
        fileType: file.mimetype || path.extname(file.originalname).slice(1),
        fileSize: file.size,
        status: DocumentStatus.PENDING,
        uploadedBy: req.user!.id,
        description: description?.trim(),
        tags: tags
            ? tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
    });

    logger.info(`[Document] Uploaded: ${doc.fileName} → ${doc._id}`);

    // Enqueue ingestion job (BullMQ or in-process fallback)
    await enqueueIngestionJob(doc._id.toString());

    return res.status(201).json(
        new ApiResponse(201, {
            documentId: doc._id,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            fileType: doc.fileType,
            status: doc.status,
        }, "Document uploaded successfully. Ingestion started."),
    );
});

// ── GET /api/v1/documents ─────────────────────────────────────────────────────
export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as DocumentStatus | undefined;
    const search = req.query.search as string | undefined;

    // Build filter
    const filter: Record<string, unknown> = {};
    if (status && Object.values(DocumentStatus).includes(status)) {
        filter.status = status;
    }
    if (search) {
        filter.fileName = { $regex: search, $options: "i" };
    }

    const [documents, total] = await Promise.all([
        DocumentModel.find(filter)
            .populate("uploadedBy", "firstName lastName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        DocumentModel.countDocuments(filter),
    ]);

    return res.json(new ApiResponse(200, {
        documents,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }));
});

// ── GET /api/v1/documents/:id ─────────────────────────────────────────────────
export const getDocument = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id)
        .populate("uploadedBy", "firstName lastName email")
        .lean();

    if (!doc) throw new ApiError(404, "Document not found");

    const chunkCount = await DocumentChunk.countDocuments({ documentId: id });

    return res.json(new ApiResponse(200, { ...doc, chunkCount }));
});

// ── GET /api/v1/documents/:id/status ─────────────────────────────────────────
export const getDocumentStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id)
        .select("fileName status chunkCount errorMessage updatedAt")
        .lean();

    if (!doc) throw new ApiError(404, "Document not found");

    return res.json(new ApiResponse(200, doc));
});

// ── DELETE /api/v1/documents/:id ──────────────────────────────────────────────
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id);
    if (!doc) throw new ApiError(404, "Document not found");

    // 1. Get all vector IDs for this document
    const chunks = await DocumentChunk.find({ documentId: id })
        .select("vectorId")
        .lean();
    const vectorIds = chunks.map((c) => c.vectorId);

    // 2. Delete from Pinecone
    if (vectorIds.length > 0) {
        await deleteVectorsByDocumentId(vectorIds);
    }

    // 3. Delete chunks from MongoDB
    await DocumentChunk.deleteMany({ documentId: id });

    // 4. Delete the document record
    await DocumentModel.findByIdAndDelete(id);

    logger.info(`[Document] Deleted: ${doc.fileName} and ${vectorIds.length} vectors`);

    return res.json(
        new ApiResponse(200, null, `Document "${doc.fileName}" deleted successfully`),
    );
});

// ── POST /api/v1/documents/:id/reprocess ─────────────────────────────────────
export const reprocessDocument = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id);

    if (!doc) throw new ApiError(404, "Document not found");

    if (doc.status === DocumentStatus.PROCESSING) {
        throw new ApiError(409, "Document is already being processed");
    }

    // Reset status and enqueue again
    doc.status = DocumentStatus.PENDING;
    doc.errorMessage = undefined;
    await doc.save();

    await enqueueIngestionJob(id);

    return res.json(
        new ApiResponse(200, { documentId: id, status: doc.status }, "Reprocessing started"),
    );
});

// ── GET /api/v1/documents/:id/analytics ──────────────────────────────────────
export const getMeetingAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id);

    if (!doc) throw new ApiError(404, "Document not found");
    if (!doc.isAudioFile) throw new ApiError(400, "Analytics are only available for audio documents");
    if (doc.status !== DocumentStatus.READY) {
        throw new ApiError(400, `Document is not ready yet (status: ${doc.status})`);
    }
    if (!doc.transcript) {
        throw new ApiError(422, "No transcript found for this document. Please reprocess it.");
    }

    // Return cached analytics if < 24h old
    const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    if (
        doc.analytics?.generatedAt &&
        Date.now() - doc.analytics.generatedAt.getTime() < CACHE_TTL_MS
    ) {
        logger.info(`[Analytics] Returning cached analytics for ${doc.fileName}`);
        return res.json(new ApiResponse(200, doc.analytics, "Analytics retrieved from cache"));
    }

    // Generate fresh analytics
    logger.info(`[Analytics] Generating analytics for ${doc.fileName}...`);
    const result = await analyzeMeetingTranscript(doc.transcript);

    // Cache on document
    doc.analytics = { ...result, generatedAt: new Date() };
    await doc.save();

    logger.info(`[Analytics] ✅ Done for ${doc.fileName} — sentiment: ${result.sentiment}`);
    return res.json(new ApiResponse(200, doc.analytics, "Analytics generated successfully"));
});

// ── GET /api/v1/documents/:id/transcript/download ────────────────────────────
export const downloadTranscript = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id);

    if (!doc) throw new ApiError(404, "Document not found");
    if (!doc.transcript) throw new ApiError(404, "Transcript not available for this document");

    const safeFileName = doc.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}_transcript.txt"`);
    res.setHeader("Content-Type", "text/plain");

    return res.send(doc.transcript);
});

// ── GET /api/v1/documents/:id/summary/pdf ────────────────────────────────────
export const downloadSummaryPdf = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const doc = await DocumentModel.findById(id);

    if (!doc) throw new ApiError(404, "Document not found");
    if (!doc.isAudioFile) throw new ApiError(400, "PDF Summary is only available for meeting audio");
    if (!doc.transcript || !doc.analytics) {
        throw new ApiError(422, "Analytics/Transcript not ready. Please generate analytics first.");
    }

    const safeFileName = doc.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const pdfBuffer = await generateMeetingSummaryPdf({
        title: doc.fileName,
        date: doc.createdAt.toLocaleDateString(),
        duration: doc.durationSeconds ? `${Math.floor(doc.durationSeconds / 60)}m ${Math.floor(doc.durationSeconds % 60)}s` : "Unknown",
        speakers: doc.speakerCount || 0,
        sentiment: doc.analytics.sentiment,
        sentimentScore: doc.analytics.sentimentScore,
        keyTopics: doc.analytics.keyTopics,
        actionItems: doc.analytics.actionItems,
        transcript: doc.transcript
    });

    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}_summary.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.send(pdfBuffer);
});
