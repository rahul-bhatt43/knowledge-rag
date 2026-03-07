"use client";

import { Bell, Settings, MessageSquare, Edit2, Loader2, RotateCcw, Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiService } from "@/lib/api";
import { useChat } from "@/components/providers/chat-provider";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const { getSessionTitle, renameSession, totalTokensUsed } = useChat();
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
        <header className="h-16 bg-background/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 relative z-30">
            <div className="flex items-center gap-3 lg:flex-1 min-w-0">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 lg:hidden rounded-lg hover:bg-foreground/5 text-muted-foreground"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {sessionTitle && (
                    <div className="hidden sm:flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-500 group/title">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                            <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex items-center gap-2">
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={handleEditSave}
                                    onKeyDown={handleKeyDown}
                                    className="bg-transparent border-none outline-none text-sm font-bold text-foreground w-full focus:ring-0 p-0 h-auto min-w-[120px]"
                                    disabled={isSaving}
                                />
                            ) : (
                                <>
                                    <h1 className="text-sm font-bold text-foreground truncate max-w-[120px] lg:max-w-xs">{sessionTitle}</h1>
                                    <button
                                        onClick={() => {
                                            setEditTitle(sessionTitle);
                                            setIsEditing(true);
                                        }}
                                        className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-foreground/5 rounded transition-all"
                                    >
                                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 lg:gap-4">
                {sessionId && totalTokensUsed > 0 && (
                    <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-foreground/5 border border-border group hover:border-primary/20 transition-all cursor-default animate-in fade-in zoom-in duration-500 shrink-0">
                        <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/40 group-hover:text-primary transition-colors" />
                        <div className="flex flex-col items-start leading-none gap-0.5 sm:gap-0.5">
                            <span className="text-[7px] sm:text-[8px] uppercase tracking-widest font-black opacity-30 group-hover:opacity-50">Usage</span>
                            <span className="text-[10px] sm:text-[11px] font-mono font-black text-primary/70 group-hover:text-primary">
                                {totalTokensUsed.toLocaleString()} <span className="text-[7px] sm:text-[8px] opacity-40 uppercase ml-0.5">TK</span>
                            </span>
                        </div>
                    </div>
                )}
                <div className="flex items-center bg-foreground/5 rounded-full px-1.5 py-1 border border-border/50 backdrop-blur-sm self-center shrink-0">
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
