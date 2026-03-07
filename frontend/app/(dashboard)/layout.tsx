"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";

import { ChatProvider } from "@/components/providers/chat-provider";
import React from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { loading, user } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <ChatProvider>
            <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <Sidebar
                    isMobileOpen={isSidebarOpen}
                    onMobileClose={() => setIsSidebarOpen(false)}
                />

                <div className="flex-1 flex flex-col min-w-0 h-full relative">
                    <Header onMenuClick={() => setIsSidebarOpen(true)} />
                    <div className="flex-1 p-2 pt-0 overflow-hidden">
                        <main className="h-full rounded-2xl border border-border bg-card/30 overflow-auto custom-scrollbar shadow-sm">
                            {children}
                        </main>
                    </div>
                </div>
            </div>
        </ChatProvider>
    );
}
