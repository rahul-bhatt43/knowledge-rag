// src/routes/chat.routes.ts
import { Router } from "express";
import { authenticate } from "@middlewares/auth.middleware";
import { validate } from "@middlewares/validation.middleware";
import {
    createSession,
    listSessions,
    getSession,
    sendMessage,
    deleteSession,
} from "@controllers/chat.controller";
import {
    createSessionValidator,
    sendMessageValidator,
    sessionIdValidator,
    listSessionsValidator,
} from "@validators/chat.validator";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// ── Create a new chat session ─────────────────────────────────────────────────
router.post(
    "/sessions",
    createSessionValidator,
    validate,
    createSession,
);

// ── List all sessions for the current user ────────────────────────────────────
router.get(
    "/sessions",
    listSessionsValidator,
    validate,
    listSessions,
);

// ── Get a single session with full message history ────────────────────────────
router.get(
    "/sessions/:sessionId",
    sessionIdValidator,
    validate,
    getSession,
);

// ── Send a message (SSE streaming) ───────────────────────────────────────────
router.post(
    "/sessions/:sessionId/messages",
    sendMessageValidator,
    validate,
    sendMessage,
);

// ── Delete a session ──────────────────────────────────────────────────────────
router.delete(
    "/sessions/:sessionId",
    sessionIdValidator,
    validate,
    deleteSession,
);

export default router;
