// src/services/audioIngestion.service.ts
/**
 * Audio Ingestion Pipeline:
 * Audio File → Transcription (AssemblyAI primary | OpenAI Whisper fallback)
 *           → Multi-granularity chunking (utterance + dialogue window)
 *           → Embeddings → Pinecone (default NS) + MongoDB
 *
 * Chunking strategy (2-tier):
 *  1. UTTERANCE chunks   — one per speaker turn, great for "who said what"
 *  2. WINDOW chunks      — 5-utterance sliding window (stride 2), great for
 *                          cross-speaker context: "what did A and B discuss"
 *
 * Provider selection:
 *   - ASSEMBLYAI_API_KEY set → AssemblyAI (speaker diarization + timestamps)
 *   - fallback               → OpenAI Whisper (timestamps only, no speakers)
 */

import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { config } from "@config/env";
import logger from "@utils/logger.util";
import { deleteFile } from "@utils/fileParser.util";

import { DocumentModel, DocumentStatus } from "@models/Document.model";
import { DocumentChunk } from "@models/DocumentChunk.model";

import { generateEmbeddings } from "./ai.service";
import { upsertVectors, type VectorRecord } from "./vectorDb.service";
import OpenAI from "openai";
import { AssemblyAI } from "assemblyai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptSegment {
    speaker: string;   // "SPEAKER_A" | "SPEAKER_UNKNOWN"
    text: string;
    startTime: number; // seconds
    endTime: number;   // seconds
}

interface AudioChunk {
    text: string;       // the text that gets embedded (includes labels/headers)
    speaker: string;    // primary speaker ("MULTI" for window chunks)
    startTime: number;
    endTime: number;
    chunkType: "utterance" | "window";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// ─── Multi-granularity Chunking ───────────────────────────────────────────────

/**
 * TIER 1 — Utterance chunks.
 * One chunk per speaker turn, capped at ~600 tokens (2 200 chars).
 * Long monologues are split at sentence boundaries.
 * Format: "[SPEAKER_A | 00:01:23 → 00:01:45]: <text>"
 */
function buildUtteranceChunks(segments: TranscriptSegment[]): AudioChunk[] {
    const MAX_CHARS = 2200;
    const chunks: AudioChunk[] = [];

    for (const seg of segments) {
        const prefix = `[${seg.speaker} | ${formatTime(seg.startTime)} → ${formatTime(seg.endTime)}]`;
        const fullText = `${prefix}: ${seg.text}`;

        if (fullText.length <= MAX_CHARS) {
            chunks.push({
                text: fullText,
                speaker: seg.speaker,
                startTime: seg.startTime,
                endTime: seg.endTime,
                chunkType: "utterance",
            });
        } else {
            // Split long monologues at sentence boundaries
            const sentences = seg.text.match(/[^.!?]+[.!?]+/g) ?? [seg.text];
            let current = "";
            let subStart = seg.startTime;

            for (const sentence of sentences) {
                if ((prefix + ": " + current + sentence).length > MAX_CHARS && current.length > 0) {
                    chunks.push({
                        text: `${prefix}: ${current.trim()}`,
                        speaker: seg.speaker,
                        startTime: subStart,
                        endTime: seg.endTime,
                        chunkType: "utterance",
                    });
                    current = sentence;
                    subStart = seg.startTime;
                } else {
                    current += (current ? " " : "") + sentence;
                }
            }
            if (current.trim()) {
                chunks.push({
                    text: `${prefix}: ${current.trim()}`,
                    speaker: seg.speaker,
                    startTime: subStart,
                    endTime: seg.endTime,
                    chunkType: "utterance",
                });
            }
        }
    }

    return chunks;
}

/**
 * TIER 2 — Sliding dialogue window chunks.
 * Groups WINDOW_SIZE consecutive utterances across ALL speakers.
 * Slides by STRIDE (so windows overlap by WINDOW_SIZE - STRIDE utterances).
 *
 * Captures conversational back-and-forth — answers questions like:
 *   "What did Speaker A and Speaker B agree on?"
 *   "What was discussed around 14:00?"
 *
 * Format:
 *   [Dialogue | 00:01:20 → 00:02:15]
 *   SPEAKER_A: <text>
 *   SPEAKER_B: <text>
 *   ...
 */
function buildWindowChunks(
    segments: TranscriptSegment[],
    windowSize = 5,
    stride = 2,
): AudioChunk[] {
    if (segments.length < 2) return []; // No point in window chunks for single utterance
    const chunks: AudioChunk[] = [];

    for (let i = 0; i < segments.length; i += stride) {
        const window = segments.slice(i, i + windowSize);
        if (window.length < 2) break; // skip windows too small to be meaningful

        const startTime = window[0].startTime;
        const endTime = window[window.length - 1].endTime;
        const speakers = [...new Set(window.map((s) => s.speaker))];

        const lines = window
            .map((s) => `${s.speaker}: ${s.text}`)
            .join("\n");

        const header = `[Dialogue | ${formatTime(startTime)} → ${formatTime(endTime)} | Participants: ${speakers.join(", ")}]`;
        const text = `${header}\n${lines}`;

        chunks.push({
            text,
            speaker: "MULTI",
            startTime,
            endTime,
            chunkType: "window",
        });
    }

    return chunks;
}

// ─── AssemblyAI transcription ─────────────────────────────────────────────────

async function transcribeWithAssemblyAI(filePath: string): Promise<TranscriptSegment[]> {
    logger.info("[AudioIngestion] Using AssemblyAI for transcription + speaker diarization");

    const client = new AssemblyAI({ apiKey: config.assemblyai.apiKey });

    const transcript = await client.transcripts.transcribe({
        audio: fs.createReadStream(filePath) as unknown as string,
        speech_models: ["universal-3-pro", "universal-2"],
        speaker_labels: true,
        language_detection: true,
        speakers_expected: 2,
    });

    if (transcript.status === "error") {
        throw new Error(`AssemblyAI transcription error: ${transcript.error ?? "unknown error"}`);
    }

    // Use utterances (speaker-labeled turns) — best granularity
    const utterances = transcript.utterances;
    if (utterances && utterances.length > 0) {
        return utterances.map((u) => ({
            speaker: `SPEAKER_${u.speaker}`,
            text: u.text,
            startTime: (u.start ?? 0) / 1000,
            endTime: (u.end ?? 0) / 1000,
        }));
    }

    // Word-level fallback (group by speaker)
    const words = transcript.words ?? [];
    if (words.length === 0) {
        return [{
            speaker: "SPEAKER_UNKNOWN",
            text: transcript.text ?? "",
            startTime: 0,
            endTime: transcript.audio_duration ?? 0,
        }];
    }

    const segments: TranscriptSegment[] = [];
    let current: TranscriptSegment = {
        speaker: `SPEAKER_${words[0].speaker ?? "UNKNOWN"}`,
        text: words[0].text ?? "",
        startTime: (words[0].start ?? 0) / 1000,
        endTime: (words[0].end ?? 0) / 1000,
    };

    for (let i = 1; i < words.length; i++) {
        const w = words[i];
        const spk = `SPEAKER_${w.speaker ?? "UNKNOWN"}`;
        if (spk === current.speaker) {
            current.text += " " + (w.text ?? "");
            current.endTime = (w.end ?? 0) / 1000;
        } else {
            segments.push(current);
            current = {
                speaker: spk,
                text: w.text ?? "",
                startTime: (w.start ?? 0) / 1000,
                endTime: (w.end ?? 0) / 1000,
            };
        }
    }
    segments.push(current);
    return segments;
}

// ─── Whisper fallback ─────────────────────────────────────────────────────────

async function transcribeWithWhisper(filePath: string): Promise<TranscriptSegment[]> {
    logger.info("[AudioIngestion] Using OpenAI Whisper (no speaker labels)");

    if (!config.ai.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

    const openai = new OpenAI({ apiKey: config.ai.openaiApiKey });
    const fileStream = fs.createReadStream(filePath);

    const response = await openai.audio.transcriptions.create({
        model: config.ai.whisperModel,
        file: fileStream,
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
    });

    const rawSegments = (
        response as unknown as { segments?: { start: number; end: number; text: string }[] }
    ).segments;

    if (!rawSegments || rawSegments.length === 0) {
        return [{ speaker: "SPEAKER_UNKNOWN", text: response.text, startTime: 0, endTime: 0 }];
    }

    return rawSegments.map((seg) => ({
        speaker: "SPEAKER_UNKNOWN",
        text: seg.text.trim(),
        startTime: seg.start,
        endTime: seg.end,
    }));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function ingestAudioDocument(documentId: string): Promise<void> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    logger.info(`[AudioIngestion] Starting: ${doc.fileName} (${documentId})`);

    if (!fs.existsSync(doc.filePath)) {
        doc.status = DocumentStatus.FAILED;
        doc.errorMessage = "Source audio file missing from server.";
        await doc.save();
        return;
    }

    doc.status = DocumentStatus.PROCESSING;
    doc.isAudioFile = true;
    await doc.save();

    try {
        // ── 1. Transcription ──────────────────────────────────────────────────
        const rawSegments = config.assemblyai.apiKey
            ? await transcribeWithAssemblyAI(doc.filePath)
            : await transcribeWithWhisper(doc.filePath);

        logger.info(`[AudioIngestion] ${rawSegments.length} raw utterances transcribed`);

        if (rawSegments.length === 0) throw new Error("Transcription produced no utterances.");

        // ── 2. Multi-granularity chunking ─────────────────────────────────────
        const utteranceChunks = buildUtteranceChunks(rawSegments);
        const windowChunks = buildWindowChunks(rawSegments, 5, 2);
        const allChunks: AudioChunk[] = [...utteranceChunks, ...windowChunks];

        logger.info(
            `[AudioIngestion] Chunks: ${utteranceChunks.length} utterance + ${windowChunks.length} dialogue windows = ${allChunks.length} total`,
        );

        // ── 3. Generate embeddings (batched) ──────────────────────────────────
        const chunkTexts = allChunks.map((c) => c.text);
        const allEmbeddings: number[][] = [];
        const batchSize = 20;

        for (let i = 0; i < chunkTexts.length; i += batchSize) {
            const batch = chunkTexts.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batch);
            allEmbeddings.push(...embeddings);
            logger.info(
                `[AudioIngestion] Embedded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunkTexts.length / batchSize)}`,
            );
        }

        // ── 4. Upsert to Pinecone (default namespace) ─────────────────────────
        const vectorRecords: VectorRecord[] = allChunks.map((chunk, idx) => ({
            id: uuidv4(),
            values: allEmbeddings[idx],
            metadata: {
                documentId,
                fileName: doc.fileName,
                chunkIndex: idx,
                text: chunk.text.slice(0, 1000),
                speaker: chunk.speaker,
                chunkType: chunk.chunkType,
            },
        }));

        await upsertVectors(vectorRecords);
        logger.info(`[AudioIngestion] Upserted ${vectorRecords.length} vectors to Pinecone`);

        // ── 5. Save chunks to MongoDB ─────────────────────────────────────────
        await DocumentChunk.deleteMany({ documentId });

        await DocumentChunk.insertMany(
            vectorRecords.map((record, idx) => ({
                documentId,
                chunkIndex: idx,
                text: allChunks[idx].text,
                vectorId: record.id,
                speaker: allChunks[idx].speaker,
                startTime: allChunks[idx].startTime,
                endTime: allChunks[idx].endTime,
            })),
        );

        // ── 6. Build full transcript + save metadata ──────────────────────────
        // Full transcript = only utterance chunks joined (clean readable form)
        const fullTranscript = utteranceChunks.map((c) => c.text).join("\n");
        const totalDuration = rawSegments[rawSegments.length - 1]?.endTime ?? 0;
        const uniqueSpeakers = new Set(rawSegments.map((s) => s.speaker)).size;

        doc.status = DocumentStatus.READY;
        doc.chunkCount = allChunks.length;
        doc.transcript = fullTranscript;
        doc.durationSeconds = totalDuration;
        doc.speakerCount = uniqueSpeakers;
        await doc.save();

        logger.info(
            `[AudioIngestion] ✅ Done: ${doc.fileName} — ${utteranceChunks.length} utterance + ${windowChunks.length} window chunks | ${uniqueSpeakers} speakers | ${totalDuration.toFixed(0)}s`,
        );

        deleteFile(doc.filePath);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown audio ingestion error";
        logger.error(`[AudioIngestion] ❌ Failed for ${doc.fileName}: ${message}`, err);
        doc.status = DocumentStatus.FAILED;
        doc.errorMessage = message;
        await doc.save();
        throw err;
    }
}
