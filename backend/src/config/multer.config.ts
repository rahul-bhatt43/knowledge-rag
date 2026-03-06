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
    const allowedExts = [".pdf", ".txt", ".md", ".html", ".doc", ".docx"];

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                `Unsupported file type: ${file.mimetype}. Allowed: PDF, TXT, MD, HTML, DOC, DOCX`,
            ),
        );
    }
};

export const uploadMiddleware = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.upload.maxFileSizeMb * 1024 * 1024, // convert MB to bytes
        files: 5, // max 5 files per request
    },
});
