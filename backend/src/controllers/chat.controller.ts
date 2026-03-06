// src/controllers/chat.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import { ApiResponse } from "@utils/ApiResponse";
import {
    streamChatAnswer,
    createChatSession,
    getChatSessions,
    getChatSessionById,
    deleteChatSession,
} from "@services/chat.service";

// ── POST /api/v1/chat/sessions ────────────────────────────────────────────────
export const createSession = asyncHandler(async (req: Request, res: Response) => {
    const { title } = req.body as { title?: string };
    const session = await createChatSession(req.user!.id.toString(), title);
    return res.status(201).json(
        new ApiResponse(201, session, "Chat session created"),
    );
});

// ── GET /api/v1/chat/sessions ─────────────────────────────────────────────────
export const listSessions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);

    const result = await getChatSessions(req.user!.id.toString(), page, limit);
    return res.json(new ApiResponse(200, result));
});

// ── GET /api/v1/chat/sessions/:sessionId ─────────────────────────────────────
export const getSession = asyncHandler(async (req: Request, res: Response) => {
    const session = await getChatSessionById(
        req.params.sessionId,
        req.user!.id.toString(),
    );
    if (!session) throw new ApiError(404, "Chat session not found");
    return res.json(new ApiResponse(200, session));
});

// ── DELETE /api/v1/chat/sessions/:sessionId ───────────────────────────────────
export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const session = await deleteChatSession(
        req.params.sessionId,
        req.user!.id.toString(),
    );
    if (!session) throw new ApiError(404, "Chat session not found");
    return res.json(new ApiResponse(200, null, "Session deleted"));
});

// ── POST /api/v1/chat/sessions/:sessionId/messages  (SSE streaming) ───────────
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body as { message: string };
    const { sessionId } = req.params;

    if (!message?.trim()) {
        throw new ApiError(400, "Message cannot be empty");
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
    res.flushHeaders();

    // Helper to write SSE events
    const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let done = false;

    await streamChatAnswer({
        sessionId,
        userId: req.user!.id.toString(),
        userMessage: message.trim(),

        onToken: (token) => {
            if (!done) sendEvent("token", { token });
        },

        onSources: (sources) => {
            if (!done) sendEvent("sources", { sources });
        },

        onComplete: () => {
            if (!done) {
                done = true;
                sendEvent("done", { status: "complete" });
                res.end();
            }
        },

        onError: (err) => {
            if (!done) {
                done = true;
                sendEvent("error", { message: err.message || "Chat failed" });
                res.end();
            }
        },
    });
});
