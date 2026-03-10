// src/services/vectorDb.service.ts
/**
 * Reusable Vector DB Service Module
 * Handles all interactions with Pinecone: upsert, similarity search, delete
 */
import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { config } from "@config/env";
import logger from "@utils/logger.util";

let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
    if (!pineconeClient) {
        if (!config.pinecone.apiKey) {
            throw new Error("PINECONE_API_KEY is not configured");
        }
        pineconeClient = new Pinecone({ apiKey: config.pinecone.apiKey });
        logger.info("[VectorDB] Pinecone client initialized");
    }
    return pineconeClient;
}

function getIndex(namespace?: string) {
    const client = getPineconeClient();
    return client.index(config.pinecone.indexName).namespace(namespace || config.pinecone.namespace);
}

/**
 * Delete all vectors in a specific namespace (used for session cleanup)
 */
export async function deleteAllInNamespace(namespace: string): Promise<void> {
    if (!namespace) return;
    const index = getIndex(namespace);
    await index.deleteAll();
    logger.info(`[VectorDB] Deleted all vectors in namespace: ${namespace}`);
}

export interface VectorRecord {
    id: string;
    values: number[];
    metadata: RecordMetadata & {
        documentId: string;
        fileName: string;
        chunkIndex: number;
        text: string;
        pageNumber?: number;
    };
}

export interface SimilarityResult {
    id: string;
    score: number;
    metadata: VectorRecord["metadata"];
}

/**
 * Upsert a batch of vector records into Pinecone
 */
export async function upsertVectors(records: VectorRecord[], namespace?: string): Promise<void> {
    if (records.length === 0) return;

    const index = getIndex(namespace);
    const batchSize = 100; // Pinecone recommends batches of 100

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.upsert({ records: batch });
        logger.info(
            `[VectorDB] Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} vectors)`,
        );
    }
}

/**
 * Perform similarity search and return top-K results
 */
export async function similaritySearch(
    queryVector: number[],
    topK: number = config.ai.topK,
    filter?: Record<string, unknown>,
    namespace?: string,
): Promise<SimilarityResult[]> {
    const index = getIndex(namespace);

    const queryOptions: Parameters<typeof index.query>[0] = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues: false,
        ...(filter ? { filter } : {}),
    };

    const response = await index.query(queryOptions);

    return (response.matches || []).map((match) => ({
        id: match.id,
        score: match.score ?? 0,
        metadata: (match.metadata ?? {}) as VectorRecord["metadata"],
    }));
}

/**
 * Delete vectors by their IDs (used when a document is deleted)
 */
export async function deleteVectorsByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const index = getIndex();
    const batchSize = 100;

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await index.deleteMany({ ids: batch });
        logger.info(`[VectorDB] Deleted ${batch.length} vectors`);
    }
}

/**
 * Delete all vectors for a given document (by documentId metadata filter)
 * Note: Pinecone supports delete by filter only on paid plans.
 * We pass individual IDs instead (retrieved from MongoDB).
 */
export async function deleteVectorsByDocumentId(
    vectorIds: string[],
): Promise<void> {
    await deleteVectorsByIds(vectorIds);
    logger.info(
        `[VectorDB] Deleted all vectors for document (${vectorIds.length} total)`,
    );
}
