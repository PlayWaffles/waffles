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

    const handleBan = async () => {
        if (!confirm(`Ban @${user.username || 'this user'}?\n\n⚠️ This will block them from all platform activities.`)) return;

        setLoading('ban');
        const result = await banUserAction(user.id);
        setLoading(null);

        if (result.success) {
            showMessage('success', 'User banned');
        } else {
            showMessage('error', result.error);
        }
    };

    const handleUnban = async () => {
        if (!confirm(`Unban @${user.username || 'this user'}?\n\nThey will regain access to the platform.`)) return;

        setLoading('unban');
        const result = await unbanUserAction(user.id);
        setLoading(null);

        if (result.success) {
            showMessage('success', 'User unbanned');
        } else {
            showMessage('error', result.error);
        }
    };

    const handleQuotaAdjust = async () => {
        const newQuota = prompt(`Enter new invite quota for @${user.username || 'this user'}:\n\nCurrent quota: ${user.inviteQuota}`, user.inviteQuota.toString());
        if (!newQuota) return;

        const quota = parseInt(newQuota);
        if (isNaN(quota) || quota < 0) {
            showMessage('error', 'Invalid quota - must be a positive number');
            return;
        }

        setLoading('quota');
        const result = await adjustInviteQuotaAction(user.id, quota);
        setLoading(null);

        if (result.success) {
            showMessage('success', `Invite quota updated to ${quota}`);
        } else {
            showMessage('error', result.error);
        }
    };

    const handlePromoteToAdmin = async () => {
        if (!confirm(`Promote @${user.username || 'this user'} to ADMIN?\n\n⚠️ This grants FULL administrative access to the platform.\n\nThis action should be used with extreme caution.`)) return;

        setLoading('promote');
        const result = await promoteToAdminAction(user.id);
        setLoading(null);

        if (result.success) {
            showMessage('success', 'User promoted to admin');
        } else {
            showMessage('error', result.error);
        }
    };

    const isLoading = loading !== null;

    return (
        <div className="bg-white/5 border border-white/8 rounded-2xl backdrop-blur-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 font-display">Actions</h3>

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
                        <p className="text-xs text-white/30 mb-2">⚠️ Danger Zone</p>
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
            </div>
        </div>
    );
}
