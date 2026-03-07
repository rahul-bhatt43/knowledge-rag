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
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [isInviteOpen, setIsInviteOpen] = useState(false);
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
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Team Management</h1>
                        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Manage your team members and their access levels.</p>
                    </div>
                    <button
                        onClick={() => setIsInviteOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 h-10 lg:px-6 lg:h-12 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 text-sm lg:text-base"
                    >
                        <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
                        Invite Member
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        {/* Assuming Input component is imported or defined */}
                        <input // Changed to native input for simplicity, assuming Input component is custom
                            type="text"
                            placeholder="Search by name or email..."
                            className="pl-10 h-10 lg:h-11 bg-card/50 border-white/5 focus:border-primary/30 transition-all rounded-xl w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Assuming Select, SelectTrigger, SelectContent, SelectItem, SelectValue components are imported or defined */}
                    <select // Changed to native select for simplicity, assuming Select component is custom
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full sm:w-48 h-10 lg:h-11 bg-card/50 border-white/5 focus:border-primary/30 rounded-xl transition-all px-3 text-sm"
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admins</option>
                        <option value="editor">Editors</option>
                        <option value="viewer">Viewers</option>
                    </select>
                </div>

                {/* Users Table */}
                <div className="glass rounded-2xl lg:rounded-3xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="border-b border-white/5 bg-foreground/[0.02]">
                                    <th className="px-4 lg:px-6 py-4 lg:py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Member</th>
                                    <th className="px-4 lg:px-6 py-4 lg:py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                                    <th className="px-4 lg:px-6 py-4 lg:py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-4 lg:px-6 py-4 lg:py-5 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-8"><div className="h-12 bg-foreground/5 rounded-xl" /></td>
                                        </tr>
                                    ))
                                ) : users.map((u) => (
                                    <tr key={u._id} className="group hover:bg-foreground/2 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">
                                                    {u.firstName[0]}{u.lastName[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-foreground text-sm">{u.firstName} {u.lastName}</p>
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
                                                u.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-foreground/5 text-muted-foreground border-border"
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
                                                <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
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
            </div>
        </DashboardLayout>
    );
}
