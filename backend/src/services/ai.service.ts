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
1. Answer primarily using the provided context sections (Knowledge Base). 
2. If the internal context is insufficient, use the provided "SEARCH RESULTS FROM INTERNET" if available.
3. If the answer cannot be found in either the Knowledge Base or the Internet Search Results, respond with: "I could not find specific information about that in the uploaded documents or on the internet. Please check the relevant documents directly or contact your administrator."
4. Always cite the source document(s) or website(s) in your answer.
   - For documents: [Source: <FileName>]
   - For internet: [Internet Source N: <Title>](<URL>)
5. Be concise, professional, and factual.
6. If the user challenges your previous answer, re-verify the provided context and respond based ONLY on that context.
7. Never fabricate statistics, names, dates, or policies.
8. If the question is ambiguous, ask for clarification.
9. Maintain a neutral, enterprise-grade tone. No conversational filler.
10. Respond in valid Markdown. Use tables for structured data when appropriate.
11. Your primary goal is high precision and factual grounding.
`;

// ─── Query Condensation (NLP) ────────────────────────────────────────────────

/**
 * Condense a follow-up question and chat history into a standalone question.
 * This ensures vector search has enough context to find relevant results.
 */
export async function condenseQuery(
    userMessage: string,
    history: ChatMessage[],
): Promise<string> {
    if (history.length === 0) return userMessage;

    const client = getOpenAIClient();
    const historyText = history
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const prompt = `Given the following conversation history and a follow-up question, rephrase the follow-up question to be a standalone search query that can be understood without the history.

IMPORTANT RULES:
1. If the user is challenging a previous answer (e.g., "Are you sure?", "Double check", "I think that's wrong"), the standalone query MUST include the original topic/question and the specific data points being questioned.
   - Example: Chat says "Total is 60". User says "Are you sure?". Standalone: "What is the total quantity of X sold according to the documents?"
2. If the user asks for a calculation (sum, average, total), the standalone query MUST explicitly mention the requirement to find ALL relevant records.
   - Example: "Total sales". Standalone: "List all sales records and calculate the total sum."
3. If the user asks "How many", "List", "Total", the standalone query MUST capture the intent to gather multiple items.
4. Do NOT answer the question. Just return the rephrased query.
5. Keep the language technical and precise for search retrieval.

CONVERSATION HISTORY:
${historyText}

FOLLOW-UP QUESTION:
${userMessage}

STANDALONE SEARCH QUERY:`;

    try {
        const response = await client.chat.completions.create({
            model: config.ai.chatModel,
            messages: [{ role: "system", content: "You are a helpful assistant that rephrases questions for better search retrieval." }, { role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 500,
        });

        const refined = response.choices[0]?.message?.content?.trim();
        logger.debug(`[AI] Query condensed: "${userMessage}" -> "${refined}"`);
        return refined || userMessage;
    } catch (err) {
        logger.error("[AI] Query condensation failed", err);
        return userMessage; // Fallback to original
    }
}

export function detectIntent(query: string): 'AGGREGATION' | 'POSITIONAL' | 'FACT' | 'EXTERNAL' {
    const externalKeywords = [
        "constitution", "law", "act", "latest", "recent", "news", "current",
        "price", "stock", "weather", "who is", "internally", "internet",
        "online", "global", "world", "market", "competitor"
    ];

    const aggregationKeywords = [
        "total", "sum", "average", "how many", "list all", "all regions",
        "count", "aggregate", "summary of", "entire list", "every",
        "full list", "broken down by"
    ];

    const positionalKeywords = [
        "first", "last", "second", "third", "bottom", "top",
        "row 1", "row 2", "row 3", "row one", "row two", "row three",
        "row number", "position", "ranked", "starting from"
    ];

    const lowerQuery = query.toLowerCase();

    if (positionalKeywords.some(keyword => lowerQuery.includes(keyword))) {
        return 'POSITIONAL';
    }

    if (aggregationKeywords.some(keyword => lowerQuery.includes(keyword))) {
        return 'AGGREGATION';
    }

    if (externalKeywords.some(keyword => lowerQuery.includes(keyword))) {
        return 'EXTERNAL';
    }

    return 'FACT';
}

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
