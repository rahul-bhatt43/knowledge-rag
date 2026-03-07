// src/services/chat.service.ts
/**
 * Chat / RAG Retrieval Pipeline
 * 1. Embed the user query
 * 2. Similarity search in Pinecone
 * 3. Fetch chunk texts from MongoDB
 * 4. Build grounded prompt with context + citations
 * 5. Stream the answer back via SSE
 * 6. Save message to ChatSession
 */
import { config } from "@config/env";
import logger from "@utils/logger.util";
import { ApiError } from "@utils/ApiError";

import { Schema, model, Document, Types } from "mongoose";
import { ChatSession, IChatSource, IChatMessage } from "@models/ChatSession.model";
import { DocumentChunk } from "@models/DocumentChunk.model";

import {
    generateEmbedding,
    streamChatCompletion,
    SYSTEM_PROMPT,
    type ChatMessage,
    type StreamCallbacks,
    type TokenUsage,
} from "./ai.service";
import { similaritySearch } from "./vectorDb.service";

// ─── Context building ──────────────────────────────────────────────────────────

interface RetrievedContext {
    contextString: string;
    sources: IChatSource[];
}

async function retrieveContext(
    query: string,
    topK: number = config.ai.topK,
    documentIds?: string[],
): Promise<RetrievedContext> {
    // 1. Embed the query
    const queryVector = await generateEmbedding(query);

    // 2. Similarity search in Pinecone with optional document filtering
    const filter = documentIds && documentIds.length > 0
        ? { documentId: { $in: documentIds } }
        : undefined;

    const results = await similaritySearch(queryVector, topK, filter);

    if (results.length === 0) {
        return {
            contextString: "No relevant context found in the knowledge base.",
            sources: [],
        };
    }

    // 3. Fetch full chunk text from MongoDB (Pinecone metadata is truncated)
    const vectorIds = results.map((r) => r.id);
    const chunks = await DocumentChunk.find({ vectorId: { $in: vectorIds } })
        .lean()
        .exec();

    // Build a lookup map for ordering
    const chunkMap = new Map(chunks.map((c) => [c.vectorId, c]));

    const sources: IChatSource[] = [];
    const contextParts: string[] = [];

    for (const result of results) {
        const chunk = chunkMap.get(result.id);
        const chunkText = chunk?.text ?? result.metadata?.text ?? "";
        const fileName = result.metadata?.fileName ?? "Unknown Document";
        const docId = result.metadata?.documentId ?? "";

        if (!chunkText) continue;

        contextParts.push(
            `[Source: ${fileName}]\n${chunkText}`,
        );

        sources.push({
            documentId: docId,
            fileName,
            chunkText: chunkText.slice(0, 300), // trim for response payload
            chunkIndex: chunk?.chunkIndex,
        });
    }

    return {
        contextString: contextParts.join("\n\n---\n\n"),
        sources,
    };
}

function buildChatHistory(
    messages: IChatMessage[],
    limit: number = 6,
): ChatMessage[] {
    // Include last N message pairs for multi-turn context
    const recent = messages.slice(-limit);
    return recent.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
    }));
}

// ─── Main streaming chat function ─────────────────────────────────────────────

export interface StreamChatOptions {
    sessionId: string;
    userId: string;
    userMessage: string;
    onToken: (token: string) => void;
    onSources: (sources: IChatSource[]) => void;
    onComplete: () => void;
    onError: (err: Error) => void;
}

export async function streamChatAnswer(options: StreamChatOptions): Promise<void> {
    const { sessionId, userId, userMessage, onToken, onSources, onComplete, onError } = options;

    // 1. Load the session
    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) {
        onError(new ApiError(404, "Chat session not found"));
        return;
    }

    try {
        // 2. Retrieve context with optional filtering by session's documentIds
        const { contextString, sources } = await retrieveContext(
            userMessage,
            config.ai.topK,
            session.documentIds?.map((id) => id.toString()),
        );

        // Emit sources early so the UI can render them
        onSources(sources);

        // 3. Build message array: system + history + context + current question
        const historyMessages = buildChatHistory(session.messages);

        const userPromptWithContext = `CONTEXT FROM COMPANY KNOWLEDGE BASE:
${contextString}

USER QUESTION:
${userMessage}`;

        const messages: ChatMessage[] = [
            { role: "system", content: SYSTEM_PROMPT },
            ...historyMessages,
            { role: "user", content: userPromptWithContext },
        ];

        // 4. Save the user message to session (pre-save)
        session.messages.push({
            role: "user",
            content: userMessage,
            sources: [],
            createdAt: new Date(),
        });

        // Auto-generate title from first message
        if (session.messages.length <= 2 && session.title === "New Chat") {
            session.title = userMessage.slice(0, 80);
        }

        // 5. Stream the response
        let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        const callbacks: StreamCallbacks = {
            onToken,

            onComplete: async (fullText, tokenUsage) => {
                usage = tokenUsage;

                // Save assistant message with sources and token usage
                session.messages.push({
                    role: "assistant",
                    content: fullText,
                    sources,
                    tokenUsage: {
                        promptTokens: usage.promptTokens,
                        completionTokens: usage.completionTokens,
                        totalTokens: usage.totalTokens,
                    },
                    createdAt: new Date(),
                });

                session.totalTokensUsed += usage.totalTokens;
                await session.save();

                logger.info(
                    `[Chat] Session ${sessionId} — answer streamed. Tokens: ${usage.totalTokens}`,
                );

                onComplete();
            },

            onError: (err) => {
                logger.error(`[Chat] Streaming failed for session ${sessionId}`, err);
                onError(err);
            },
        };

        await streamChatCompletion(messages, callbacks);
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error("Chat pipeline failed");
        logger.error("[Chat] streamChatAnswer error", err);
        onError(error);
    }
}

// ─── Session management helpers ───────────────────────────────────────────────

export async function createChatSession(userId: string, title?: string, documentIds?: string[]) {
    return ChatSession.create({
        userId,
        title: title ?? "New Chat",
        documentIds: (documentIds || []).map(id => new Types.ObjectId(id)),
    });
}

export async function getChatSessionUsage(sessionId: string, userId: string) {
    const session = await ChatSession.findOne({ _id: sessionId, userId })
        .select("totalTokensUsed")
        .lean();
    return session?.totalTokensUsed || 0;
}

export async function getChatSessions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
        ChatSession.find({ userId })
            .select("title totalTokensUsed createdAt updatedAt")
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ChatSession.countDocuments({ userId }),
    ]);
    return { sessions, total, page, limit };
}

export async function getChatSessionById(sessionId: string, userId: string) {
    return ChatSession.findOne({ _id: sessionId, userId }).lean();
}

export async function deleteChatSession(sessionId: string, userId: string) {
    return ChatSession.findOneAndDelete({ _id: sessionId, userId });
}

export async function updateChatSession(
    sessionId: string,
    userId: string,
    updates: { documentIds?: string[]; title?: string },
) {
    const updateData: any = {};
    if (updates.documentIds) {
        updateData.documentIds = updates.documentIds.map((id) => new Types.ObjectId(id));
    }
    if (updates.title) {
        updateData.title = updates.title;
    }

    return ChatSession.findOneAndUpdate(
        { _id: sessionId, userId },
        { $set: updateData },
        { new: true }
    ).lean();
}
