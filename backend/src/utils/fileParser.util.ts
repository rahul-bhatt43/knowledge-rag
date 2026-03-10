// src/utils/fileParser.util.ts
import fs from "fs";
import path from "path";
const { PDFParse: pdfParse } = require('pdf-parse');
import logger from "@utils/logger.util";
import mammoth from "mammoth";
import * as xlsx from "xlsx";

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

    if (ext === ".docx") {
        return parseDocx(filePath);
    }

    if ([".xlsx", ".csv"].includes(ext) || effectiveMime === "text/csv") {
        return parseExcel(filePath);
    }

    if (ext === ".sql" || effectiveMime === "application/sql" || effectiveMime === "text/x-sql") {
        return parseSql(filePath);
    }

    if (ext === ".json" || effectiveMime === "application/json") {
        return parseJson(filePath);
    }

    if (
        [".txt", ".md", ".html", ".htm", ".doc"].includes(ext) ||
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

async function parseDocx(filePath: string): Promise<ParsedFile> {
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value };
}

async function parseExcel(filePath: string): Promise<ParsedFile> {
    const workbook = xlsx.readFile(filePath);
    let allText = "";
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = xlsx.utils.sheet_to_csv(sheet);
        allText += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
    }
    return { text: allText };
}

async function parseSql(filePath: string): Promise<ParsedFile> {
    const text = fs.readFileSync(filePath, "utf-8");
    return { text };
}

async function parseJson(filePath: string): Promise<ParsedFile> {
    const content = fs.readFileSync(filePath, "utf-8");
    try {
        // Validate JSON
        const parsed = JSON.parse(content);
        return { text: JSON.stringify(parsed, null, 2) };
    } catch (e) {
        throw new Error("Invalid JSON file content");
    }
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
        ".xlsx":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".csv": "text/csv",
        ".json": "application/json",
        ".sql": "application/sql",
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
