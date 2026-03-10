// src/services/ingestion.service.ts
/**
 * Document Ingestion Pipeline:
 * File → Parse Text → Semantic Chunks → OpenAI Embeddings → Pinecone + MongoDB
 */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

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

    // If already READY and file is gone, just stop (already indexed successfully)
    if (doc.status === DocumentStatus.READY) {
        logger.info(`[Ingestion] Document ${doc.fileName} is already READY. Skipping.`);
        return;
    }

    if (!fs.existsSync(doc.filePath)) {
        logger.warn(`[Ingestion] Source file missing for ${doc.fileName}: ${doc.filePath}`);
        doc.status = DocumentStatus.FAILED;
        doc.errorMessage = "Source file missing from server. Cannot re-process.";
        await doc.save();
        return;
    }

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

        // ── Step 2: Specialized Chunking ─────────────────────────────────────────
        logger.info(`[Ingestion] Chunking document...`);
        let chunks: string[] = [];

        const isTabular = [".xlsx", ".csv"].some(ext => doc.fileName.toLowerCase().endsWith(ext)) || doc.fileType.includes("csv") || doc.fileType.includes("spreadsheet");
        const isSql = doc.fileName.toLowerCase().endsWith(".sql") || doc.fileType.includes("sql");

        if (isTabular) {
            chunks = chunkTabularData(parsed.text);
        } else if (isSql) {
            chunks = chunkSqlData(parsed.text);
        } else {
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: config.ai.chunkSize,
                chunkOverlap: config.ai.chunkOverlap,
                separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
            });
            chunks = await splitter.splitText(parsed.text);
        }

        logger.info(`[Ingestion] Created ${chunks.length} chunks using ${isTabular ? 'Tabular' : isSql ? 'SQL' : 'Standard'} splitter`);

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

/**
 * Specialized chunker for XLSX / CSV
 * Splitting by ROW and reinforcing every chunk with HEADERS.
 */
function chunkTabularData(text: string): string[] {
    const sheets = text.split("--- Sheet: ");
    const allChunks: string[] = [];

    for (const sheetData of sheets) {
        const trimmed = sheetData.trim();
        if (!trimmed) continue;

        const lines = trimmed.split("\n");
        // Identify headers (first row of actual data)
        const csvLines = lines.filter(l => l.trim().length > 0);
        if (csvLines.length < 2) continue; // No data rows

        const headers = csvLines[0];
        const sheetName = "Main"; // Simple fallback for now

        // Every row becomes a chunk with header and row context
        for (let i = 1; i < csvLines.length; i++) {
            const row = csvLines[i];
            allChunks.push(`[Table: ${sheetName}] | [Row: ${i}] | [Headers: ${headers}] | [Record: ${row}]`);
        }
    }

    return allChunks;
}

/**
 * Specialized chunker for SQL Dumps
 * Parsing schema (CREATE TABLE) and pairing it with INSERT INTO statements.
 */
function chunkSqlData(text: string): string[] {
    // Basic regex-based splitting by statements
    const statements = text.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length > 0);
    const schemaMap: Record<string, string> = {};
    const chunks: string[] = [];

    // First pass: Extract schemas
    for (const stmt of statements) {
        const createMatch = stmt.match(/CREATE\s+TABLE\s+[`"\[]?(\w+)[`"\]]?\s*\(([^)]+)\)/i);
        if (createMatch) {
            const tableName = createMatch[1];
            const schemaInfo = createMatch[2].replace(/\n/g, " ").trim();
            schemaMap[tableName] = schemaInfo;
        }
    }

    // Second pass: Pair data with schema
    for (const stmt of statements) {
        const insertMatch = stmt.match(/INSERT\s+INTO\s+[`"\[]?(\w+)[`"\]]?/i);
        if (insertMatch && schemaMap[insertMatch[1]]) {
            const tableName = insertMatch[1];
            chunks.push(`[SQL Table: ${tableName}] | [Schema: ${schemaMap[tableName]}] | [Statement: ${stmt}]`);
        } else {
            // Standard SQL statement or block
            chunks.push(stmt);
        }
    }

    return chunks;
}
