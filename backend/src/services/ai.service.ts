// src/services/ai.service.ts
/**
 * Enterprise AI Service Wrapper
 * Handles OpenAI embeddings + streaming chat completions with:
 * - Retry logic (exponential backoff)
 * - Token usage tracking
 * - Guardrails against hallucination
 * - Structured error handling
 */
import OpenAI from "openai";
import { config } from "@config/env";
import logger from "@utils/logger.util";
import { ApiError } from "@utils/ApiError";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        if (!config.ai.openaiApiKey) {
            throw new ApiError(500, "OPENAI_API_KEY is not configured");
        }
        openaiClient = new OpenAI({
            apiKey: config.ai.openaiApiKey,
            maxRetries: config.ai.maxRetries,
            timeout: 60_000,
        });
        logger.info("[AI] OpenAI client initialized");
    }
    return openaiClient;
}

// ─── Token usage tracker ────────────────────────────────────────────────────
let totalTokensUsed = 0;

export function getTotalTokensUsed(): number {
    return totalTokensUsed;
}

// ─── Embedding ───────────────────────────────────────────────────────────────

/**
 * Generate an embedding vector for the given text.
 * Uses text-embedding-ada-002, with automatic retries via OpenAI SDK.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const client = getOpenAIClient();

    // Truncate to avoid exceeding model token limit (~8191 for ada-002)
    const truncated = text.slice(0, 30000);

    try {
        const response = await client.embeddings.create({
            model: config.ai.embeddingModel,
            input: truncated,
        });

        const tokens = response.usage?.total_tokens ?? 0;
        totalTokensUsed += tokens;
        logger.debug(`[AI] Embedding generated — tokens used: ${tokens}`);

        return response.data[0].embedding;
    } catch (err: unknown) {
        logger.error("[AI] Embedding failed", err);
        throw handleOpenAIError(err);
    }
}

/**
 * Generate embeddings for multiple texts in a single batch request
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const client = getOpenAIClient();
    const truncated = texts.map((t) => t.slice(0, 30000));

    try {
        const response = await client.embeddings.create({
            model: config.ai.embeddingModel,
            input: truncated,
        });

        const tokens = response.usage?.total_tokens ?? 0;
        totalTokensUsed += tokens;
        logger.info(`[AI] Batch embeddings (${texts.length}) — tokens: ${tokens}`);

        // Preserve original order
        return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    } catch (err: unknown) {
        logger.error("[AI] Batch embedding failed", err);
        throw handleOpenAIError(err);
    }
}

// ─── System prompt & guardrails ──────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a helpful AI assistant for an internal company knowledge base.

RULES (strictly follow these):
1. Answer ONLY using the provided context sections. Do NOT use any outside knowledge.
2. If the answer cannot be found in the provided context, respond with: "I could not find specific information about that in the uploaded documents. Please check the relevant documents directly or contact your administrator."
3. Always cite the source document(s) in your answer using the format: [Source: <FileName>]
4. Be concise, professional, and factual.
5. Never fabricate statistics, names, dates, or policies.
6. If the question is ambiguous, ask for clarification.`;

// ─── Chat Completion (Streaming) ─────────────────────────────────────────────

export type ChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onComplete: (fullText: string, usage: TokenUsage) => void;
    onError: (error: Error) => void;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/**
 * Stream a chat completion response using SSE.
 * onToken is called for each delta token. onComplete is called at the end.
 */
export async function streamChatCompletion(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
): Promise<void> {
    const client = getOpenAIClient();
    let fullText = "";

    try {
        const stream = await client.chat.completions.create({
            model: config.ai.chatModel,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            temperature: 0.2,        // low temperature = more factual
            max_tokens: 2048,
        });

        let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                fullText += delta;
                callbacks.onToken(delta);
            }

            // Capture usage from the final chunk
            if (chunk.usage) {
                usage = {
                    promptTokens: chunk.usage.prompt_tokens,
                    completionTokens: chunk.usage.completion_tokens,
                    totalTokens: chunk.usage.total_tokens,
                };
                totalTokensUsed += usage.totalTokens;
                logger.info(`[AI] Chat completion — tokens: ${JSON.stringify(usage)}`);
            }
        }

        callbacks.onComplete(fullText, usage);
    } catch (err: unknown) {
        const error = handleOpenAIError(err);
        logger.error("[AI] Chat completion stream failed", err);
        callbacks.onError(error);
    }
}

// ─── Error handling ───────────────────────────────────────────────────────────

function handleOpenAIError(err: unknown): ApiError {
    if (err instanceof OpenAI.APIError) {
        const status = err.status ?? 500;
        if (status === 429) {
            return new ApiError(429, "AI service rate limit reached. Please try again in a moment.");
        }
        if (status === 401) {
            return new ApiError(500, "AI service authentication failed. Check OPENAI_API_KEY.");
        }
        if (status >= 500) {
            return new ApiError(503, "AI service is temporarily unavailable. Please retry.");
        }
        return new ApiError(status, `AI service error: ${err.message}`);
    }
    if (err instanceof Error) {
        return new ApiError(500, `AI error: ${err.message}`);
    }
    return new ApiError(500, "Unknown AI service error");
}
