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
            <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <h1 className="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
                                Knowledge Base
                            </h1>
                        </div>
                        <p className="text-muted-foreground/60 text-sm max-w-md leading-relaxed">
                            Organize and manage your document ecosystem for grounded AI responses.
                        </p>
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="group relative h-12 px-8 bg-primary text-primary-foreground rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-3 shadow-xl shadow-primary/20 overflow-hidden disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 relative z-10" />}
                        <span className="relative z-10">Upload Document</span>
                    </button>

                    <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => handleUpload(e.target.files)}
                        accept=".pdf,.docx,.txt,.xlsx,.csv,.json"
                    />
                </div>

                {/* Stats Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Total Documents", value: documents.length, icon: FileText, color: "text-blue-400", bg: "bg-blue-400/10" },
                        { label: "Indexed Chunks", value: documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0), icon: RefreshCw, color: "text-primary", bg: "bg-primary/10" },
                        { label: "Storage Capacity", value: formatSize(documents.reduce((acc, d) => acc + d.fileSize, 0)), icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
                    ].map((stat, i) => (
                        <div key={i} className="group relative glass p-6 rounded-3xl border border-border bg-foreground/2 hover:bg-foreground/5 transition-all duration-500 overflow-hidden">
                            <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity", stat.color.replace('text', 'bg'))} />

                            <div className="flex items-center justify-between mb-4">
                                <div className={cn("p-3 rounded-2xl border border-border", stat.bg)}>
                                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Live</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-4xl font-black tracking-tighter text-foreground">{stat.value}</p>
                                <p className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-[0.2em]">{stat.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Dropzone Area */}
                <div
                    className={cn(
                        "group relative border-2 border-dashed rounded-[40px] p-20 flex flex-col items-center justify-center gap-8 transition-all duration-700 overflow-hidden cursor-pointer",
                        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-foreground/1 hover:bg-foreground/3 hover:border-primary/20"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="relative">
                        <div className="w-24 h-24 bg-primary/10 rounded-[30px] flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700 border border-primary/20 relative z-10">
                            <Upload className="w-10 h-10 text-primary" />
                        </div>
                        <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
                    </div>

                    <div className="text-center space-y-3 relative z-10">
                        <h3 className="font-extrabold text-3xl tracking-tight text-foreground">Drop files to index</h3>
                        <p className="text-muted-foreground/60 text-sm max-w-xs mx-auto">
                            Add PDF, DOCX, TXT, XLSX, CSV, or JSON files to train your AI assistant with custom knowledge.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="h-px w-8 bg-border" />
                        <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.3em]">Supported Formats</span>
                        <div className="h-px w-8 bg-border" />
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 relative z-10 max-w-[250px]">
                        {['PDF', 'DOCX', 'TXT', 'XLSX', 'CSV', 'JSON'].map(fmt => (
                            <span key={fmt} className="px-4 py-1.5 bg-foreground/5 rounded-xl border border-border text-[10px] font-bold opacity-40 tracking-widest uppercase">
                                {fmt}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Document Explorer */}
                <div className="space-y-8 pb-12">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black tracking-tight text-foreground">Recent Artifacts</h2>
                            <div className="px-2 py-0.5 rounded-md bg-foreground/5 border border-border text-[9px] font-black opacity-20 uppercase tracking-tighter">
                                {documents.length} Units
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                            Auto-sync enabled
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="h-24 glass rounded-3xl border border-border animate-pulse" />
                            ))
                        ) : documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 glass rounded-[40px] border border-border space-y-6">
                                <div className="w-20 h-20 bg-foreground/5 rounded-3xl flex items-center justify-center opacity-20">
                                    <FileText className="w-10 h-10" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-extrabold text-xl opacity-40 tracking-tight">Ecosystem is empty</p>
                                    <p className="text-xs text-muted-foreground/40 max-w-xs mx-auto">
                                        Upload documents to populate your knowledge base and enable RAG capabilities.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            documents.map((doc) => (
                                <div key={doc._id} className="group relative glass hover:bg-foreground/5 transition-all duration-500 p-6 rounded-[32px] flex items-center gap-6 border border-border hover:border-primary/20">
                                    <div className="w-14 h-14 bg-foreground/5 rounded-2xl flex items-center justify-center shrink-0 border border-border group-hover:scale-105 transition-transform duration-500 group-hover:border-primary/30">
                                        <FileText className="w-7 h-7 text-muted-foreground/40 group-hover:text-primary transition-colors duration-500" />
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-bold text-base text-foreground truncate max-w-md group-hover:text-primary transition-colors">
                                                {doc.fileName}
                                            </h4>
                                            <span className="text-[9px] font-black bg-foreground/5 px-2.5 py-1 rounded-lg border border-border text-muted-foreground/40 uppercase tracking-tighter">
                                                {doc.fileType.split('/')[1] || 'DOC'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                {formatSize(doc.fileSize)}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 shrink-0">
                                        {/* Status Unit */}
                                        <div className={cn(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500",
                                            doc.status === "READY" && "bg-emerald-500/5 text-emerald-400 border-emerald-500/10 group-hover:bg-emerald-500/10",
                                            doc.status === "PROCESSING" && "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary/10",
                                            doc.status === "FAILED" && "bg-destructive/5 text-destructive border-destructive/10 group-hover:bg-destructive/10",
                                            doc.status === "PENDING" && "bg-foreground/5 text-muted-foreground/40 border-border"
                                        )}>
                                            {doc.status === "PROCESSING" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
                                                doc.status === "READY" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                                                    doc.status === "FAILED" ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                            {doc.status}
                                        </div>

                                        <button
                                            onClick={() => handleDelete(doc._id)}
                                            className="p-3.5 rounded-2xl text-muted-foreground/20 hover:text-primary-foreground hover:bg-destructive shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4.5 h-4.5" />
                                        </button>
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
