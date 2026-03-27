"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, ClipboardIcon, TrashIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { generateInviteCodeAction, generateInviteCodesAction, deleteInviteCodeAction } from "@/actions/admin/invite-codes";
import { useRouter } from "next/navigation";

// ============================================
// COPY BUTTON WITH FEEDBACK
// ============================================

export function CopyButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.button
            onClick={handleCopy}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${copied
                ? "bg-[#14B985]/20 text-[#14B985]"
                : "bg-[#FFC931]/10 text-[#FFC931] hover:bg-[#FFC931]/20"
                }`}
        >
            <AnimatePresence mode="wait">
                {copied ? (
                    <motion.span
                        key="check"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-1.5"
                    >
                        <CheckIcon className="w-4 h-4" />
                        Copied!
                    </motion.span>
                ) : (
                    <motion.span
                        key="copy"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-1.5"
                    >
                        <ClipboardIcon className="w-4 h-4" />
                        Copy
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
}

// ============================================
// DELETE BUTTON WITH CONFIRMATION
// ============================================

export function DeleteButton({ id, code }: { id: string; code: string }) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setDeleting(true);
        await deleteInviteCodeAction(id);
        router.refresh();
    };

    if (confirming) {
        return (
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-2"
            >
                <span className="text-white/50 text-xs">Delete {code}?</span>
                <motion.button
                    onClick={handleDelete}
                    disabled={deleting}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30"
                >
                    {deleting ? "..." : "Yes"}
                </motion.button>
                <motion.button
                    onClick={() => setConfirming(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-2 py-1 rounded bg-white/10 text-white/60 text-xs font-medium hover:bg-white/20"
                >
                    No
                </motion.button>
            </motion.div>
        );
    }

    return (
        <motion.button
            onClick={() => setConfirming(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1 text-red-400/60 hover:text-red-400 text-sm transition-colors"
        >
            <TrashIcon className="w-4 h-4" />
        </motion.button>
    );
}

// ============================================
// GENERATE CODE BUTTON
// ============================================

export function GenerateCodeButton() {
    const [generating, setGenerating] = useState(false);
    const [lastCode, setLastCode] = useState<string | null>(null);
    const router = useRouter();

    const handleGenerate = async () => {
        setGenerating(true);
        const result = await generateInviteCodeAction();
        if (result.success && result.data) {
            setLastCode(result.data.code);
            setTimeout(() => setLastCode(null), 5000);
        }
        setGenerating(false);
        router.refresh();
    };

    return (
        <div className="flex items-center gap-3">
            <AnimatePresence>
                {lastCode && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.8 }}
                        className="flex items-center gap-2 px-3 py-2 bg-[#14B985]/20 rounded-xl border border-[#14B985]/30"
                    >
                        <CheckIcon className="w-4 h-4 text-[#14B985]" />
                        <span className="font-mono text-[#14B985] font-bold">{lastCode}</span>
                        <CopyButton code={lastCode} />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                onClick={handleGenerate}
                disabled={generating}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-[#FFC931] hover:bg-[#FFD966] shadow-lg shadow-[#FFC931]/20 transition-all duration-200 hover:shadow-[#FFC931]/30 font-display disabled:opacity-50"
            >
                {generating ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                        <SparklesIcon className="w-4 h-4" />
                    </motion.div>
                ) : (
                    <SparklesIcon className="w-4 h-4" />
                )}
                {generating ? "Generating..." : "Generate Code"}
            </motion.button>
        </div>
    );
}

// ============================================
// BULK GENERATE MODAL
// ============================================

export function BulkGenerateButton() {
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState(10);
    const [note, setNote] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
    const router = useRouter();

    const handleGenerate = async () => {
        setGenerating(true);
        const result = await generateInviteCodesAction(count, note || undefined);
        if (result.success && result.data) {
            setGeneratedCodes(result.data.codes);
        }
        setGenerating(false);
        router.refresh();
    };

    const handleCopyAll = async () => {
        await navigator.clipboard.writeText(generatedCodes.join("\n"));
    };

    const handleClose = () => {
        setOpen(false);
        setGeneratedCodes([]);
        setCount(10);
        setNote("");
    };

    return (
        <>
            <motion.button
                onClick={() => setOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
                Bulk Generate
            </motion.button>

            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClose}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed inset-0 flex items-center justify-center z-50 p-4"
                        >
                            <div className="bg-linear-to-br from-[#0F0F15] to-[#0a0a0d] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-white font-display">
                                        Bulk Generate Codes
                                    </h3>
                                    <button
                                        onClick={handleClose}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {generatedCodes.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="bg-[#14B985]/10 border border-[#14B985]/30 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-[#14B985] font-medium">
                                                    {generatedCodes.length} codes generated!
                                                </span>
                                                <motion.button
                                                    onClick={handleCopyAll}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="px-3 py-1.5 bg-[#14B985]/20 rounded-lg text-[#14B985] text-sm font-medium"
                                                >
                                                    Copy All
                                                </motion.button>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto space-y-1">
                                                {generatedCodes.map((code) => (
                                                    <div key={code} className="font-mono text-white/80 text-sm">
                                                        {code}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleClose}
                                            className="w-full py-2.5 bg-white/10 hover:bg-white/15 rounded-xl text-white font-medium transition-colors"
                                        >
                                            Done
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-white/60 mb-2">
                                                Number of Codes
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={count}
                                                onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#FFC931]/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/60 mb-2">
                                                Note (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                placeholder="e.g. Twitter giveaway Dec 2025"
                                                maxLength={100}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FFC931]/50"
                                            />
                                        </div>
                                        <motion.button
                                            onClick={handleGenerate}
                                            disabled={generating}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full py-3 bg-[#FFC931] hover:bg-[#FFD966] rounded-xl text-black font-bold transition-colors disabled:opacity-50"
                                        >
                                            {generating ? "Generating..." : `Generate ${count} Codes`}
                                        </motion.button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

// ============================================
// CODE ROW WITH ANIMATION
// ============================================

export function CodeRow({
    code,
    index,
}: {
    code: {
        id: string;
        code: string;
        usedById: string | null;
        usedAt: Date | null;
        createdAt: Date;
        note: string | null;
        usedBy: { username: string | null; fid: number | null } | null;
    };
    index: number;
}) {
    return (
        <motion.tr
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="border-b border-white/5 hover:bg-white/3 transition-colors"
        >
            <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-mono text-[#FFC931] text-lg font-bold tracking-wider">
                    {code.code}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                {code.usedById ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50">
                        Used
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#14B985]/15 text-[#14B985]">
                        <span className="w-1.5 h-1.5 bg-[#14B985] rounded-full mr-1.5 animate-pulse" />
                        Available
                    </span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                {code.usedBy ? (
                    <a
                        href={`/admin/users/${code.usedById}`}
                        className="text-white hover:text-[#FFC931] transition-colors"
                    >
                        @{code.usedBy.username || code.usedBy.fid}
                    </a>
                ) : (
                    <span className="text-white/30">—</span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                {code.createdAt.toLocaleDateString()}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/40 max-w-[150px] truncate">
                {code.note || "—"}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                    <CopyButton code={code.code} />
                    {!code.usedById && <DeleteButton id={code.id} code={code.code} />}
                </div>
            </td>
        </motion.tr>
    );
}
