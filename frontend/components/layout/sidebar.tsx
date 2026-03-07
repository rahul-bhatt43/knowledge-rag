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
    Loader2,
    Edit2,
    Check,
    X
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

export function Sidebar({ isMobileOpen, onMobileClose }: { isMobileOpen?: boolean; onMobileClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeSessionId = searchParams.get("session");

    const { user, logout } = useAuth();
    const { sessions, loadingSessions, refreshSessions, renameSession } = useChat();
    const [collapsed, setCollapsed] = useState(false);
    const [creatingSession, setCreatingSession] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleCreateSession = () => {
        router.push("/");
        onMobileClose?.();
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

    const handleSaveEdit = async (e?: React.MouseEvent, id?: string) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!editingId || !editTitle.trim()) {
            setEditingId(null);
            return;
        }
        const sessionToEdit = sessions.find(s => s._id === editingId);
        if (sessionToEdit?.title === editTitle.trim()) {
            setEditingId(null);
            return;
        }

        setIsSaving(true);
        try {
            await renameSession(editingId, editTitle.trim());
        } catch (err) {
            console.error("Failed to rename session", err);
        } finally {
            setIsSaving(false);
            setEditingId(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            handleSaveEdit(undefined, id);
        } else if (e.key === "Escape") {
            setEditingId(null);
        }
    };

    return (
        <aside
            className={cn(
                "glass h-screen transition-all duration-300 flex flex-col fixed inset-y-0 left-0 lg:sticky z-50",
                collapsed ? "w-20" : "w-72",
                !isMobileOpen && "-translate-x-full lg:translate-x-0"
            )}
        >
            {/* Brand */}
            <div className="p-6 flex items-center justify-between shrink-0">
                {!collapsed && (
                    <div className="flex items-center gap-2 px-2">
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="w-8 h-10 object-contain"
                            onError={(e) => {
                                // Fallback to PNG if SVG fails or just show text
                                (e.target as HTMLImageElement).src = '/logo.png';
                            }}
                        />
                        <h1 className="text-xl font-bold tracking-tighter text-gradient">
                            AI Knowledge
                        </h1>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hidden lg:block"
                >
                    <ChevronLeft className={cn("w-5 h-5 transition-transform", collapsed && "rotate-180")} />
                </button>
                <button
                    onClick={onMobileClose}
                    className="p-2 hover:bg-foreground/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground lg:hidden"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Action Button */}
            <div className="px-4 mb-6 shrink-0 relative group">
                <button
                    onClick={handleCreateSession}
                    disabled={creatingSession}
                    className={cn(
                        "w-full bg-linear-to-br from-primary to-primary/80 text-primary-foreground rounded-xl flex items-center gap-2 transition-all hover:shadow-[0_8px_30px_rgb(var(--primary-rgb),0.3)] active:scale-[0.98] overflow-hidden shrink-0 disabled:opacity-50 group-hover:-translate-y-px",
                        collapsed ? "h-12 w-12 mx-auto justify-center" : "h-11 px-4 justify-center"
                    )}
                >
                    {creatingSession ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 shrink-0 group-hover:rotate-90 transition-transform duration-300" />}
                    {!collapsed && <span className="text-sm font-bold tracking-tight">New Session</span>}
                </button>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 overflow-y-auto px-3 space-y-6 custom-scrollbar">
                <section className="space-y-1">
                    <Link
                        href="/"
                        onClick={() => {
                            onMobileClose?.();
                        }}
                        className={cn(
                            "flex items-center h-10 rounded-xl transition-all group relative overflow-hidden text-sm font-medium",
                            collapsed ? "justify-center" : "gap-3 px-3",
                            pathname === "/" && !activeSessionId
                                ? "bg-primary/10 text-primary shadow-[inset_0_1px_1px_rgba(var(--primary-rgb),0.05)] border border-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
                        )}
                    >
                        <MessageSquare className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", pathname === "/" && !activeSessionId && "text-primary")} />
                        {!collapsed && <span>Global Assistant</span>}
                        {pathname === "/" && !activeSessionId && !collapsed && (
                            <div className="absolute right-3 w-1 h-4 bg-primary rounded-full animate-in fade-in duration-500" />
                        )}
                    </Link>

                    {navItems.map((item) => {
                        if (item.adminOnly && user?.role !== "admin") return null;
                        const active = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onMobileClose?.()}
                                className={cn(
                                    "flex items-center h-10 rounded-xl transition-all group relative overflow-hidden text-sm font-medium",
                                    collapsed ? "justify-center" : "gap-3 px-3",
                                    active
                                        ? "bg-primary/10 text-primary shadow-[inset_0_1px_1px_rgba(var(--primary-rgb),0.05)] border border-primary/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 border border-transparent"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", active && "text-primary")} />
                                {!collapsed && <span>{item.label}</span>}
                                {active && !collapsed && (
                                    <div className="absolute right-3 w-1 h-4 bg-primary rounded-full animate-in fade-in duration-500" />
                                )}
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
                            </div>

                            {/* Session Search */}
                            <div className="relative group/search">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within/search:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search chats..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-9 bg-foreground/2 dark:bg-foreground/3 border border-border/50 rounded-xl pl-9 pr-3 text-[11px] outline-none focus:border-primary/30 focus:bg-background/50 focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/60"
                                />
                            </div>
                        </div>

                        <div className="space-y-1 px-1">
                            {loadingSessions ? (
                                <div className="space-y-2 animate-pulse">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 h-10 rounded-lg bg-foreground/5">
                                            <div className="w-4 h-4 rounded-sm bg-foreground/10 shrink-0" />
                                            <div className="h-2.5 rounded-full bg-foreground/10 flex-1" style={{ width: `${Math.random() * 40 + 40}%` }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                sessions
                                    .filter((s: any) => s.title.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map((session: any) => (
                                        <Link
                                            key={session._id}
                                            href={`/?session=${session._id}`}
                                            onClick={(e) => {
                                                if (editingId === session._id) e.preventDefault();
                                                else onMobileClose?.();
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 px-3 h-10 rounded-lg transition-all group relative",
                                                activeSessionId === session._id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
                                                editingId === session._id && "bg-foreground/10"
                                            )}
                                        >
                                            <History className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />

                                            {editingId === session._id ? (
                                                <div className="flex-1 flex items-center min-w-0" onClick={e => e.preventDefault()}>
                                                    <input
                                                        autoFocus
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, session._id)}
                                                        onBlur={() => handleSaveEdit()}
                                                        disabled={isSaving}
                                                        className="w-full bg-background/50 border border-primary/50 text-foreground text-xs rounded px-2 py-1 outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-xs truncate flex-1 min-w-0 pr-12">{session.title}</span>
                                            )}

                                            {editingId !== session._id && (
                                                <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 flex items-center transition-all bg-background/50 lg:bg-background/80 backdrop-blur-sm px-1 rounded-lg absolute right-2 border border-transparent lg:border-border/30 shadow-sm">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setEditingId(session._id);
                                                            setEditTitle(session.title);
                                                        }}
                                                        className="p-1.5 hover:text-primary transition-all text-muted-foreground active:scale-95"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="w-px h-3 bg-border/50 mx-0.5 hidden lg:block" />
                                                    <button
                                                        onClick={(e) => handleDeleteSession(e, session._id)}
                                                        className="p-1.5 hover:text-destructive transition-all text-muted-foreground active:scale-95"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </Link>
                                    ))
                            )}
                            {!loadingSessions && sessions.filter((s: any) => s.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                <p className="text-[10px] text-center text-muted-foreground/50 py-4 italic">
                                    {searchTerm ? "No results found" : "No recent chats"}
                                </p>
                            )}
                        </div>
                    </section>
                )}
            </div>

            {/* Bottom Profile/Logout */}
            <div className="p-4 mt-auto border-t border-white/5 space-y-3 bg-linear-to-t from-background/80 to-transparent shrink-0">
                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-2xl bg-foreground/5 border border-border/50 hover:bg-foreground/10 transition-colors cursor-pointer group/profile",
                    collapsed ? "justify-center" : "px-3"
                )}>
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center text-[11px] font-bold text-white shrink-0 ring-2 ring-background shadow-lg shadow-primary/20 group-hover/profile:scale-105 transition-transform">
                        {user?.firstName?.[0]}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate text-foreground/90 group-hover/profile:text-foreground">{user?.firstName} {user?.lastName}</p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none mt-1 font-medium">{user?.role}</p>
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all text-xs font-semibold group/logout"
                    >
                        <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                        Sign Out
                    </button>
                )}
            </div>
        </aside>
    );
}
