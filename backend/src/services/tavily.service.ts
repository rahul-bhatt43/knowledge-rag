import axios from "axios";
import { config } from "@config/env";
import logger from "@utils/logger.util";
import { ApiError } from "@utils/ApiError";

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

export interface TavilySearchResponse {
    results: TavilySearchResult[];
}

/**
 * Search the internet using Tavily API.
 */
export async function searchInternet(query: string, maxResults: number = 5): Promise<TavilySearchResult[]> {
    const apiKey = config.tavily.apiKey;

    if (!apiKey) {
        logger.warn("[Tavily] TAVILY_API_KEY is not configured. Skipping internet search.");
        return [];
    }

    try {
        logger.info(`[Tavily] Searching internet for: "${query}"`);
        const response = await axios.post<TavilySearchResponse>("https://api.tavily.com/search", {
            api_key: apiKey,
            query,
            search_depth: "advanced",
            max_results: maxResults,
            include_answer: false,
            include_images: false,
            include_raw_content: false,
        });

        return response.data.results;
    } catch (err: any) {
        logger.error("[Tavily] Search failed", err);
        // We don't want to crash the whole chat if Tavily fails, 
        // so we'll just return an empty array and log the error.
        return [];
    }
}

/**
 * Format Tavily search results into a context string for the LLM.
 */
export function formatTavilyContext(results: TavilySearchResult[]): string {
    if (results.length === 0) return "";

    return results
        .map((res, index) => `[Internet Source ${index + 1}: ${res.title}](${res.url})\n${res.content}`)
        .join("\n\n---\n\n");
}
