"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
    MessageSquare,
    Sparkles,
    Search,
    BookOpen,
    Mic,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { API_BASE_URL, ApiService } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    status?: "sending" | "sent" | "error";
    sources?: Array<{ documentId: string; fileName: string; chunkText: string; chunkIndex?: number }>;
    tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export function ChatArea() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionId = searchParams.get("session");
    const { user } = useAuth();

    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [totalTokensUsed, setTotalTokensUsed] = useState(0);
    const [availableDocs, setAvailableDocs] = useState<any[]>([]);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showDocManager, setShowDocManager] = useState(false);

    // Voice to Text State
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const handleCopy = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const skipNextHistoryFetch = useRef(false);

    // Initialize Speech Recognition
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.lang = "en-US";

                recognition.onstart = () => {
                    setIsListening(true);
                };

                recognition.onresult = (event: any) => {
                    let finalTranscript = '';
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    if (finalTranscript) {
                        setInput(prev => prev + (prev ? " " : "") + finalTranscript);
                    } else if (interimTranscript) {
                        // Optional interim handling
                    }
                };

                recognition.onerror = (event: any) => {
                    console.error("Speech recognition error", event.error);
                    setIsListening(false);
                };

                recognition.onend = () => {
                    setIsListening(false);
                    // We don't auto-send here because user might want to edit.
                    // If auto-send is strictly required by the prompt, we could, but letting them review is safer.
                    // Actually, the user specifically requested "when the user is done we must send the message".
                    // I will implement a custom send execution here. See handleVoiceComplete.
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    // Auto-send when voice input completes with text
    useEffect(() => {
        // If we just stopped listening and we had input that was populated by voice,
        // we could auto-send. However, `onEnd` doesn't pass the final text reliably if we use state hook dependency.
        // A cleaner approach: wrap handleSend in a ref so we can call it within onend without stale closures.
    }, [isListening]);

    // Better Auto-send effect
    const inputRefState = useRef(input);
    const isSendingVoiceRef = useRef(false);

    useEffect(() => {
        inputRefState.current = input;
    }, [input]);

    useEffect(() => {
        if (!isListening && isSendingVoiceRef.current && inputRefState.current.trim().length > 0) {
            isSendingVoiceRef.current = false;
            // Use querySelector to safely find and click the active send button
            const sendButton = document.getElementById("chat-send-btn");
            if (sendButton && !sendButton.hasAttribute("disabled")) {
                sendButton.click();
            }
        }
    }, [isListening]);


    // Fetch available documents for selection
    useEffect(() => {
        const fetchDocs = async () => {
            setIsLoadingDocs(true);
            try {
                const response = await ApiService.get<any>("/documents?status=READY&limit=100");
                setAvailableDocs(response.documents || []);
            } catch (err) {
                console.error("Failed to fetch documents:", err);
            } finally {
                setIsLoadingDocs(false);
            }
        };
        fetchDocs();
    }, []);

    // Fetch session history and token usage
    useEffect(() => {
        if (!sessionId) {
            setMessages([{
                id: "1",
                role: "assistant",
                content: "Hello! I'm your AI assistant. I can help you discover insights from your company documents with precision.",
            }]);
            setTotalTokensUsed(0);
            return;
        }

        // Skip history fetch if we just created this session locally
        if (skipNextHistoryFetch.current) {
            skipNextHistoryFetch.current = false;
            return;
        }

        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const response = await ApiService.get<any>(`/chat/sessions/${sessionId}`);
                const historicalMessages: Message[] = response.messages.map((m: any) => ({
                    id: m._id || `msg-${Date.now()}-${Math.random()}`,
                    role: m.role,
                    content: m.content,
                    sources: m.metadata?.sources || m.sources, // support both formats
                    status: "sent",
                    tokenUsage: m.tokenUsage,
                }));
                setMessages(historicalMessages);
                setTotalTokensUsed(response.totalTokensUsed || 0);
                setSelectedDocIds(response.documentIds || []);
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
    }, [messages, isTyping, isThinking]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        let currentSessionId = sessionId;
        const isNewSession = !currentSessionId;

        setIsThinking(true);
        setIsTyping(true);

        try {
            // 1. If no session, create one first with selected documents
            if (isNewSession) {
                const sessionResponse = await ApiService.post<{ _id: string }>("/chat/sessions", {
                    title: input.slice(0, 50),
                    documentIds: selectedDocIds,
                });
                currentSessionId = sessionResponse._id;

                // Prevent the subsequent sessionId change from fetching history
                skipNextHistoryFetch.current = true;
                router.push(`/?session=${currentSessionId}`);

                // Refresh sidebar
                window.dispatchEvent(new CustomEvent("refresh-sessions"));
            }

            const timestamp = Date.now();
            const userMessage: Message = {
                id: `user-${timestamp}`,
                role: "user",
                content: input,
                status: "sent",
            };

            setMessages((prev) => isNewSession ? [userMessage] : [...prev, userMessage]);
            const originalInput = input;
            setInput("");

            const assistantId = `bot-${timestamp}`;
            // Initially thinking state
            setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", sources: [] }]);

            const response = await fetch(`${API_BASE_URL}/chat/sessions/${currentSessionId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ message: originalInput }),
            });

            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let accumulatedContent = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ""; // Keep the last incomplete line in the buffer

                let currentEvent = "";

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === "[DONE]") {
                            setIsTyping(false);
                            setIsThinking(false);
                            // Fetch updated token usage
                            const usageRes = await ApiService.get<any>(`/chat/sessions/${currentSessionId}/usage`);
                            setTotalTokensUsed(usageRes.totalTokensUsed);
                            break;
                        }

                        try {
                            const parsed = JSON.parse(dataStr);

                            if (currentEvent === "token") {
                                // Once first token arrives, stop thinking
                                if (isThinking) setIsThinking(false);

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
                                setIsThinking(false);
                                // Fetch updated token usage
                                const usageRes = await ApiService.get<any>(`/chat/sessions/${currentSessionId}/usage`);
                                setTotalTokensUsed(usageRes.totalTokensUsed);
                            }
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Chat error:", err);
            setIsThinking(false);
            setIsTyping(false);
            // If it was a new session that failed creation, we might not have a bot message yet
            setMessages((prev) => {
                const assistantExists = prev.find(m => m.role === "assistant" && m.id.startsWith("bot-"));
                if (assistantExists) {
                    return prev.map((msg) =>
                        msg.role === "assistant" && msg.id.startsWith("bot-") && !msg.content ? { ...msg, content: "Sorry, I encountered an error. Please try again.", status: "error" } : msg
                    );
                }
                return [...prev, { id: `error-${Date.now()}`, role: "assistant", content: "Sorry, I couldn't start this session. Please check your connection.", status: "error" }];
            });
        }
    };

    const handleUpdateDocs = async () => {
        if (!sessionId) return;
        try {
            await ApiService.put(`/chat/sessions/${sessionId}`, { documentIds: selectedDocIds });
            setShowDocManager(false);
        } catch (err) {
            console.error("Failed to update session docs:", err);
        }
    };

    return (
        <div className="flex flex-col h-full relative bg-background">
            {/* Background Decor */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

            {/* Sticky Header for Active Session */}
            {sessionId && !loadingHistory && (
                <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-8 py-3">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold opacity-80">Current Session</span>
                            <span className="text-xs text-muted-foreground">{messages.length > 1 ? messages[1].content.slice(0, 30) + '...' : 'New Chat'}</span>
                        </div>
                        <button
                            onClick={() => setShowDocManager(!showDocManager)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-bold",
                                showDocManager
                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                    : "border-border bg-foreground/5 hover:bg-foreground/10 text-foreground"
                            )}
                        >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Knowledge Sources ({selectedDocIds.length})</span>
                        </button>
                    </div>

                    {showDocManager && (
                        <div className="max-w-4xl mx-auto mt-4 p-5 border border-border rounded-3xl bg-foreground/2 space-y-5 shadow-2xl mb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary" />
                                    <h3 className="text-[10px] font-black tracking-[0.2em] uppercase opacity-60">Manage Linked Documents</h3>
                                </div>
                                <button
                                    onClick={handleUpdateDocs}
                                    className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                                >
                                    <Check className="w-3.5 h-3.5" /> Save Changes
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 w-full max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
                                {availableDocs.map((doc) => {
                                    const isSelected = selectedDocIds.includes(doc._id);
                                    return (
                                        <button
                                            key={doc._id}
                                            onClick={() => {
                                                setSelectedDocIds(prev =>
                                                    isSelected ? prev.filter(id => id !== doc._id) : [...prev, doc._id]
                                                );
                                            }}
                                            className={cn(
                                                "group relative p-2.5 rounded-xl border transition-all duration-300 text-left backdrop-blur-sm shadow-sm",
                                                isSelected
                                                    ? "bg-primary/15 border-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                                    : "bg-background border-border hover:border-foreground/20 hover:bg-foreground/5 flex-row"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300",
                                                    isSelected
                                                        ? "bg-primary border-primary shadow-md shadow-primary/20 scale-105"
                                                        : "bg-foreground/5 border-border text-muted-foreground group-hover:scale-105"
                                                )}>
                                                    <Paperclip className={cn("w-3 h-3 transition-colors", isSelected ? "text-primary-foreground" : "opacity-40")} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn("text-[11px] font-bold truncate transition-colors", isSelected ? "text-foreground" : "opacity-60")}>
                                                        {doc.fileName}
                                                    </p>
                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-widest font-black mt-0.5 opacity-40">
                                                        {doc.chunkCount} Chunks
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {availableDocs.length === 0 && (
                                <p className="text-xs text-muted-foreground italic text-center py-2">No documents available to link.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Scroll Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8 pt-4 space-y-10 custom-scrollbar relative z-10"
            >
                {loadingHistory ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-20">Syncing History</p>
                        </div>
                    </div>
                ) : !sessionId ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 max-w-4xl mx-auto space-y-16 animate-in fade-in zoom-in duration-1000">
                        <div className="text-center space-y-6">
                            <div className="relative mx-auto w-24 h-24 mb-8">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                                <div className="relative w-24 h-24 bg-foreground/5 border border-border rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-2xl">
                                    <Sparkles className="w-12 h-12 text-primary animate-bounce fill-primary/10" />
                                </div>
                            </div>
                            <h2 className="text-5xl font-black tracking-tight text-foreground">Knowledge<span className="text-primary">Discovery</span></h2>
                            <p className="text-muted-foreground max-w-md mx-auto text-base font-medium leading-relaxed opacity-60">
                                Harness the power of your institutional knowledge. Select documents below to prioritize specific data sources.
                            </p>
                        </div>

                        <div className="w-full space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                    <BookOpen className="w-4 h-4 text-primary" />
                                    <span className="text-xs uppercase tracking-[0.4em] font-black opacity-40">Knowledge Sources</span>
                                </div>
                                <span className="text-[10px] font-bold opacity-20 uppercase tracking-widest">{availableDocs.length} Available</span>
                            </div>

                            {isLoadingDocs ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4 glass rounded-3xl border border-border">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                                    <p className="text-[10px] uppercase tracking-widest font-black opacity-20">Indexing Knowledge Base</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                    {availableDocs.map((doc) => {
                                        const isSelected = selectedDocIds.includes(doc._id);
                                        return (
                                            <button
                                                key={doc._id}
                                                onClick={() => {
                                                    setSelectedDocIds(prev =>
                                                        isSelected ? prev.filter(id => id !== doc._id) : [...prev, doc._id]
                                                    );
                                                }}
                                                className={cn(
                                                    "group relative p-4 rounded-2xl border transition-all duration-300 text-left backdrop-blur-sm",
                                                    isSelected
                                                        ? "bg-primary/15 border-primary/50 shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]"
                                                        : "bg-foreground/2 border-border hover:border-foreground/20 hover:bg-foreground/5"
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                                                        isSelected
                                                            ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-110"
                                                            : "bg-foreground/5 border-border text-muted-foreground group-hover:scale-110"
                                                    )}>
                                                        <Paperclip className={cn("w-5 h-5 transition-colors", isSelected ? "text-primary-foreground" : "opacity-40")} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn("text-sm font-bold truncate transition-colors", isSelected ? "text-foreground" : "opacity-60")}>
                                                            {doc.fileName}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black mt-1 opacity-40">
                                                            {doc.chunkCount} Knowledge Chunks
                                                        </p>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20">
                                                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {!isLoadingDocs && availableDocs.length === 0 && (
                                <div className="text-center p-12 rounded-3xl border border-dashed border-white/10 bg-white/2 animate-in fade-in duration-500">
                                    <p className="text-sm text-muted-foreground font-medium italic opacity-50">No processed documents found. Upload documents to activate the RAG engine.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "flex gap-6 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500",
                                    message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                )}
                            >
                                {/* Avatar section */}
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden",
                                    message.role === "user" ? "bg-foreground/5 border border-border" : "bg-primary text-primary-foreground"
                                )}>
                                    {message.role === "user" ? <User className="w-5 h-5 text-muted-foreground" /> : <Sparkles className="w-5 h-5 fill-primary-foreground/20" />}
                                    {message.role === "assistant" && isTyping && message.id.startsWith("bot-") && !message.content && (
                                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    )}
                                </div>

                                <div className="space-y-4 flex-1 min-w-0">
                                    <div className={cn(
                                        "p-2 rounded-4xl text-[15px] leading-7 relative group transition-all duration-500",
                                        message.role === "user"
                                            ? "bg-foreground/5 border border-border text-foreground rounded-tr-none px-6 text-right ml-auto w-fit"
                                            : "rounded-tl-none bg-inherit border-none shadow-none"
                                    )}>
                                        {message.role === "assistant" && !message.content && isThinking ? (
                                            <div className="flex flex-col gap-3 py-1">
                                                <div className="flex items-center gap-3 text-primary/50">
                                                    <Search className="w-4 h-4 animate-pulse" />
                                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black italic">Consulting Knowledge Base...</p>
                                                </div>
                                                <div className="flex gap-1.5 px-0.5">
                                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                    <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={cn(
                                                "prose prose-sm dark:prose-invert max-w-none transition-all duration-500 leading-relaxed",
                                                message.role === "assistant" && "animate-in fade-in duration-500"
                                            )}>
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4" {...props} />,
                                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4" {...props} />,
                                                        li: ({ node, ...props }) => <li className="mb-2" {...props} />,
                                                        code: ({ node, inline, ...props }: any) =>
                                                            inline
                                                                ? <code className="bg-foreground/10 px-1.5 py-0.5 rounded text-xs" {...props} />
                                                                : <code className="block bg-foreground/5 p-4 rounded-xl border border-border my-4 text-xs overflow-x-auto" {...props} />
                                                    }}
                                                >
                                                    {message.content + (message.role === "assistant" && isTyping && message.id.startsWith("bot-") && message.content ? " ▍" : "")}
                                                </ReactMarkdown>
                                            </div>
                                        )}


                                        {/* Sources Panel */}
                                        {message.sources && message.sources.length > 0 && (!isTyping || messages[messages.length - 1].id !== message.id) && (
                                            <div className="mt-6 pt-6 border-t border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                                                    <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30">Verified Context</p>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {message.sources.map((src, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="group/cit flex items-center gap-3 p-3 bg-foreground/5 border border-border rounded-2xl text-[11px] hover:border-primary/30 transition-all cursor-pointer overflow-visible relative"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 border border-border group-hover/cit:bg-primary group-hover/cit:text-primary-foreground transition-colors">
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0 relative z-10">
                                                                <span className="font-bold text-foreground block truncate">{src.fileName}</span>
                                                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Chunk #{src.chunkIndex}</span>
                                                            </div>

                                                            {/* Enhanced Tooltip */}
                                                            <div className="absolute bottom-full left-0 mb-3 w-80 p-4 rounded-2xl bg-popover/95 border border-border backdrop-blur-xl shadow-2xl opacity-0 invisible group-hover/cit:opacity-100 group-hover/cit:visible transition-all duration-300 z-50 pointer-events-none transform translate-y-2 group-hover/cit:translate-y-0">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                                                                        <BookOpen className="w-3 h-3 text-primary" />
                                                                        <span className="text-[9px] uppercase tracking-widest font-black opacity-40">Raw Reference Content</span>
                                                                    </div>
                                                                    <p className="text-[11px] leading-relaxed text-foreground/80 font-medium italic wrap-break-word whitespace-pre-wrap">
                                                                        "{src.chunkText}"
                                                                    </p>
                                                                </div>
                                                                <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-popover border-r border-b border-border rotate-45" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Message Actions */}
                                        <div className={cn(
                                            "absolute top-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-1 transform scale-95 group-hover:scale-100",
                                            message.role === "user" ? "right-full mr-4" : "left-full ml-4"
                                        )}>
                                            <button
                                                onClick={() => handleCopy(message.id, message.content)}
                                                className="p-2 rounded-xl bg-foreground/5 border border-border hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-all shadow-xl"
                                            >
                                                {copiedId === message.id ? (
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="pb-4">
                <div className="p-8 pb-2 pt-0 bg-linear-to-t from-background via-background/90 to-transparent relative z-20">
                    <div className={cn(
                        "max-w-5xl mx-auto relative transition-all duration-500 group"
                    )}>
                        <div className="absolute -inset-1 bg-linear-to-r from-primary/10 via-transparent to-primary/10 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />

                        <div className="relative glass rounded-[32px] p-2 border border-border shadow-2xl focus-within:border-primary/30 transition-all bg-foreground/[0.02]">
                            <div className="flex flex-col gap-2">
                                {/* Input Row */}
                                <div className="px-4 pt-2 flex items-center justify-between pb-2">
                                    <textarea
                                        ref={inputRef}
                                        rows={1}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => setIsFocused(false)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder="Ask Knowledge AI..."
                                        className="w-full max-h-48 py-2 bg-transparent border-none outline-none resize-none text-base placeholder:text-muted-foreground/30 font-medium tracking-tight custom-scrollbar"
                                        style={{ height: "auto" }}
                                    />

                                    <div className="flex items-center gap-2">
                                        {(input.trim() || isFocused) ? (
                                            <button
                                                id="chat-send-btn"
                                                onClick={handleSend}
                                                disabled={(!input.trim() && !isFocused) || isTyping}
                                                className={cn(
                                                    "w-11 h-11 rounded-full transition-all duration-500 flex items-center justify-center relative group overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105"
                                                )}
                                            >
                                                {isTyping || isThinking ? (
                                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                                ) : (
                                                    <Send className="w-4 h-4 shrink-0 relative z-10 animate-in fade-in zoom-in duration-300" />
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    isSendingVoiceRef.current = true;
                                                    toggleListening();
                                                }}
                                                disabled={isTyping}
                                                className={cn(
                                                    "w-11 h-11 rounded-full bg-foreground/5 text-muted-foreground/40 hover:text-foreground transition-all duration-500 flex items-center justify-center relative group overflow-hidden",
                                                    isListening && "bg-red-500/10 text-red-500 hover:text-red-600 animate-pulse border border-red-500/20"
                                                )}
                                            >
                                                <Mic className={cn("w-5 h-5 shrink-0 relative z-10 animate-in fade-in zoom-in duration-300", isListening && "animate-pulse")} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Minimal Token Usage Footer */}
                {sessionId && (
                    <div className="flex flex-col items-center justify-center mt-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-foreground/5 border border-border backdrop-blur-sm group hover:border-primary/20 transition-all cursor-default">
                            <Sparkles className="w-3 h-3 text-primary/40 group-hover:text-primary transition-colors" />
                            <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-20 group-hover:opacity-40 transition-colors">Token Usage:</span>
                            <span className="text-xs font-mono font-bold text-primary/60 group-hover:text-primary transition-colors">
                                {totalTokensUsed.toLocaleString()} <span className="text-[9px] opacity-40 uppercase tracking-tighter ml-0.5">Tokens</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// END OF COMPONENT
