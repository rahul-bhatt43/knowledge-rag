"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
    Send,
    Bot,
    User,
    Loader2,
    Paperclip,
    MoreHorizontal,
    Copy,
    ThumbsUp,
    RotateCcw,
    ExternalLink,
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { API_BASE_URL, ApiService } from "@/lib/api";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "sending" | "sent" | "error";
    sources?: Array<{ documentId: string; fileName: string; chunkText: string }>;
}

export function ChatArea() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session");
    const { user } = useAuth();

    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch session history
    useEffect(() => {
        if (!sessionId) {
            setMessages([{
                id: "1",
                role: "assistant",
                content: "Hello! I'm your Company Knowledge AI. Ask me anything about our documents, policies, or project specifications.",
            }]);
            return;
        }

        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const response = await ApiService.get<{ messages: any[] }>(`/chat/sessions/${sessionId}`);
                const historicalMessages: Message[] = response.messages.map((m: any) => ({
                    id: m._id,
                    role: m.role,
                    content: m.content,
                    sources: m.metadata?.sources,
                    status: "sent"
                }));
                setMessages(historicalMessages);
            } catch (err) {
                console.error("Failed to fetch chat history:", err);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [sessionId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping || !sessionId) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            status: "sent",
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        const assistantId = "temp-" + Date.now();
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", sources: [] }]);

        try {
            const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ message: input }),
            });

            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let accumulatedContent = "";
            let currentEvent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === "[DONE]") {
                            setIsTyping(false);
                            break;
                        }

                        try {
                            const parsed = JSON.parse(dataStr);

                            if (currentEvent === "token") {
                                accumulatedContent += parsed.token || "";
                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === assistantId ? { ...msg, content: accumulatedContent } : msg
                                    )
                                );
                            } else if (currentEvent === "sources") {
                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === assistantId ? { ...msg, sources: parsed.sources } : msg
                                    )
                                );
                            } else if (currentEvent === "done") {
                                setIsTyping(false);
                            }
                        } catch (e) {
                            // Ignore parsing errors for partial or non-json data
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Streaming error:", err);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: "Sorry, I encountered an error communicating with the AI. Check your connection or retry.", status: "error" } : msg
                )
            );
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Messages Scroll Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar"
            >
                {loadingHistory ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
                    </div>
                ) : !sessionId ? (
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="text-center space-y-4 animate-in">
                            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto border border-primary/20">
                                <MessageSquare className="w-10 h-10 text-primary rotate-12" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">AI Workspace</h2>
                            <p className="text-muted-foreground max-w-sm">
                                Select an existing session from the sidebar or click "New Session" to start your RAG-powered discovery.
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={cn(
                                "flex gap-4 max-w-4xl animate-in",
                                message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                                message.role === "user" ? "bg-primary/20 text-primary" : "bg-white/10 text-white"
                            )}>
                                {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>

                            <div className="space-y-3 flex-1 min-w-0">
                                <div className={cn(
                                    "p-4 rounded-2xl text-sm leading-relaxed relative group",
                                    message.role === "user" ? "bg-primary text-primary-foreground" : "glass"
                                )}>
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                    {message.role === "assistant" && !message.content && (
                                        <div className="flex gap-1.5 p-1">
                                            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" />
                                        </div>
                                    )}

                                    {/* Sources / Citations */}
                                    {message.sources && message.sources.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Sources</p>
                                            <div className="flex flex-wrap gap-2">
                                                {message.sources.map((src, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-2 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] hover:bg-white/10 transition-colors cursor-pointer group/cit"
                                                        title={src.chunkText.slice(0, 200)}
                                                    >
                                                        <ExternalLink className="w-2.5 h-2.5 text-primary" />
                                                        <span className="max-w-[150px] truncate">{src.fileName}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className={cn(
                                        "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                                        message.role === "user" ? "right-full mr-2" : "left-full ml-2"
                                    )}>
                                        <button onClick={() => navigator.clipboard.writeText(message.content)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground transition-colors">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        {message.role === "assistant" && (
                                            <>
                                                <button className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground transition-colors">
                                                    <ThumbsUp className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 pt-0 bg-background/50 backdrop-blur-md">
                <div className={cn(
                    "max-w-4xl mx-auto glass rounded-2xl p-2 transition-all",
                    !sessionId && "opacity-50 pointer-events-none"
                )}>
                    <div className="flex items-end gap-2 pr-2">
                        <button className="p-3 text-muted-foreground hover:text-white transition-colors">
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <textarea
                            ref={inputRef}
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={sessionId ? "Ask anything about the company knowledge..." : "Click 'New Session' to start chatting"}
                            className="flex-1 max-h-48 py-3 bg-transparent border-none outline-none resize-none text-sm placeholder:text-muted-foreground/50 custom-scrollbar"
                            style={{ height: "auto" }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isTyping || !sessionId}
                            className={cn(
                                "p-3 rounded-xl transition-all shadow-lg",
                                input.trim() && sessionId ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-primary/20" : "bg-white/5 text-muted-foreground"
                            )}
                        >
                            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <p className="text-[10px] text-center mt-3 text-muted-foreground uppercase tracking-widest font-medium">
                    Company Secret AI • Grounded by RAG
                </p>
            </div>
        </div>
    );
}
