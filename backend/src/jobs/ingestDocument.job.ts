// src/jobs/ingestDocument.job.ts
/**
 * BullMQ-based document ingestion job with graceful fallback.
 *
 * When Redis is available (BULLMQ_REDIS_URL is set to a real instance):
 *   → Jobs are queued and processed asynchronously by a BullMQ Worker.
 *
 * When Redis is NOT available (local dev without Redis):
 *   → Falls back to in-process setImmediate() — runs async but in the same Node process.
 *   → No queue management, no retries, no job persistence.
 */
import { config } from "@config/env";
import logger from "@utils/logger.util";
import { ingestDocument } from "@services/ingestion.service";

// ─── BullMQ types (only imported if Redis is available) ──────────────────────

type BullQueue = import("bullmq").Queue;
type BullWorker = import("bullmq").Worker;

let queue: BullQueue | null = null;
let worker: BullWorker | null = null;

const QUEUE_NAME = "document-ingestion";

// ─── Initialize BullMQ (conditionally) ───────────────────────────────────────

async function initBullMQ(): Promise<boolean> {
    if (!config.bullmq.enabled || !config.bullmq.redisUrl) {
        logger.warn(
            "[Jobs] BullMQ disabled — Redis not configured. Using in-process fallback.",
        );
        return false;
    }

    try {
        const { Queue, Worker } = await import("bullmq");
        const { default: IORedis } = await import("ioredis");

        const connection = new IORedis(config.bullmq.redisUrl, {
            maxRetriesPerRequest: null,
        });

        queue = new Queue(QUEUE_NAME, { connection });

        worker = new Worker(
            QUEUE_NAME,
            async (job) => {
                const { documentId } = job.data as { documentId: string };
                logger.info(`[Jobs] Processing ingestion job for document: ${documentId}`);
                await ingestDocument(documentId);
            },
            {
                connection,
                concurrency: 2,
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 50 },
            },
        );

        worker.on("completed", (job) => {
            logger.info(`[Jobs] ✅ Ingestion job ${job.id} completed`);
        });

        worker.on("failed", (job, err) => {
            logger.error(`[Jobs] ❌ Ingestion job ${job?.id} failed: ${err.message}`);
        });

        logger.info("[Jobs] BullMQ queue and worker initialized (Redis mode)");
        return true;
    } catch (err) {
        logger.error("[Jobs] Failed to initialize BullMQ — falling back to in-process", err);
        return false;
    }
}

let bullmqReady: boolean | null = null;

async function isRedisReady(): Promise<boolean> {
    if (bullmqReady === null) {
        bullmqReady = await initBullMQ();
    }
    return bullmqReady;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue a document ingestion job.
 *
 * Uses BullMQ if Redis is available, otherwise falls back to in-process async execution.
 */
export async function enqueueIngestionJob(documentId: string): Promise<void> {
    const useRedis = await isRedisReady();

    if (useRedis && queue) {
        // ── BullMQ path ──────────────────────────────────────────────────────────
        const job = await queue.add(
            "ingest",
            { documentId },
            {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        logger.info(
            `[Jobs] Queued ingestion job ${job.id} for document: ${documentId}`,
        );
    } else {
        // ── In-process fallback ──────────────────────────────────────────────────
        logger.info(
            `[Jobs] In-process ingestion started for document: ${documentId}`,
        );
        setImmediate(async () => {
            try {
                await ingestDocument(documentId);
                logger.info(
                    `[Jobs] In-process ingestion completed for: ${documentId}`,
                );
            } catch (err) {
                logger.error(
                    `[Jobs] In-process ingestion failed for: ${documentId}`,
                    err,
                );
            }
        });
    }
}

/**
 * Gracefully close BullMQ connections (call on server shutdown)
 */
export async function closeJobQueue(): Promise<void> {
    if (worker) await worker.close();
    if (queue) await queue.close();
    logger.info("[Jobs] BullMQ connections closed");
}
