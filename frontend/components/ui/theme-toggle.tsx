"use client";

import * as React from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();

    return (
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
            <button
                onClick={() => setTheme("light")}
                className={cn(
                    "p-2 rounded-full transition-all",
                    theme === "light"
                        ? "bg-white text-black shadow-lg"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Light Mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={cn(
                    "p-2 rounded-full transition-all",
                    theme === "dark"
                        ? "bg-primary text-white shadow-lg"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="Dark Mode"
            >
                <Moon className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={cn(
                    "p-2 rounded-full transition-all",
                    theme === "system"
                        ? "bg-white/10 text-foreground shadow-lg"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                title="System Theme"
            >
                <Laptop className="w-4 h-4" />
            </button>
        </div>
    );
}
