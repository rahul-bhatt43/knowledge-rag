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
        <header className="h-16 flex items-center justify-between px-8 border-b border-border backdrop-blur-md bg-background/50 sticky top-0 z-40 gap-8">
            <div className="flex items-center flex-1 min-w-0">
                {sessionTitle && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500 group/title">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                            <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />

                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleEditSave}
                                    disabled={isSaving}
                                    className="bg-background/50 border border-primary/50 rounded px-2 py-1 text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 w-64"
                                />
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 max-w-md cursor-pointer" onClick={() => { setEditTitle(sessionTitle || ""); setIsEditing(true); }}>
                                <h2 className="text-sm font-bold text-foreground truncate selection:bg-transparent">
                                    {sessionTitle}
                                </h2>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditTitle(sessionTitle || ""); setIsEditing(true); }}
                                    className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-foreground/5 rounded transition-all text-muted-foreground hover:text-foreground"
                                >
                                    <Edit2 className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <ThemeToggle />
                <button className="p-2 rounded-full hover:bg-foreground/5 text-muted-foreground relative transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
                </button>
                <button className="p-2 rounded-full hover:bg-foreground/5 text-muted-foreground transition-colors">
                    <Settings className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
