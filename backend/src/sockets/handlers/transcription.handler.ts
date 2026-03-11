import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middleware/socket.auth";
import { AssemblyAI, RealtimeTranscript } from "assemblyai";
import { config } from "../../config/env";
import logger from "../../utils/logger.util";

export const handleTranscriptionEvents = (io: Server, socket: AuthenticatedSocket) => {
    let rtService: any = null;
    let isReady = false;

    socket.on("transcription:start", async () => {
        try {
            if (rtService) {
                logger.warn(`[Transcription] Service already running for user ${socket.userId}`);
                return;
            }

            if (!config.assemblyai.apiKey) {
                socket.emit("transcription:error", { message: "AssemblyAI API key is not configured." });
                return;
            }

            logger.info(`[Transcription] Starting realtime service for user ${socket.userId}`);
            const client = new AssemblyAI({ apiKey: config.assemblyai.apiKey });

            // Standard web audio capture sample rate is usually 16000 or 44100.
            // When using MediaRecorder to record audio, it's often 48000 or 44100 depending on device,
            // but we can enforce 16000 on the frontend when mixing or downsampling if needed.
            // For now, let's set a standard 16000 which is common for voice.
            rtService = client.realtime.createService({ sampleRate: 16000 });

            rtService.on("transcript", (transcript: RealtimeTranscript) => {
                if (!transcript.text) return;
                socket.emit("transcript:live", transcript);
            });

            rtService.on("error", (error: Error) => {
                logger.error(`[Transcription] AssemblyAI Realtime Error: `, error);
                socket.emit("transcription:error", { message: error.message });
            });

            rtService.on("close", () => {
                isReady = false;
                logger.info(`[Transcription] AssemblyAI connection closed for user ${socket.userId}`);
            });

            await rtService.connect();
            isReady = true;
            socket.emit("transcription:ready");
        } catch (error: any) {
            logger.error(`[Transcription] Failed to start: ${error.message}`);
            socket.emit("transcription:error", { message: "Failed to initialize realtime transcription." });
        }
    });

    socket.on("audio:data", (data: Buffer | string) => {
        if (!rtService || !isReady) return;
        try {
            // If the frontend sends base64, convert it. If it's a binary Buffer, just send it.
            let bufferData;
            if (typeof data === "string") {
                const base64Data = data.split(',')[1] || data;
                bufferData = Buffer.from(base64Data, "base64");
            } else {
                bufferData = data;
            }
            if (isReady) rtService.sendAudio(bufferData);
        } catch (error: any) {
            logger.error(`[Transcription] Error sending audio data: ${error.message}`);
        }
    });

    socket.on("transcription:stop", async () => {
        if (rtService) {
            try {
                isReady = false;
                logger.info(`[Transcription] Stopping realtime service for user ${socket.userId}`);
                await rtService.close();
            } catch (error) {
                logger.error(`[Transcription] Error closing service: `, error);
            } finally {
                rtService = null;
            }
        }
    });

    socket.on("disconnect", async () => {
        if (rtService) {
            try {
                isReady = false;
                await rtService.close();
            } catch (e) {
                // ignore
            }
            rtService = null;
        }
    });
};
