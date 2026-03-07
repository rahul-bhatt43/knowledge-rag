"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ApiService } from "@/lib/api";
import { useAuth } from "./auth-provider";

interface ChatSession {
    _id: string;
    title: string;
    createdAt: string;
}

interface ChatContextType {
    sessions: ChatSession[];
    loadingSessions: boolean;
    refreshSessions: () => Promise<void>;
    getSessionTitle: (sessionId: string | null) => string | null;
    renameSession: (sessionId: string, title: string) => Promise<void>;
    totalTokensUsed: number;
    setTotalTokensUsed: (tokens: number) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [totalTokensUsed, setTotalTokensUsed] = useState(0);

    const fetchSessions = useCallback(async () => {
        if (!user) return;
        try {
            const response = await ApiService.get<{ sessions: ChatSession[] }>("/chat/sessions");
            setSessions(response.sessions);
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setLoadingSessions(false);
        }
    }, [user]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Handle external refresh requests
    useEffect(() => {
        const handleRefresh = () => fetchSessions();
        window.addEventListener("refresh-sessions", handleRefresh);
        return () => window.removeEventListener("refresh-sessions", handleRefresh);
    }, [fetchSessions]);

    const getSessionTitle = useCallback((sessionId: string | null) => {
        if (!sessionId) return null;
        const session = sessions.find(s => s._id === sessionId);
        return session ? session.title : null;
    }, [sessions]);

    const renameSession = useCallback(async (sessionId: string, title: string) => {
        try {
            await ApiService.put(`/chat/sessions/${sessionId}`, { title });
            setSessions(current => current.map(s => s._id === sessionId ? { ...s, title } : s));
        } catch (err) {
            console.error("Failed to rename session:", err);
            throw err;
        }
    }, []);

    return (
        <ChatContext.Provider value={{
            sessions,
            loadingSessions,
            refreshSessions: fetchSessions,
            getSessionTitle,
            renameSession,
            totalTokensUsed,
            setTotalTokensUsed
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return context;
}
