// src/config/multer.config.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import { config } from "@config/env";
import { ApiError } from "@utils/ApiError";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), config.upload.dir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9]/g, "_")
            .slice(0, 50);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
) => {
    const allowed = config.upload.allowedMimeTypes;
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [
        // Documents
        ".pdf",
        ".txt",
        ".md",
        ".html",
        ".doc",
        ".docx",
        ".xlsx",
        ".csv",
        ".json",
        ".sql",
        // Audio / Video
        ".mp3",
        ".wav",
        ".ogg",
        ".m4a",
        ".mp4",
        ".webm",
        ".mov",
    ];

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                `Unsupported file type: ${file.mimetype}. Allowed: PDF, TXT, MD, HTML, DOC, DOCX, XLSX, CSV, JSON, SQL, MP3, WAV, OGG, M4A, MP4, WEBM, MOV`,
            ),
        );
    }
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        // Allow up to 500 MB to cover large audio/video meeting recordings.
        // The controller validates file size further per type if needed.
        fileSize: 500 * 1024 * 1024,
        files: 5,
    },
});
