"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PhotoIcon, XMarkIcon, MusicalNoteIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import Image from "next/image";

interface MediaFile {
    url: string;
    pathname: string;
    contentType: string;
    size: number;
}

interface MediaPickerProps {
    label: string;
    name: string;
    accept?: "image" | "audio" | "video" | "all";
    onSelect: (url: string) => void;
    selectedUrl?: string;
}

export function MediaPicker({ label, name, accept = "all", onSelect, selectedUrl }: MediaPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("");
    const [mounted, setMounted] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Ensure we're mounted before using portal
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadMedia();
        }
    }, [isOpen]);

    // Upload file to Cloudinary
    const uploadFile = useCallback(async (file: File) => {
        setIsUploading(true);
        setUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "questions");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }

            const data = await response.json();
            onSelect(data.url);
        } catch (err) {
            console.error("Upload failed:", err);
            setUploadError(err instanceof Error ? err.message : "Failed to upload");
        } finally {
            setIsUploading(false);
        }
    }, [onSelect]);

    // Handle paste event
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith("image/") && (accept === "image" || accept === "all")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await uploadFile(file);
                }
                return;
            }
        }
    }, [accept, uploadFile]);

    // Attach paste listener to the drop zone
    useEffect(() => {
        const dropZone = dropZoneRef.current;
        if (!dropZone) return;

        const onPaste = (e: Event) => handlePaste(e as ClipboardEvent);
        dropZone.addEventListener("paste", onPaste);
        return () => {
            dropZone.removeEventListener("paste", onPaste);
        };
    }, [handlePaste]);

    const loadMedia = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/v1/admin/media");
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
            }
        } catch (error) {
            console.error("Failed to load media:", error);
        } finally {
            setLoading(false);
        }
    };

    const inferContentType = (pathname: string, storedContentType: string): string => {
        if (storedContentType && storedContentType !== 'application/octet-stream') {
            return storedContentType;
        }

        const ext = pathname.split('.').pop()?.toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'];
        const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'webm', 'm4a'];
        const videoExts = ['mp4', 'webm', 'mov', 'avi'];

        if (ext && imageExts.includes(ext)) return `image/${ext}`;
        if (ext && audioExts.includes(ext)) return `audio/${ext}`;
        if (ext && videoExts.includes(ext)) return `video/${ext}`;

        return storedContentType;
    };

    const filteredFiles = files.filter((file) => {
        const actualContentType = inferContentType(file.pathname, file.contentType);

        if (accept !== "all" && !actualContentType.startsWith(accept)) {
            return false;
        }

        if (filter && !file.pathname.toLowerCase().includes(filter.toLowerCase())) {
            return false;
        }

        return true;
    });

    const handleSelect = (url: string) => {
        onSelect(url);
        setIsOpen(false);
    };

    return (
        <div className="space-y-2">
            {label && <label className="block text-sm font-medium text-white/70">{label}</label>}

            {/* Hidden input for form submission */}
            <input type="hidden" name={name} value={selectedUrl || ""} />

            {selectedUrl ? (
                <div className="relative group">
                    <div className="relative w-full h-40 bg-black/30 rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-colors">
                        <Image
                            src={selectedUrl}
                            alt="Selected"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            type="button"
                            onClick={() => setIsOpen(true)}
                            className="flex-1 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-medium text-black hover:bg-white transition-colors shadow-lg"
                        >
                            Change
                        </button>
                        <button
                            type="button"
                            onClick={() => onSelect("")}
                            className="p-2 bg-red-500/90 backdrop-blur-sm rounded-lg text-white hover:bg-red-500 transition-colors shadow-lg"
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    ref={dropZoneRef}
                    className="flex items-stretch rounded-xl border border-white/10 overflow-hidden"
                >
                    {/* Add Image button */}
                    <button
                        type="button"
                        onClick={() => !isUploading && setIsOpen(true)}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-3 bg-white/5 border-r border-white/10 hover:bg-white/10 transition-colors shrink-0 disabled:opacity-50"
                    >
                        {isUploading ? (
                            <div className="h-5 w-5 border-2 border-[#FFC931]/30 border-t-[#FFC931] rounded-full animate-spin" />
                        ) : (
                            <PhotoIcon className="h-5 w-5 text-white/50" />
                        )}
                        <span className="text-sm font-medium text-white/80">
                            {isUploading ? "Uploading..." : "Add Image"}
                        </span>
                    </button>

                    {/* URL / paste input */}
                    <input
                        type="text"
                        placeholder="Add image from URL or paste from clipboard"
                        className="flex-1 px-4 py-3 bg-transparent text-sm text-white placeholder-white/30 focus:outline-none min-w-0"
                        onPaste={async (e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;

                            for (const item of Array.from(items)) {
                                if (item.type.startsWith("image/")) {
                                    e.preventDefault();
                                    const file = item.getAsFile();
                                    if (file) await uploadFile(file);
                                    return;
                                }
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                const value = (e.target as HTMLInputElement).value.trim();
                                if (value) onSelect(value);
                            }
                        }}
                    />

                    {uploadError && (
                        <div className="flex items-center px-3">
                            <span className="text-xs text-red-400">{uploadError}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Media Picker Modal - Rendered via Portal to avoid z-index issues */}
            {mounted && isOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl bg-[#1a1a1a] border border-white/10 rounded-2xl z-[9999] flex flex-col shadow-2xl max-h-[85vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
                            <h2 className="text-lg font-semibold text-white font-display">
                                Select {accept === "all" ? "Media" : accept.charAt(0).toUpperCase() + accept.slice(1)}
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-white/10 shrink-0">
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] text-white placeholder-white/40 transition-all"
                            />
                        </div>

                        {/* Files Grid */}
                        <div className="flex-1 overflow-y-auto p-4 min-h-0">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-white/50">Loading...</div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-white/50">No files found</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredFiles.map((file) => {
                                        const actualContentType = inferContentType(file.pathname, file.contentType);
                                        const fileName = file.pathname.split("/").pop() || "";

                                        return (
                                            <div
                                                key={file.url}
                                                className="relative flex flex-col bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-[#FFC931]/50 transition-all group cursor-pointer"
                                                onClick={() => handleSelect(file.url)}
                                            >
                                                {/* Preview Area */}
                                                <div className="aspect-video bg-black/30 flex items-center justify-center relative overflow-hidden">
                                                    {actualContentType.startsWith("image") ? (
                                                        <Image
                                                            src={file.url}
                                                            alt={fileName}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform"
                                                            unoptimized
                                                        />
                                                    ) : actualContentType.startsWith("audio") ? (
                                                        <div className="flex flex-col items-center gap-2 w-full p-4">
                                                            <MusicalNoteIcon className="h-10 w-10 text-[#FB72FF]" />
                                                            <span className="text-xs text-white/50">Audio</span>
                                                        </div>
                                                    ) : actualContentType.startsWith("video") ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <VideoCameraIcon className="h-10 w-10 text-[#00CFF2]" />
                                                            <span className="text-xs text-white/50">Video</span>
                                                        </div>
                                                    ) : (
                                                        <PhotoIcon className="h-10 w-10 text-white/40" />
                                                    )}
                                                </div>

                                                {/* File Name & Audio Player */}
                                                <div className="p-2.5 bg-black/20 border-t border-white/5">
                                                    <div className="text-xs text-white/70 truncate font-medium">
                                                        {fileName}
                                                    </div>
                                                    {actualContentType.startsWith("audio") && (
                                                        <audio
                                                            controls
                                                            className="w-full h-7 mt-2"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onPlay={(e) => e.stopPropagation()}
                                                        >
                                                            <source src={file.url} type={actualContentType} />
                                                        </audio>
                                                    )}
                                                </div>

                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 bg-[#FFC931]/0 group-hover:bg-[#FFC931]/5 transition-colors pointer-events-none" />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}

