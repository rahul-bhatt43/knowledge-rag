"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { io, Socket } from "socket.io-client";
import { Mic, StopCircle, ExternalLink, X, Loader2 } from "lucide-react";
import { API_BASE_URL, ApiService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LiveTranscriptPiPProps {
    isOpen: boolean;
    onClose: () => void;
    onRecordingComplete: (documentId: string) => void;
}

export function LiveTranscriptPiP({ isOpen, onClose, onRecordingComplete }: LiveTranscriptPiPProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [transcriptTexts, setTranscriptTexts] = useState<{ text: string, id: string }[]>([]);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);

    // Refs for holding state in callbacks
    const socketRef = useRef<Socket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const fullChunksRef = useRef<Blob[]>([]);
    const streamsRef = useRef<MediaStream[]>([]);
    const pipWindowRef = useRef<Window | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Stop all tracks and clean up
    const cleanupAudio = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        streamsRef.current = [];

        if (socketRef.current) {
            socketRef.current.emit("transcription:stop");
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const startRecording = async () => {
        try {
            // 1. Get Streams (Mic + Tab)
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let tabStream: MediaStream;
            try {
                tabStream = await navigator.mediaDevices.getDisplayMedia({
                    audio: true,
                    video: true // needed to pop the tab picker
                });
            } catch (e) {
                // If they cancel or don't share audio, fallback or abort
                micStream.getTracks().forEach(t => t.stop());
                alert("You must share a tab with audio to record the meeting.");
                return;
            }

            // Stop the video track since we only want audio
            tabStream.getVideoTracks().forEach(t => t.stop());

            const tabAudioTrack = tabStream.getAudioTracks()[0];
            if (!tabAudioTrack) {
                micStream.getTracks().forEach(t => t.stop());
                alert("No audio track found in the shared tab. Please ensure 'Share tab audio' is checked.");
                return;
            }

            streamsRef.current = [micStream, tabStream];

            // 2. Mix Streams via Web Audio API
            const ctx = new window.AudioContext({ sampleRate: 16000 });
            audioContextRef.current = ctx;

            const dest = ctx.createMediaStreamDestination();
            const micSource = ctx.createMediaStreamSource(micStream);
            const tabSource = ctx.createMediaStreamSource(new MediaStream([tabAudioTrack]));

            micSource.connect(dest);
            tabSource.connect(dest);

            const mixedStream = dest.stream;

            // 3. Setup PiP Window (if supported)
            if ('documentPictureInPicture' in window) {
                try {
                    // @ts-ignore
                    const pipWin = await window.documentPictureInPicture.requestWindow({
                        width: 500,
                        height: 600
                    });
                    pipWindowRef.current = pipWin;

                    // Copy styles so it looks right
                    [...document.styleSheets].forEach(styleSheet => {
                        try {
                            const cssRules = [...styleSheet.cssRules].map(rule => rule.cssText).join('');
                            const style = document.createElement('style');
                            style.textContent = cssRules;
                            pipWin.document.head.appendChild(style);
                        } catch (e) {
                            const link = document.createElement('link');
                            link.rel = 'stylesheet';
                            link.type = styleSheet.type || "text/css";
                            link.media = styleSheet.media.mediaText;
                            link.href = styleSheet.href!;
                            pipWin.document.head.appendChild(link);
                        }
                    });

                    pipWin.addEventListener("pagehide", () => {
                        // When PiP closes, stop recording
                        stopRecording();
                        setPipWindow(null);
                    });

                    setPipWindow(pipWin);
                } catch (e) {
                    console.error("PiP not supported or failed:", e);
                }
            }

            // 4. Setup Socket.io
            const token = localStorage.getItem("token");
            const socketUrl = API_BASE_URL.replace("/api/v1", "");

            const socket = io(socketUrl, {
                auth: { token },
                transports: ["websocket"],
            });
            socketRef.current = socket;

            socket.on("connect", () => {
                socket.emit("transcription:start");
            });

            socket.on("transcript:live", (data: any) => {
                setTranscriptTexts(prev => {
                    const textStr = `${data.speaker === "unknown" ? "Speaker" : data.speaker}: ${data.text}`;

                    if (data.message_type === "PartialTranscript") {
                        // Update the last one or add new temp one
                        const filtered = prev.filter(p => !p.id.startsWith("partial"));
                        return [...filtered, { text: textStr, id: `partial_${Date.now()}` }].slice(-10); // keep last 10
                    } else if (data.message_type === "FinalTranscript") {
                        const filtered = prev.filter(p => !p.id.startsWith("partial"));
                        return [...filtered, { text: textStr, id: `final_${Date.now()}` }].slice(-10);
                    }
                    return prev;
                });

                // auto scroll
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 50);
            });

            // 5. Send PCM to Socket
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            const mixSourceForProcessor = ctx.createMediaStreamSource(mixedStream);
            mixSourceForProcessor.connect(processor);
            processor.connect(ctx.destination);

            processor.onaudioprocess = (e) => {
                if (!socketRef.current) return;
                const float32Array = e.inputBuffer.getChannelData(0);
                const int16Array = new Int16Array(float32Array.length);
                for (let i = 0; i < float32Array.length; i++) {
                    const s = Math.max(-1, Math.min(1, float32Array[i]));
                    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                socketRef.current.emit("audio:data", int16Array.buffer);
            };

            // 6. Record Full WEBM for upload
            fullChunksRef.current = [];
            const recorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) fullChunksRef.current.push(e.data);
            };
            recorder.start(1000);

            setIsRecording(true);

            // Handle user closing the shared tab
            tabAudioTrack.onended = () => {
                stopRecording();
            };

        } catch (error) {
            console.error(error);
            alert("Failed to start formatting. Ensure microphone and screen share permissions are granted.");
            cleanupAudio();
        }
    };

    const stopRecording = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        setIsUploading(true);

        const chunks = [...fullChunksRef.current];
        cleanupAudio();

        // Retrieve PiP container back to main window if needed
        if (pipWindowRef.current) {
            pipWindowRef.current.close();
            pipWindowRef.current = null;
            setPipWindow(null);
        }

        try {
            // Create final blob
            const finalBlob = new Blob(chunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append("file", finalBlob, `Live_Meeting_${new Date().toISOString().replace(/:/g, '-')}.webm`);
            formData.append("isTemporary", "true");

            const res = await ApiService.post<{ documentId: string }>("/documents/upload", formData);

            onRecordingComplete(res.documentId);
        } catch (error) {
            console.error("Failed to upload recording", error);
            alert("Failed to upload the final recording.");
        } finally {
            setIsUploading(false);
            setTranscriptTexts([]);
            onClose();
        }
    };

    useEffect(() => {
        return () => cleanupAudio();
    }, []);

    if (!isOpen) return null;

    const content = (
        <div className={cn("bg-card w-full flex flex-col", pipWindow ? "h-full p-4 md:p-6" : "max-w-lg border border-border rounded-2xl shadow-2xl p-6 sm:h-[500px]")}>

            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b pb-4 shrink-0">
                <div className="flex items-center gap-2">
                    {isRecording ? (
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    ) : (
                        <Mic className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h3 className="font-bold text-lg text-foreground">
                        Live Transcription
                    </h3>
                </div>
                {!isRecording && !isUploading && (
                    <button onClick={onClose} className="p-1.5 hover:bg-foreground/5 rounded-lg">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                {!isRecording && !isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4">
                        <p className="text-sm text-muted-foreground max-w-sm">
                            When you start, permit microphone access and choose the meeting tab to capture audio. A floating window will appear.
                        </p>
                        <button
                            onClick={startRecording}
                            className="px-6 py-3 bg-primary text-black font-extrabold rounded-xl hover:opacity-90 transition-opacity"
                        >
                            Start Capture
                        </button>
                    </div>
                )}

                {isUploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="font-bold">Saving & Analyzing Meeting...</p>
                        <p className="text-xs text-muted-foreground">This may take a minute depending on duration.</p>
                    </div>
                )}

                {isRecording && (
                    <>
                        <div ref={scrollRef} className="transcript-scroll flex-1 overflow-y-auto space-y-3 pb-4 pr-2">
                            {transcriptTexts.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">
                                    Listening for speech...
                                </div>
                            ) : (
                                transcriptTexts.map((item, idx) => (
                                    <div key={item.id} className={cn(
                                        "text-sm p-3 rounded-lg border",
                                        item.id.startsWith("partial") ? "opacity-60 bg-foreground/2 border-dashed" : "bg-primary/5 border-primary/20 text-foreground"
                                    )}>
                                        {item.text}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 border-t shrink-0 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <ExternalLink className="w-3.5 h-3.5" />
                                {pipWindow ? "Floating Mode" : "Standard Mode"}
                            </p>
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-colors text-sm"
                            >
                                <StopCircle className="w-4 h-4" />
                                Stop
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (pipWindow) {
        return createPortal(content, pipWindow.document.body);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            {content}
        </div>
    );
}
