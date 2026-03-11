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
    Mic,
    X,
    ChevronDown,
    ChevronUp,
    Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL, ApiService } from "@/lib/api";
import { LiveTranscriptPiP } from "@/components/LiveTranscriptPiP";
import { PostMeetingModal } from "@/components/PostMeetingModal";

interface Document {
    _id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    pageCount?: number;
    chunkCount?: number;
    createdAt: string;
    // Audio-specific
    isAudioFile?: boolean;
    transcript?: string;
    durationSeconds?: number;
    speakerCount?: number;
    analytics?: {
        sentiment: "positive" | "neutral" | "negative";
        sentimentScore: number;
        keyTopics: string[];
        actionItems: string[];
        generatedAt: string;
    };
}

interface MeetingAnalytics {
    sentiment: "positive" | "neutral" | "negative";
    sentimentScore: number;
    keyTopics: string[];
    actionItems: string[];
    generatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm", ".mov"]);
const AUDIO_MIMES = new Set([
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
    "audio/x-m4a", "video/mp4", "video/webm", "video/quicktime",
]);

function isAudioType(fileName: string, mimeType: string): boolean {
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    return AUDIO_MIMES.has(mimeType) || AUDIO_EXTENSIONS.has(ext);
}

function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

const SENTIMENT_META = {
    positive: { label: "Positive", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    neutral: { label: "Neutral", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    negative: { label: "Negative", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

// ─── Transcript & Analytics Modal ─────────────────────────────────────────────

function AudioDetailModal({
    doc,
    onClose,
}: {
    doc: Document;
    onClose: () => void;
}) {
    const [analytics, setAnalytics] = useState<MeetingAnalytics | null>(doc.analytics ?? null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);

    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const res = await ApiService.get<MeetingAnalytics>(`/documents/${doc._id}/analytics`);
            setAnalytics(res);
        } catch (e) {
            alert("Failed to load analytics.");
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const handleDownload = async (type: "pdf" | "txt") => {
        const url = type === "pdf"
            ? `${API_BASE_URL}/documents/${doc._id}/summary/pdf`
            : `${API_BASE_URL}/documents/${doc._id}/transcript/download`;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(url, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });

            if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${doc.fileName}_${type === "pdf" ? "summary.pdf" : "transcript.txt"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            alert(`Failed to download ${type.toUpperCase()}`);
            console.error(e);
        }
    };

    const sentimentInfo = analytics ? SENTIMENT_META[analytics.sentiment] : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-card border border-border rounded-[28px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Mic className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-foreground truncate max-w-xs">{doc.fileName}</h3>
                            <p className="text-[10px] text-muted-foreground/50 font-medium">
                                {doc.durationSeconds ? formatDuration(doc.durationSeconds) : "—"}
                                {doc.speakerCount ? ` · ${doc.speakerCount} speaker${doc.speakerCount > 1 ? "s" : ""}` : ""}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-foreground/5 transition-colors">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {/* Analytics Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                                    Meeting Analytics
                                </h4>
                                {analytics && (
                                    <button
                                        onClick={() => handleDownload("pdf")}
                                        className="text-primary hover:text-primary/80 transition-colors"
                                        title="Download PDF Summary"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {!analytics && (
                                <button
                                    onClick={fetchAnalytics}
                                    disabled={loadingAnalytics}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                                >
                                    {loadingAnalytics
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <RefreshCw className="w-3 h-3" />}
                                    {loadingAnalytics ? "Analyzing..." : "Generate Analytics"}
                                </button>
                            )}
                        </div>

                        {analytics ? (
                            <div className="grid gap-3">
                                {/* Sentiment */}
                                <div className={cn("p-4 rounded-2xl border flex items-center justify-between", sentimentInfo?.bg)}>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Overall Sentiment</p>
                                        <p className={cn("text-base font-extrabold", sentimentInfo?.color)}>{sentimentInfo?.label}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Score</p>
                                        <p className={cn("text-base font-extrabold", sentimentInfo?.color)}>
                                            {analytics.sentimentScore >= 0 ? "+" : ""}{analytics.sentimentScore.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Key Topics */}
                                {analytics.keyTopics.length > 0 && (
                                    <div className="p-4 rounded-2xl border border-border bg-foreground/2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Key Topics</p>
                                        <div className="flex flex-wrap gap-2">
                                            {analytics.keyTopics.map((t, i) => (
                                                <span key={i} className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[11px] font-semibold">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action Items */}
                                {analytics.actionItems.length > 0 && (
                                    <div className="p-4 rounded-2xl border border-border bg-foreground/2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Action Items</p>
                                        <ul className="space-y-2">
                                            {analytics.actionItems.map((item, i) => (
                                                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground/50">
                                Click "Generate Analytics" to run sentiment analysis on this meeting.
                            </div>
                        )}
                    </div>

                    {/* Transcript Section */}
                    {doc.transcript && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 w-full">
                                <button
                                    onClick={() => setShowTranscript(v => !v)}
                                    className="flex-1 flex items-center gap-2 text-left"
                                >
                                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/50 flex-1">
                                        Transcript
                                    </h4>
                                    {showTranscript ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
                                </button>
                                <button
                                    onClick={() => handleDownload("txt")}
                                    className="text-primary hover:text-primary/80 transition-colors p-1"
                                    title="Download raw transcript"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                            {showTranscript && (
                                <div className="bg-foreground/3 border border-border rounded-2xl p-4 max-h-60 overflow-y-auto text-sm font-mono leading-7 text-foreground/70 whitespace-pre-wrap">
                                    {doc.transcript}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedAudioDoc, setSelectedAudioDoc] = useState<Document | null>(null);
    const [isLiveTranscriptOpen, setIsLiveTranscriptOpen] = useState(false);
    const [postMeetingDocId, setPostMeetingDocId] = useState<string | null>(null);
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

    useEffect(() => { fetchDocuments(); }, []);

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
        } catch {
            alert("Delete failed");
        }
    };

    const audioCount = documents.filter(d => d.isAudioFile).length;

    return (
        <DashboardLayout>
            <LiveTranscriptPiP
                isOpen={isLiveTranscriptOpen}
                onClose={() => setIsLiveTranscriptOpen(false)}
                onRecordingComplete={(id) => setPostMeetingDocId(id)}
            />

            {postMeetingDocId && (
                <PostMeetingModal
                    documentId={postMeetingDocId}
                    onClose={() => setPostMeetingDocId(null)}
                    onSaved={() => fetchDocuments()}
                />
            )}

            {selectedAudioDoc && (
                <AudioDetailModal
                    doc={selectedAudioDoc}
                    onClose={() => setSelectedAudioDoc(null)}
                />
            )}

            <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8 sm:space-y-12 animate-in fade-in duration-700">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Knowledge Base</h1>
                        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Upload and manage your company documents and meeting recordings.</p>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Total Documents", value: documents.length, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Meeting Recordings", value: audioCount, icon: Mic, color: "text-violet-400", bg: "bg-violet-500/10" },
                        { label: "Storage Used", value: formatSize(documents.reduce((acc, d) => acc + d.fileSize, 0)), icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
                        { label: "Processed", value: documents.filter(d => d.status === "READY").length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    ].map((stat, i) => (
                        <div key={i} className="glass p-4 rounded-2xl border border-border flex items-center gap-4 group hover:border-primary/20 transition-all cursor-default">
                            <div className={cn("w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", stat.bg)}>
                                <stat.icon className={cn("w-5 h-5 lg:w-6 lg:h-6", stat.color)} />
                            </div>
                            <div>
                                <p className="text-[11px] lg:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                                <p className="text-lg lg:text-xl font-bold text-foreground">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Dropzone */}
                <div
                    className={cn(
                        "group relative border-2 border-dashed rounded-[32px] p-8 sm:p-12 lg:p-20 flex flex-col items-center justify-center gap-6 sm:gap-8 transition-all duration-700 overflow-hidden cursor-pointer",
                        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-foreground/1 hover:bg-foreground/3 hover:border-primary/20",
                        uploading && "pointer-events-none opacity-60"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleUpload(e.dataTransfer.files); }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.txt,.md,.html,.doc,.docx,.xlsx,.csv,.json,.sql,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov,audio/*,video/mp4,video/webm"
                        onChange={(e) => handleUpload(e.target.files)}
                    />

                    <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="relative">
                        <div className="w-24 h-24 bg-primary/10 rounded-[30px] flex items-center justify-center group-hover:scale-110 group-hover:-rotate-3 transition-all duration-700 border border-primary/20 relative z-10">
                            {uploading
                                ? <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                : <Upload className="w-10 h-10 text-primary" />}
                        </div>
                        <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
                    </div>

                    <div className="text-center space-y-3 relative z-10">
                        <h3 className="font-extrabold text-3xl tracking-tight text-foreground">
                            {uploading ? "Uploading..." : "Drop files to index"}
                        </h3>
                        <p className="text-muted-foreground/60 text-sm max-w-sm mx-auto">
                            Documents (PDF, DOCX, XLSX…) and meeting recordings (MP3, MP4, WAV, M4A).
                        </p>
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="h-px w-8 bg-border" />
                        <span className="text-[10px] font-black opacity-20 uppercase tracking-[0.3em]">Supported Formats</span>
                        <div className="h-px w-8 bg-border" />
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 relative z-10 max-w-xs">
                        {['PDF', 'DOCX', 'XLSX', 'CSV', 'SQL', 'MP3', 'MP4', 'WAV', 'M4A'].map(fmt => (
                            <span key={fmt} className={cn(
                                "px-3 py-1.5 rounded-xl border text-[10px] font-bold tracking-widest uppercase",
                                ['MP3', 'MP4', 'WAV', 'M4A'].includes(fmt)
                                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400/70"
                                    : "bg-foreground/5 border-border text-muted-foreground/40"
                            )}>
                                {fmt}
                            </span>
                        ))}
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsLiveTranscriptOpen(true);
                        }}
                        className="mt-6 mx-auto relative z-10 hidden sm:flex items-center gap-3 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                    >
                        <Mic className="w-5 h-5 animate-pulse" />
                        Start Live Transcription
                    </button>
                </div>

                {/* Document List */}
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
                                        Upload documents or meeting recordings to populate your knowledge base.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            documents.map((doc) => {
                                const isAudio = doc.isAudioFile || isAudioType(doc.fileName, doc.fileType);
                                return (
                                    <div
                                        key={doc._id}
                                        className="group relative glass hover:bg-foreground/5 transition-all duration-500 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 border border-border hover:border-primary/20"
                                    >
                                        {/* Icon */}
                                        <div className={cn(
                                            "w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border group-hover:scale-105 transition-transform duration-500 group-hover:border-primary/30",
                                            isAudio ? "bg-violet-500/10 border-violet-500/20" : "bg-foreground/5 border-border"
                                        )}>
                                            {isAudio
                                                ? <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-violet-400 group-hover:text-violet-300 transition-colors" />
                                                : <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground/40 group-hover:text-primary transition-colors duration-500" />}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 space-y-2 sm:space-y-1.5 w-full">
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                <h4 className="font-bold text-sm sm:text-base text-foreground truncate max-w-full sm:max-w-md group-hover:text-primary transition-colors">
                                                    {doc.fileName}
                                                </h4>
                                                {isAudio ? (
                                                    <span className="text-[8px] sm:text-[9px] font-black bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/20 text-violet-400 uppercase tracking-tighter">
                                                        Recording
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] sm:text-[9px] font-black bg-foreground/5 px-2.5 py-1 rounded-lg border border-border text-muted-foreground/40 uppercase tracking-tighter">
                                                        {doc.fileType.split("/")[1]?.toUpperCase() || "DOC"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                    {formatSize(doc.fileSize)}
                                                </div>
                                                {isAudio && doc.durationSeconds && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                        {formatDuration(doc.durationSeconds)}
                                                    </div>
                                                )}
                                                {isAudio && doc.speakerCount && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                        {doc.speakerCount} speaker{doc.speakerCount > 1 ? "s" : ""}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-foreground/10" />
                                                    {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/10">
                                            {/* Status badge */}
                                            <div className={cn(
                                                "flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2.5 px-4 py-2 rounded-xl sm:rounded-2xl border text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500",
                                                doc.status === "READY" && "bg-emerald-500/5 text-emerald-400 border-emerald-500/10 group-hover:bg-emerald-500/10",
                                                doc.status === "PROCESSING" && "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary/10",
                                                doc.status === "FAILED" && "bg-destructive/5 text-destructive border-destructive/10 group-hover:bg-destructive/10",
                                                doc.status === "PENDING" && "bg-foreground/5 text-muted-foreground/40 border-border"
                                            )}>
                                                {doc.status === "PROCESSING" ? <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> :
                                                    doc.status === "READY" ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> :
                                                        doc.status === "FAILED" ? <AlertCircle className="w-3.5 h-3.5" /> :
                                                            <Clock className="w-3.5 h-3.5" />}
                                                {doc.status}
                                            </div>

                                            {/* View transcript / analytics button for audio */}
                                            {isAudio && doc.status === "READY" && (
                                                <button
                                                    onClick={() => setSelectedAudioDoc(doc)}
                                                    className="p-3.5 rounded-2xl text-violet-400/50 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-300 opacity-0 group-hover:opacity-100"
                                                    title="View transcript & analytics"
                                                >
                                                    <Mic className="w-4 h-4" />
                                                </button>
                                            )}

                                            {/* Delete */}
                                            <button
                                                onClick={() => handleDelete(doc._id)}
                                                className="p-3.5 rounded-2xl text-muted-foreground/20 hover:text-primary-foreground hover:bg-destructive shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
