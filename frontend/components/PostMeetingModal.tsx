"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Save, X } from "lucide-react";
import { API_BASE_URL, ApiService } from "@/lib/api";

interface PostMeetingModalProps {
    documentId: string;
    onClose: () => void;
    onSaved: () => void;
}

export function PostMeetingModal({ documentId, onClose, onSaved }: PostMeetingModalProps) {
    const [status, setStatus] = useState<"PROCESSING" | "READY" | "FAILED" | "PENDING">("PROCESSING");
    const [isSaving, setIsSaving] = useState(false);

    // Poll status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        const checkStatus = async () => {
            try {
                const res = await ApiService.get<any>(`/documents/${documentId}/status`);
                setStatus(res.status);
                if (res.status === "READY" || res.status === "FAILED") {
                    clearInterval(interval);
                }
            } catch (error) {
                console.error("Status error", error);
            }
        };

        checkStatus();
        interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [documentId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await ApiService.patch(`/documents/${documentId}/save`);
            onSaved();
            onClose();
        } catch (error) {
            alert("Failed to save document.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async (type: "pdf" | "txt") => {
        const url = type === "pdf"
            ? `${API_BASE_URL}/documents/${documentId}/summary/pdf`
            : `${API_BASE_URL}/documents/${documentId}/transcript/download`;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(url, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            });

            if (!res.ok) {
                if (res.status === 422) {
                    alert("Analytics not ready yet. Please wait a moment for background generation.");
                    return;
                }
                throw new Error(`Download failed: ${res.statusText}`);
            }

            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `Meeting_${type === "pdf" ? "Summary.pdf" : "Transcript.txt"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            alert(`Failed to download ${type.toUpperCase()}`);
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-card border border-border rounded-3xl shadow-2xl p-6 w-full max-w-md flex flex-col relative overflow-hidden">

                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-foreground/5 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="text-center space-y-4 pt-4 pb-8 border-b border-border/50">
                    <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                        {status === "PROCESSING" || status === "PENDING" ? (
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        ) : status === "READY" ? (
                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        ) : (
                            <X className="w-8 h-8 text-destructive" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Meeting Concluded</h2>
                        <p className="text-sm text-muted-foreground/80 mt-1 max-w-[280px] mx-auto">
                            {status === "PROCESSING" || status === "PENDING"
                                ? "We're diarizing the speakers and generating analytics in the background."
                                : status === "READY"
                                    ? "The meeting has been fully analyzed! What would you like to do?"
                                    : "An error occurred while processing the meeting."}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 py-6">
                    <button
                        onClick={handleSave}
                        disabled={status !== "READY" || isSaving}
                        className="flex items-center gap-3 w-full p-4 rounded-2xl border border-primary/20 bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50 text-left group"
                    >
                        <Save className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">Save to Knowledge Base</p>
                            <p className="text-[11px] text-muted-foreground/70">Keep this document permanently.</p>
                        </div>
                    </button>

                    <button
                        onClick={() => handleDownload("txt")}
                        disabled={status !== "READY"}
                        className="flex items-center gap-3 w-full p-4 rounded-2xl border border-border bg-foreground/2 hover:bg-foreground/5 transition-colors disabled:opacity-50 text-left"
                    >
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">Download Transcript</p>
                            <p className="text-[11px] text-muted-foreground/70">Save the raw text locally as .txt</p>
                        </div>
                    </button>

                    <button
                        onClick={() => handleDownload("pdf")}
                        disabled={status !== "READY"}
                        className="flex items-center gap-3 w-full p-4 rounded-2xl border border-border bg-foreground/2 hover:bg-foreground/5 transition-colors disabled:opacity-50 text-left"
                    >
                        <Download className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">Analyze Meeting Summary</p>
                            <p className="text-[11px] text-muted-foreground/70">Download a formatted PDF summary</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
