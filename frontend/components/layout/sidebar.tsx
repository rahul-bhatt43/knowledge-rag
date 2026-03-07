"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    MessageSquare,
    Files,
    Users,
    Settings,
    Plus,
    ChevronLeft,
    Search,
    History,
    LogOut,
    Trash2,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { useChat } from "@/components/providers/chat-provider";
import { useState } from "react";
import { ApiService } from "@/lib/api";

const navItems = [
    { label: "Knowledge", href: "/knowledge", icon: Files },
    { label: "Team", href: "/users", icon: Users, adminOnly: true },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeSessionId = searchParams.get("session");

    const { user, logout } = useAuth();
    const { sessions, loadingSessions, refreshSessions } = useChat();
    const [collapsed, setCollapsed] = useState(false);
    const [creatingSession, setCreatingSession] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const handleCreateSession = () => {
        router.push("/");
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Delete this conversation?")) return;

        try {
            await ApiService.delete(`/chat/sessions/${id}`);
            await refreshSessions();
            if (activeSessionId === id) {
                router.push("/");
            }
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    return (
        <aside
            className={cn(
                "glass h-screen transition-all duration-300 flex flex-col relative z-50",
                collapsed ? "w-20" : "w-72"
            )}
        >
            {/* Brand */}
            <div className="p-6 flex items-center justify-between shrink-0">
                {!collapsed && (
                    <h1 className="text-xl font-bold tracking-tighter text-gradient px-2">
                        AI Knowledge
                    </h1>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className={cn("w-5 h-5 transition-transform", collapsed && "rotate-180")} />
                </button>
            </div>

            {/* Action Button */}
            <div className="px-4 mb-6 shrink-0">
                <button
                    onClick={handleCreateSession}
                    disabled={creatingSession}
                    className={cn(
                        "w-full bg-primary text-primary-foreground rounded-xl flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/10 overflow-hidden shrink-0 disabled:opacity-50",
                        collapsed ? "h-12 w-12 mx-auto justify-center" : "h-11 px-4 justify-center"
                    )}
                >
                    {creatingSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 shrink-0" />}
                    {!collapsed && <span className="text-sm font-semibold">New Session</span>}
                </button>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar">
                <section className="space-y-1">
                    <Link
                        href="/"
                        className={cn(
                            "flex items-center h-11 rounded-xl transition-all group relative overflow-hidden text-sm font-medium",
                            collapsed ? "justify-center" : "gap-3 px-3",
                            pathname === "/" && !activeSessionId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                        )}
                    >
                        <MessageSquare className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>Global Assistant</span>}
                    </Link>

                    {navItems.map((item) => {
                        if (item.adminOnly && user?.role !== "admin") return null;
                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center h-11 rounded-xl transition-all group relative overflow-hidden text-sm font-medium",
                                    collapsed ? "justify-center" : "gap-3 px-3",
                                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </section>

                {/* Chat History */}
                {!collapsed && (
                    <section className="space-y-4 pt-4">
                        <div className="px-3 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recent Chats</h2>
                                {loadingSessions && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            </div>

                            {/* Session Search */}
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-9 bg-foreground/5 border border-border rounded-lg pl-9 pr-3 text-xs outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-1 px-1">
                            {sessions
                                .filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((session) => (
                                    <Link
                                        key={session._id}
                                        href={`/?session=${session._id}`}
                                        className={cn(
                                            "flex items-center gap-3 px-3 h-10 rounded-lg transition-all group relative animate-in",
                                            activeSessionId === session._id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                        )}
                                    >
                                        <History className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        <span className="text-xs truncate flex-1">{session.title}</span>
                                        <button
                                            onClick={(e) => handleDeleteSession(e, session._id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </Link>
                                ))}
                            {!loadingSessions && sessions.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                <p className="text-[10px] text-center text-muted-foreground/50 py-4 italic">
                                    {searchTerm ? "No results found" : "No recent chats"}
                                </p>
                            )}
                        </div>
                    </section>
                )}
            </div>

            {/* Bottom Profile/Logout */}
            <div className="p-4 mt-auto border-t border-white/5 space-y-2 shrink-0">
                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-xl bg-foreground/5",
                    collapsed ? "justify-center" : "px-3"
                )}>
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-primary/50 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {user?.firstName?.[0]}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-foreground">{user?.firstName} {user?.lastName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">{user?.role}</p>
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-sm font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                )}
            </div>
        </aside>
    );
}
