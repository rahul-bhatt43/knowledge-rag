"use client";

import { useEffect, useState, useRef } from "react";
import DashboardLayout from "../(dashboard)/layout";
import {
    FileText,
    Upload,
    Trash2,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiService } from "@/lib/api";

interface Document {
    _id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    pageCount?: number;
    chunkCount?: number;
    createdAt: string;
}

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocuments = async () => {
        try {
            const response = await ApiService.get<{ documents: Document[] }>("/documents");
            setDocuments(response.documents);
        } catch (err) {
            console.error("Failed to fetch documents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        const needsPolling = documents.some(d => d.status === "PROCESSING" || d.status === "PENDING");
        if (!needsPolling) return;

        const timeout = setTimeout(fetchDocuments, 5000);
        return () => clearTimeout(timeout);
    }, [documents]);

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        const formData = new FormData();
        formData.append("file", files[0]);

        try {
            await ApiService.post("/documents/upload", formData);
            fetchDocuments();
        } catch (err: any) {
            alert(err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await ApiService.delete(`/documents/${id}`);
            setDocuments(prev => prev.filter(d => d._id !== id));
        } catch (err) {
            alert("Delete failed");
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <DashboardLayout>
            <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in">
                {/* Header */}
                <div className="flex items-end justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-gradient">Knowledge Base</h1>
                        <p className="text-muted-foreground text-sm">Manage and upload documents for the RAG pipeline.</p>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Upload Document
                    </button>
                    <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => handleUpload(e.target.files)}
                        accept=".pdf,.docx,.txt"
                    />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Total Documents", value: documents.length, icon: FileText, color: "text-blue-400" },
                        { label: "Indexed Chunks", value: documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0), icon: RefreshCw, color: "text-primary" },
                        { label: "Storage", value: formatSize(documents.reduce((acc, d) => acc + d.fileSize, 0)), icon: Clock, color: "text-amber-400" },
                    ].map((stat, i) => (
                        <div key={i} className="glass p-6 rounded-2xl space-y-2 border-white/5 bg-white/[0.02]">
                            <div className="flex items-center justify-between">
                                <stat.icon className={cn("w-5 h-5", stat.color)} />
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            </div>
                            <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Uploader */}
                <div
                    className={cn(
                        "border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center gap-4 transition-all duration-500 group relative overflow-hidden",
                        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-white/10 bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/20"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 border border-primary/20">
                        <Upload className="w-10 h-10 text-primary" />
                    </div>
                    <div className="text-center relative z-10">
                        <p className="font-bold text-xl tracking-tight">Drop your documents here</p>
                        <p className="text-sm text-muted-foreground mt-1 underline decoration-primary/30 underline-offset-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            or click to browse from files
                        </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-4 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                        PDF • DOCX • TXT
                    </p>
                </div>

                {/* Document List */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-bold tracking-tight">Recently Added</h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <Clock className="w-3 h-3" />
                            Auto-refreshing status
                        </div>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            [1, 2, 3].map(i => <div key={i} className="h-20 glass rounded-2xl animate-pulse" />)
                        ) : documents.length === 0 ? (
                            <div className="text-center py-20 glass rounded-3xl space-y-4">
                                <FileText className="w-12 h-12 text-white/5 mx-auto" />
                                <p className="text-muted-foreground text-sm">No documents found. Upload your first one to get started.</p>
                            </div>
                        ) : (
                            documents.map((doc) => (
                                <div key={doc._id} className="glass group hover:bg-white/[0.04] transition-all p-5 rounded-2xl flex items-center gap-5 border-white/5">
                                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/5 group-hover:border-primary/20 transition-colors">
                                        <FileText className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm truncate">{doc.fileName}</p>
                                            <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase font-bold tracking-tighter">{doc.fileType.split('/')[1]}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1.5 font-medium">
                                            <span>{formatSize(doc.fileSize)}</span>
                                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                                            <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-8">
                                        {/* Status Badge */}
                                        <div className={cn(
                                            "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest min-w-[100px] justify-center",
                                            doc.status === "READY" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                            doc.status === "PROCESSING" && "bg-primary/10 text-primary border-primary/20",
                                            doc.status === "FAILED" && "bg-destructive/10 text-destructive border-destructive/20",
                                            doc.status === "PENDING" && "bg-white/5 text-muted-foreground border-white/10"
                                        )}>
                                            {doc.status === "PROCESSING" ? <RefreshCw className="w-3 h-3 animate-spin" /> :
                                                doc.status === "READY" ? <CheckCircle2 className="w-3 h-3" /> :
                                                    doc.status === "FAILED" ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            {doc.status}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDelete(doc._id)}
                                                className="p-2.5 rounded-xl text-muted-foreground hover:text-white hover:bg-destructive shadow-sm transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
