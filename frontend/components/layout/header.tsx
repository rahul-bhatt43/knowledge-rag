"use client";

import { Bell, Search, Settings, MessageSquare, ChevronRight, Edit2, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useChat } from "@/components/providers/chat-provider";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState, useRef, useEffect } from "react";

export function Header() {
    const { user } = useAuth();
    const { getSessionTitle, renameSession } = useChat();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session");
    const sessionTitle = getSessionTitle(sessionId);

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleEditSave = async () => {
        if (!sessionId || !editTitle.trim() || editTitle.trim() === sessionTitle) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await renameSession(sessionId, editTitle.trim());
        } catch (error) {
            console.error("Failed to rename", error);
        } finally {
            setIsSaving(false);
            setIsEditing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleEditSave();
        if (e.key === "Escape") setIsEditing(false);
    };

    return (
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 backdrop-blur-md bg-background/50 sticky top-0 z-40 gap-8">
            <div className="flex items-center flex-1 min-w-0">
                {sessionTitle && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-500 group/title">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                            <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />

                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleEditSave}
                                    disabled={isSaving}
                                    className="bg-foreground/5 border border-primary/30 rounded-lg px-3 py-1 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20 w-64 transition-all"
                                />
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            </div>
                        ) : (
                            <div
                                className="flex items-center gap-2 max-w-md cursor-pointer group/title-text"
                                onClick={() => { setEditTitle(sessionTitle || ""); setIsEditing(true); }}
                            >
                                <h2 className="text-xs font-bold text-foreground/80 group-hover/title-text:text-foreground truncate selection:bg-transparent transition-colors">
                                    {sessionTitle}
                                </h2>
                                <Edit2 className="w-2.5 h-2.5 text-muted-foreground/40 group-hover/title-text:text-primary opacity-0 group-hover/title-text:opacity-100 transition-all" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center bg-foreground/5 rounded-full px-1.5 py-1 border border-border/50">
                    <ThemeToggle />
                    <div className="w-px h-4 bg-border/50 mx-1" />
                    <button className="p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground relative transition-all">
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full ring-2 ring-background animate-pulse" />
                    </button>
                    <button className="p-1.5 rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-all">
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
}
