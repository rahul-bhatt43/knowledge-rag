"use client";

import { Bell, Search, Settings, MessageSquare, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useChat } from "@/components/providers/chat-provider";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
    const { user } = useAuth();
    const { getSessionTitle } = useChat();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session");
    const sessionTitle = getSessionTitle(sessionId);

    return (
        <header className="h-16 flex items-center justify-between px-8 border-b border-border backdrop-blur-md bg-background/50 sticky top-0 z-40 gap-8">
            <div className="flex items-center flex-1 min-w-0">
                {sessionTitle && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                            <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                        <h2 className="text-sm font-bold text-foreground truncate max-w-md">
                            {sessionTitle}
                        </h2>
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
