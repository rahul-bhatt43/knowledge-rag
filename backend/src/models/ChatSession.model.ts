// src/models/ChatSession.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IChatSource {
    documentId: string;
    fileName: string;
    chunkText: string;
    chunkIndex?: number;
}

export interface IChatMessage {
    role: "user" | "assistant";
    content: string;
    sources?: IChatSource[];
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    createdAt: Date;
}

export interface IChatSession extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    title: string;
    messages: IChatMessage[];
    totalTokensUsed: number;
    documentIds: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const ChatSourceSchema = new Schema<IChatSource>(
    {
        documentId: { type: String, required: true },
        fileName: { type: String, required: true },
        chunkText: { type: String, required: true },
        chunkIndex: { type: Number },
    },
    { _id: false },
);

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        sources: {
            type: [ChatSourceSchema],
            default: [],
        },
        tokenUsage: {
            promptTokens: { type: Number, default: 0 },
            completionTokens: { type: Number, default: 0 },
            totalTokens: { type: Number, default: 0 },
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false },
);

const ChatSessionSchema = new Schema<IChatSession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: {
            type: String,
            default: "New Chat",
            trim: true,
            maxlength: 200,
        },
        messages: {
            type: [ChatMessageSchema],
            default: [],
        },
        totalTokensUsed: {
            type: Number,
            default: 0,
        },
        documentIds: [{
            type: Schema.Types.ObjectId,
            ref: "Document",
        }],
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

ChatSessionSchema.index({ userId: 1, createdAt: -1 });

export const ChatSession = model<IChatSession>("ChatSession", ChatSessionSchema);
