// src/utils/fileParser.util.ts
import fs from "fs";
import path from "path";
const { PDFParse: pdfParse } = require('pdf-parse');
import logger from "@utils/logger.util";

export interface ParsedFile {
    text: string;
    pageCount?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Parse text content from an uploaded file based on its extension / MIME type.
 */
export async function parseFile(
    filePath: string,
    mimeType?: string,
): Promise<ParsedFile> {
    const ext = path.extname(filePath).toLowerCase();
    const effectiveMime = mimeType || getMimeFromExt(ext);

    logger.info(`[FileParser] Parsing file: ${filePath} (${effectiveMime})`);

    if (effectiveMime === "application/pdf" || ext === ".pdf") {
        return parsePdf(filePath);
    }

    if (
        [".txt", ".md", ".html", ".htm", ".doc", ".docx"].includes(ext) ||
        effectiveMime.startsWith("text/")
    ) {
        return parseText(filePath);
    }

    throw new Error(`Unsupported file type: ${effectiveMime} (${ext})`);
}

async function parsePdf(filePath: string): Promise<ParsedFile> {
    const buffer = fs.readFileSync(filePath);
    const parser = new pdfParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
        text: textResult.text,
        pageCount: textResult.total,
        metadata: { info: infoResult.info },
    };
}

async function parseText(filePath: string): Promise<ParsedFile> {
    const text = fs.readFileSync(filePath, "utf-8");
    return { text };
}

function getMimeFromExt(ext: string): string {
    const map: Record<string, string> = {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".html": "text/html",
        ".htm": "text/html",
        ".doc": "application/msword",
        ".docx":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return map[ext] || "application/octet-stream";
}

/**
 * Delete a file from disk (used after ingestion if cleanup is desired)
 */
export function deleteFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`[FileParser] Deleted temp file: ${filePath}`);
        }
    } catch (err) {
        logger.warn(`[FileParser] Could not delete file: ${filePath}`, err);
    }
}
