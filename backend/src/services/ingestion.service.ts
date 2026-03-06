// src/services/ingestion.service.ts
/**
 * Document Ingestion Pipeline:
 * File → Parse Text → Semantic Chunks → OpenAI Embeddings → Pinecone + MongoDB
 */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from "uuid";

import { config } from "@config/env";
import logger from "@utils/logger.util";
import { parseFile, deleteFile } from "@utils/fileParser.util";

import { DocumentModel, DocumentStatus } from "@models/Document.model";
import { DocumentChunk } from "@models/DocumentChunk.model";

import { generateEmbeddings } from "./ai.service";
import { upsertVectors, type VectorRecord } from "./vectorDb.service";

/**
 * Main ingestion function — called by the BullMQ worker or the in-process fallback.
 * Processes a single document by ID through the full RAG ingestion pipeline.
 */
export async function ingestDocument(documentId: string): Promise<void> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
    }

    logger.info(`[Ingestion] Starting ingestion for: ${doc.fileName} (${documentId})`);

    // Mark as PROCESSING
    doc.status = DocumentStatus.PROCESSING;
    await doc.save();

    try {
        // ── Step 1: Parse raw text ───────────────────────────────────────────────
        logger.info(`[Ingestion] Parsing file: ${doc.filePath}`);
        const parsed = await parseFile(doc.filePath, doc.fileType);

        if (!parsed.text || parsed.text.trim().length === 0) {
            throw new Error("Parsed file contains no text content.");
        }

        if (parsed.pageCount) {
            doc.pageCount = parsed.pageCount;
        }

        // ── Step 2: Semantic Chunking ─────────────────────────────────────────────
        logger.info(`[Ingestion] Chunking document...`);
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: config.ai.chunkSize,
            chunkOverlap: config.ai.chunkOverlap,
            separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
        });

        const chunks = await splitter.splitText(parsed.text);
        logger.info(`[Ingestion] Created ${chunks.length} chunks`);

        if (chunks.length === 0) {
            throw new Error("Document produced zero chunks after splitting.");
        }

        // ── Step 3: Generate Embeddings (batch) ──────────────────────────────────
        logger.info(`[Ingestion] Generating embeddings for ${chunks.length} chunks...`);

        // Process in sub-batches to avoid hitting OpenAI rate limits
        const embeddingBatchSize = 20;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i += embeddingBatchSize) {
            const batch = chunks.slice(i, i + embeddingBatchSize);
            const embeddings = await generateEmbeddings(batch);
            allEmbeddings.push(...embeddings);
            logger.info(
                `[Ingestion] Embedded batch ${Math.floor(i / embeddingBatchSize) + 1}/${Math.ceil(chunks.length / embeddingBatchSize)}`,
            );
        }

        // ── Step 4: Upsert to Pinecone ────────────────────────────────────────────
        logger.info(`[Ingestion] Upserting vectors to Pinecone...`);
        const vectorRecords: VectorRecord[] = chunks.map((chunkText, idx) => ({
            id: uuidv4(),
            values: allEmbeddings[idx],
            metadata: {
                documentId: documentId,
                fileName: doc.fileName,
                chunkIndex: idx,
                text: chunkText.slice(0, 1000), // Pinecone metadata limit
            },
        }));

        await upsertVectors(vectorRecords);

        // ── Step 5: Save chunks to MongoDB ────────────────────────────────────────
        logger.info(`[Ingestion] Saving chunk metadata to MongoDB...`);

        // Remove old chunks if re-ingesting
        await DocumentChunk.deleteMany({ documentId });

        const chunkDocs = vectorRecords.map((record, idx) => ({
            documentId,
            chunkIndex: idx,
            text: chunks[idx],
            vectorId: record.id,
        }));

        await DocumentChunk.insertMany(chunkDocs);

        // ── Step 6: Mark document as READY ───────────────────────────────────────
        doc.status = DocumentStatus.READY;
        doc.chunkCount = chunks.length;
        await doc.save();

        logger.info(
            `[Ingestion] ✅ Completed: ${doc.fileName} — ${chunks.length} chunks indexed`,
        );

        // ── Step 7: Cleanup (delete uploaded file) ───────────────────────────────
        deleteFile(doc.filePath);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown ingestion error";
        logger.error(`[Ingestion] ❌ Failed for ${doc.fileName}: ${message}`, err);

        doc.status = DocumentStatus.FAILED;
        doc.errorMessage = message;
        await doc.save();

        throw err;
    }
}
