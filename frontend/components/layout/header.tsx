"use client";

import { Bell, Search, Settings } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export function Header() {
    const { user } = useAuth();

    return (
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-md bg-background/50 sticky top-0 z-40">
            <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search knowledge..."
                        className="w-full h-10 bg-white/5 border border-white/10 rounded-full pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="p-2 rounded-full hover:bg-white/5 text-muted-foreground relative transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
                </button>
                <button className="p-2 rounded-full hover:bg-white/5 text-muted-foreground transition-colors">
                    <Settings className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
