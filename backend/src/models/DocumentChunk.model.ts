// src/models/DocumentChunk.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IDocumentChunk extends Document {
    _id: Types.ObjectId;
    documentId: Types.ObjectId;   // ref: Document
    chunkIndex: number;           // sequential index within the document
    text: string;                 // raw chunk text (for citations)
    vectorId: string;             // Pinecone vector ID
    pageNumber?: number;          // page in PDF this chunk belongs to
    tokenCount?: number;          // estimated token count
    // ── Audio chunk fields ────────────────────────────────────────────────
    speaker?: string;             // e.g. "SPEAKER_0", "SPEAKER_1"
    startTime?: number;           // seconds from audio start
    endTime?: number;             // seconds from audio end
    createdAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
    {
        documentId: {
            type: Schema.Types.ObjectId,
            ref: "Document",
            required: true,
            index: true,
        },
        chunkIndex: {
            type: Number,
            required: true,
            min: 0,
        },
        text: {
            type: String,
            required: true,
        },
        vectorId: {
            type: String,
            required: true,
            unique: true,
        },
        pageNumber: {
            type: Number,
        },
        tokenCount: {
            type: Number,
        },
        // ── Audio chunk fields ────────────────────────────────────────────────
        speaker: {
            type: String,
        },
        startTime: {
            type: Number,
        },
        endTime: {
            type: Number,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        toJSON: { virtuals: true },
    },
);

DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
DocumentChunkSchema.index({ vectorId: 1 });

export const DocumentChunk = model<IDocumentChunk>(
    "DocumentChunk",
    DocumentChunkSchema,
);
