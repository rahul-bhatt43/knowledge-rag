// src/models/Document.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum DocumentStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    READY = "READY",
    FAILED = "FAILED",
}

export interface IDocument extends Document {
    _id: Types.ObjectId;
    fileName: string;         // original file name as uploaded
    storedFileName: string;   // file name on disk
    filePath: string;         // absolute path on disk
    fileType: string;         // MIME type
    fileSize: number;         // bytes
    status: DocumentStatus;
    uploadedBy: Types.ObjectId;
    chunkCount: number;
    pageCount?: number;
    description?: string;
    tags?: string[];
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
    {
        fileName: {
            type: String,
            required: [true, "File name is required"],
            trim: true,
        },
        storedFileName: {
            type: String,
            required: true,
        },
        filePath: {
            type: String,
            required: true,
        },
        fileType: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: Object.values(DocumentStatus),
            default: DocumentStatus.PENDING,
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        chunkCount: {
            type: Number,
            default: 0,
        },
        pageCount: {
            type: Number,
        },
        description: {
            type: String,
            trim: true,
        },
        tags: {
            type: [String],
            default: [],
        },
        errorMessage: {
            type: String,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

DocumentSchema.index({ status: 1 });
DocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
DocumentSchema.index({ tags: 1 });

export const DocumentModel = model<IDocument>("Document", DocumentSchema);
