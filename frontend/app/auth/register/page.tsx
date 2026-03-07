"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiService } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { accessToken, user, refreshToken } = await ApiService.post<{ accessToken: string; user: any; refreshToken: string }>(
                "/auth/register",
                formData
            );
            login(accessToken, user, refreshToken);
        } catch (err: any) {
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="glass w-full max-w-md p-8 relative overflow-hidden group">
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 blur-3xl rounded-full transition-all group-hover:bg-primary/20" />

                <div className="relative z-10 space-y-8 animate-in">
                    <div className="text-center space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-gradient">
                            Join the Team
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Create your account to start sharing knowledge
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                        First Name
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                        <input
                                            type="text"
                                            required
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            className="w-full h-12 pl-10 pr-4 bg-foreground/5 border border-border rounded-xl outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/30 text-sm"
                                            placeholder="John"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                        Last Name
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                        <input
                                            type="text"
                                            required
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            className="w-full h-12 pl-10 pr-4 bg-foreground/5 border border-border rounded-xl outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/30 text-sm"
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full h-12 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/30 text-sm"
                                        placeholder="john@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                    Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full h-12 pl-10 pr-4 bg-white/5 border border-white/10 rounded-xl outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/30 text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg animate-in">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 group shadow-lg shadow-primary/20"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            href="/auth/login"
                            className="font-semibold text-primary hover:underline underline-offset-4"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
