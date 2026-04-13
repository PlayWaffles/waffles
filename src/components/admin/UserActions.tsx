"use client";

import {
    banUserAction,
    unbanUserAction,
    adjustInviteQuotaAction,
    promoteToAdminAction
} from "@/actions/admin/users";
import { useState } from "react";

interface UserActionsProps {
    user: {
        id: string;
        username: string | null;
        inviteQuota: number;
        isBanned: boolean;
        role: string;
    };
}

// Loading spinner component
function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

export function UserActions({ user }: UserActionsProps) {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ type: string; message: string; onConfirm: () => void } | null>(null);
    const [quotaInput, setQuotaInput] = useState<string | null>(null);

    // Clear messages after 3 seconds
    const showMessage = (type: 'success' | 'error', message: string) => {
        if (type === 'success') {
            setSuccess(message);
            setError(null);
        } else {
            setError(message);
            setSuccess(null);
        }
        setTimeout(() => {
            setSuccess(null);
            setError(null);
        }, 3000);
    };

    const executeBan = async () => {
        setConfirmAction(null);
        setLoading('ban');
        const result = await banUserAction(user.id);
        setLoading(null);
        if (result.success) showMessage('success', 'User banned');
        else showMessage('error', result.error);
    };

    const executeUnban = async () => {
        setConfirmAction(null);
        setLoading('unban');
        const result = await unbanUserAction(user.id);
        setLoading(null);
        if (result.success) showMessage('success', 'User unbanned');
        else showMessage('error', result.error);
    };

    const executePromote = async () => {
        setConfirmAction(null);
        setLoading('promote');
        const result = await promoteToAdminAction(user.id);
        setLoading(null);
        if (result.success) {
            setTempPassword(result.tempPassword ?? null);
            showMessage('success', 'User promoted to admin');
        } else {
            showMessage('error', result.error);
        }
    };

    const handleBan = () => {
        setConfirmAction({
            type: 'ban',
            message: `Ban @${user.username || 'this user'}? This will block them from all platform activities.`,
            onConfirm: executeBan,
        });
    };

    const handleUnban = () => {
        setConfirmAction({
            type: 'unban',
            message: `Unban @${user.username || 'this user'}? They will regain access to the platform.`,
            onConfirm: executeUnban,
        });
    };

    const handleQuotaAdjust = () => {
        setQuotaInput(user.inviteQuota.toString());
    };

    const submitQuotaAdjust = async () => {
        if (quotaInput === null) return;
        const quota = parseInt(quotaInput);
        if (isNaN(quota) || quota < 0) {
            showMessage('error', 'Invalid quota — must be a positive number');
            setQuotaInput(null);
            return;
        }
        setQuotaInput(null);
        setLoading('quota');
        const result = await adjustInviteQuotaAction(user.id, quota);
        setLoading(null);
        if (result.success) showMessage('success', `Invite quota updated to ${quota}`);
        else showMessage('error', result.error);
    };

    const handlePromoteToAdmin = () => {
        setConfirmAction({
            type: 'promote',
            message: `Promote @${user.username || 'this user'} to ADMIN? This grants full administrative access. Use with extreme caution.`,
            onConfirm: executePromote,
        });
    };

    const isLoading = loading !== null;

    return (
        <div className="bg-white/5 border border-white/8 rounded-2xl backdrop-blur-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 font-display">Actions</h3>

            {/* Confirmation Dialog */}
            {confirmAction && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10" role="alertdialog" aria-label="Confirm action">
                    <p className="text-sm text-white mb-3">{confirmAction.message}</p>
                    <div className="flex gap-2">
                        <button
                            onClick={confirmAction.onConfirm}
                            className="px-4 py-2 bg-red-500/20 text-red-400 text-sm font-medium rounded-xl hover:bg-red-500/30 border border-red-500/30 transition-colors"
                        >
                            Confirm
                        </button>
                        <button
                            onClick={() => setConfirmAction(null)}
                            className="px-4 py-2 bg-white/10 text-white/70 text-sm font-medium rounded-xl hover:bg-white/20 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Quota Input Dialog */}
            {quotaInput !== null && (
                <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10" role="dialog" aria-label="Adjust invite quota">
                    <p className="text-sm text-white/70 mb-2">New invite quota for @{user.username}:</p>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="0"
                            value={quotaInput}
                            onChange={(e) => setQuotaInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") submitQuotaAdjust(); if (e.key === "Escape") setQuotaInput(null); }}
                            className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00CFF2]/50"
                            autoFocus
                        />
                        <button onClick={submitQuotaAdjust} className="px-4 py-2 bg-[#00CFF2]/20 text-[#00CFF2] text-sm font-medium rounded-xl hover:bg-[#00CFF2]/30 border border-[#00CFF2]/30 transition-colors">
                            Save
                        </button>
                        <button onClick={() => setQuotaInput(null)} className="px-4 py-2 bg-white/10 text-white/70 text-sm font-medium rounded-xl hover:bg-white/20 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Status Messages */}
            {success && (
                <div className="mb-4 p-3 rounded-xl bg-[#14B985]/20 border border-[#14B985]/30 text-[#14B985] text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {success}
                </div>
            )}
            {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <p className="text-sm font-medium text-white/50 mb-3">Account Moderation</p>
                    <div className="flex flex-wrap gap-2">
                        {user.isBanned ? (
                            <button
                                onClick={handleUnban}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-[#FFC931]/20 disabled:opacity-40 text-[#FFC931] text-sm rounded-xl hover:bg-[#FFC931]/30 border border-[#FFC931]/30 transition-colors font-medium flex items-center gap-2"
                            >
                                {loading === 'unban' && <Spinner />}
                                Unban
                            </button>
                        ) : (
                            <button
                                onClick={handleBan}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-red-500/20 disabled:opacity-40 text-red-400 text-sm rounded-xl hover:bg-red-500/30 border border-red-500/30 transition-colors font-medium flex items-center gap-2"
                            >
                                {loading === 'ban' && <Spinner />}
                                Ban
                            </button>
                        )}
                    </div>
                    <p className="mt-3 text-xs text-white/35">
                        Game access is no longer invite-gated. Use bans only when you need to block a user entirely.
                    </p>
                </div>

                {/* Invite Quota */}
                <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-white/50">Invite Quota</p>
                        <span className="text-sm font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded-md">
                            {user.inviteQuota}
                        </span>
                    </div>
                    <button
                        onClick={handleQuotaAdjust}
                        disabled={isLoading}
                        className="w-full px-4 py-2.5 bg-[#00CFF2]/20 disabled:opacity-40 text-[#00CFF2] text-sm font-medium rounded-xl hover:bg-[#00CFF2]/30 border border-[#00CFF2]/30 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading === 'quota' && <Spinner />}
                        Adjust Invite Quota
                    </button>
                </div>

                {/* Promote to Admin */}
                {user.role !== "ADMIN" && (
                    <div className="pt-4 border-t border-white/10">
                        <p className="text-xs text-white/30 mb-2">Danger Zone</p>
                        <button
                            onClick={handlePromoteToAdmin}
                            disabled={isLoading}
                            className="w-full px-4 py-2.5 bg-[#FB72FF]/20 disabled:opacity-40 text-[#FB72FF] text-sm font-medium rounded-xl hover:bg-[#FB72FF]/30 border border-[#FB72FF]/30 transition-colors flex items-center justify-center gap-2"
                        >
                            {loading === 'promote' && <Spinner />}
                            Promote to Admin
                        </button>
                    </div>
                )}

                {/* Temporary Password (shown once after promotion) */}
                {tempPassword && (
                    <div className="pt-4 border-t border-white/10">
                        <div className="p-4 rounded-xl bg-[#FFC931]/10 border border-[#FFC931]/30">
                            <p className="text-sm font-semibold text-[#FFC931] mb-1">Temporary Password</p>
                            <p className="text-xs text-white/50 mb-3">
                                Share this with the new admin. They should change it after first login.
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-black/40 rounded-lg text-sm font-mono text-white select-all break-all">
                                    {tempPassword}
                                </code>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(tempPassword);
                                        showMessage('success', 'Password copied');
                                    }}
                                    className="shrink-0 px-3 py-2 bg-white/10 text-white/70 text-xs rounded-lg hover:bg-white/20 transition-colors font-medium"
                                >
                                    Copy
                                </button>
                            </div>
                            <p className="text-xs text-white/30 mt-2">
                                Username: <span className="font-mono text-white/50">@{user.username}</span>
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
