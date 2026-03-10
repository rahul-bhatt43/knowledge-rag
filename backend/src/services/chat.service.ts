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
    condenseQuery,
    detectIntent,
    type ChatMessage,
    type StreamCallbacks,
    type TokenUsage,
} from "./ai.service";
import { similaritySearch, upsertVectors, deleteAllInNamespace } from "./vectorDb.service";
import { searchInternet, formatTavilyContext } from "./tavily.service";

// ─── Context building ──────────────────────────────────────────────────────────

interface RetrievedContext {
    contextString: string;
    sources: IChatSource[];
    hasKbContext: boolean;
}

async function retrieveContext(
    query: string,
    topK: number = config.ai.topK,
    documentIds?: string[],
    sessionId?: string,
): Promise<RetrievedContext> {
    // 1. Embed the query
    const queryVector = await generateEmbedding(query);

    // 2. Similarity search in Pinecone with optional document filtering
    const filter = documentIds && documentIds.length > 0
        ? { documentId: { $in: documentIds } }
        : undefined;

    const results = await similaritySearch(queryVector, topK, filter);

    // 2.5 Query session-specific memory if sessionId is provided
    let sessionMemResults: any[] = [];
    if (sessionId) {
        sessionMemResults = await similaritySearch(
            queryVector,
            3, // top 3 from memory
            undefined,
            `chat-mem-${sessionId}`
        );
    }

    if (results.length === 0 && sessionMemResults.length === 0) {
        return {
            contextString: "No relevant context found in the knowledge base or chat history.",
            sources: [],
            hasKbContext: false,
        };
    }

    // 3. Filter results by similarity threshold
    const threshold = config.ai.similarityThreshold;
    const filteredResults = results.filter(r => r.score >= threshold);

    logger.info(`[Chat] KB Search: ${results.length} found, ${filteredResults.length} above threshold (${threshold})`);
    if (results.length > 0 && filteredResults.length === 0) {
        logger.warn(`[Chat] KB results found but all were below threshold (${results[0].score.toFixed(3)} < ${threshold})`);
    }

    if (filteredResults.length === 0 && sessionMemResults.length === 0) {
        return {
            contextString: "No relevant context found in the knowledge base or chat history.",
            sources: [],
            hasKbContext: false,
        };
    }

    // 4. Fetch full chunk text from MongoDB for filtered results
    const vectorIds = filteredResults.map((r) => r.id);
    const chunks = await DocumentChunk.find({ vectorId: { $in: vectorIds } })
        .lean()
        .exec();

    // Build a lookup map for ordering
    const chunkMap = new Map(chunks.map((c) => [c.vectorId, c]));

    const sources: IChatSource[] = [];
    const contextParts: string[] = [];

    for (const result of filteredResults) {
        const chunk = chunkMap.get(result.id);
        const chunkText = chunk?.text ?? result.metadata?.text ?? "";
        const fileName = result.metadata?.fileName ?? "Unknown Document";
        const docId = result.metadata?.documentId ?? "";

        if (!chunkText) continue;

        contextParts.push(
            `[Source: ${fileName}] (Score: ${result.score.toFixed(3)})\n${chunkText}`,
        );

        sources.push({
            documentId: docId,
            fileName,
            chunkText: chunkText.slice(0, 300), // trim for response payload
            chunkIndex: chunk?.chunkIndex,
        });
    }

    // Add session memory to context if available
    for (const res of sessionMemResults) {
        const text = res.metadata?.text || "";
        if (!text) continue;
        contextParts.push(`[Source: Previous Chat Memory]\n${text}`);
    }

    return {
        contextString: contextParts.join("\n\n---\n\n"),
        sources,
        hasKbContext: filteredResults.length > 0,
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
        // 2. Query refinement: Get standalone question for retrieval
        const historyMessages = buildChatHistory(session.messages);
        const condensedQueryText = await condenseQuery(userMessage, historyMessages);

        // 3. Detect intent and determine Top-K
        const intent = detectIntent(condensedQueryText);
        const dynamicTopK = (intent === 'AGGREGATION' || intent === 'POSITIONAL') ? 1000 : config.ai.topK;
        logger.info(`[Chat] Detected intent: ${intent}. Using Top-K: ${dynamicTopK}`);

        // 4. Retrieve context with optional filtering and session memory
        let { contextString, sources, hasKbContext } = await retrieveContext(
            condensedQueryText,
            dynamicTopK,
            session.documentIds?.map((id) => id.toString()),
            sessionId,
        );

        // --- Tavily Fallback Logic ---
        // Trigger if NO results found in KB OR if intent is explicitly EXTERNAL
        const shouldSearchInternet = !hasKbContext || intent === 'EXTERNAL';

        if (shouldSearchInternet) {
            const reason = !hasKbContext ? "No KB context" : "External intent detected";
            logger.info(`[Chat] Triggering Tavily search. Reason: ${reason} for query: "${condensedQueryText}"`);

            const webResults = await searchInternet(condensedQueryText);
            if (webResults.length > 0) {
                const webContext = formatTavilyContext(webResults);

                // If there's already session memory or weak KB context, append web results
                if (contextString.includes("No relevant context found")) {
                    contextString = `SEARCH RESULTS FROM INTERNET:\n${webContext}`;
                } else {
                    contextString += `\n\n---\n\nSEARCH RESULTS FROM INTERNET:\n${webContext}`;
                }

                // Add web sources to the sources list for UI citations
                webResults.forEach((res, i) => {
                    sources.push({
                        documentId: `web-${i}`,
                        fileName: res.title,
                        chunkText: res.content,
                    });
                });
            }
        }
        // -----------------------------

        // Emit sources early so the UI can render them
        onSources(sources);

        // 4. Build message array: system + history + context + current question
        const userPromptWithContext = `CONTEXT FROM COMPANY KNOWLEDGE BASE AND PREVIOUS CHAT:
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

                // 7. Index new messages into session memory namespace
                try {
                    const [userVec, assistantVec] = await Promise.all([
                        generateEmbedding(userMessage),
                        generateEmbedding(fullText)
                    ]);
                    const namespace = `chat-mem-${sessionId}`;

                    await upsertVectors([
                        {
                            id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            values: userVec,
                            metadata: {
                                documentId: "session-memory",
                                fileName: "Chat History",
                                chunkIndex: session.messages.length - 2,
                                text: userMessage,
                            }
                        },
                        {
                            id: `a-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            values: assistantVec,
                            metadata: {
                                documentId: "session-memory",
                                fileName: "Chat History",
                                chunkIndex: session.messages.length - 1,
                                text: fullText,
                            }
                        }
                    ], namespace);
                } catch (memErr) {
                    logger.error(`[Chat] Failed to index session memory for ${sessionId}`, memErr);
                }

                logger.info(
                    `[Chat] Session ${sessionId} — answer streamed and indexed. Tokens: ${usage.totalTokens}`,
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
    const session = await ChatSession.findOneAndDelete({ _id: sessionId, userId });
    if (session) {
        // Clean up session-specific vector memory in the background
        deleteAllInNamespace(`chat-mem-${sessionId}`).catch((err) => {
            logger.error(`[Chat] Failed to clean up session memory for ${sessionId}`, err);
        });
    }
    return session;
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
