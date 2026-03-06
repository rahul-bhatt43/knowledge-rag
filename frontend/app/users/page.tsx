"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../(dashboard)/layout";
import {
    Users,
    UserPlus,
    Shield,
    ShieldAlert,
    MoreVertical,
    Mail,
    Calendar,
    Search,
    CheckCircle2,
    Trash2,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiService } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: "admin" | "user";
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const data = await ApiService.get<User[]>("/users");
                setUsers(data);
            } catch (err) {
                console.error("Failed to fetch users:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    if (currentUser?.role !== "admin") {
        return (
            <DashboardLayout>
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <ShieldAlert className="w-16 h-16 text-destructive/40" />
                    <h2 className="text-2xl font-bold tracking-tight">Access Denied</h2>
                    <p className="text-muted-foreground max-w-sm">
                        You do not have the required permissions to view this page. Please contact your administrator if you believe this is an error.
                    </p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-gradient">Team Management</h1>
                        <p className="text-muted-foreground text-sm">Review, invite, and manage access for your team members.</p>
                    </div>
                    <button className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                        <UserPlus className="w-4 h-4" />
                        Invite Member
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="glass p-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border-white/5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
                        />
                    </div>
                    <div className="h-11 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        Role: <span className="text-white">All</span>
                    </div>
                </div>

                {/* Users Table */}
                <div className="glass overflow-hidden rounded-3xl border-white/5 bg-white/[0.01]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">User</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Role</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Joined</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="px-6 py-8"><div className="h-12 bg-white/5 rounded-xl" /></td>
                                    </tr>
                                ))
                            ) : users.map((u) => (
                                <tr key={u._id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">
                                                {u.firstName[0]}{u.lastName[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-sm">{u.firstName} {u.lastName}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                                    <Mail className="w-3 h-3" />
                                                    {u.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <div className={cn(
                                            "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest",
                                            u.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-white/5 text-muted-foreground border-white/10"
                                        )}>
                                            {u.role === "admin" ? <Shield className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                            {u.role}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm text-muted-foreground font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-muted-foreground/40" />
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Active
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 rounded-xl text-muted-foreground hover:text-white transition-colors">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 rounded-xl text-muted-foreground hover:text-destructive transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
