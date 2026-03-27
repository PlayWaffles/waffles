import { prisma } from "@/lib/db";
import Link from "next/link";
import { UserActions } from "@/components/admin/UserActions";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getDisplayName } from "@/lib/address";

// ==========================================
// DATA FETCHING
// ==========================================
async function getUser(id: string) {
    return prisma.user.findUnique({
        where: { id },
        include: {
            referrals: {
                select: {
                    id: true,
                    fid: true,
                    username: true,
                    isBanned: true,
                    pfpUrl: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            },
            referredBy: {
                select: {
                    id: true,
                    fid: true,
                    username: true,
                },
            },
            entries: {
                select: {
                    id: true,
                    paidAmount: true,
                    game: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    score: true,
                    paidAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
            _count: {
                select: {
                    referrals: true,
                    entries: true,
                },
            },
        },
    });
}

// ==========================================
// COMPONENT
// ==========================================
export default async function UserDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await getUser(id);

    if (!user) {
        notFound();
    }

    const paidEntriesCount = user.entries.filter(e => e.paidAt).length;

    // Helper for formatting currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* BACK LINK */}
            <div>
                <Link
                    href="/admin/users"
                    className="inline-flex items-center text-sm font-medium text-white/50 hover:text-white transition-colors"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Users
                </Link>
            </div>

            {/* HEADER HEADER */}
            <div className="bg-white/5 border border-white/[0.08] rounded-3xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-r from-[#FFC931]/5 to-purple-500/5 opacity-50" />

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        {/* Avatar */}
                        <div className="relative w-20 h-20 md:w-24 md:h-24">
                            {user.pfpUrl ? (
                                <Image
                                    src={user.pfpUrl}
                                    alt={user.username || "User"}
                                    fill
                                    className="rounded-full object-cover border-4 border-white/10"
                                />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-[#FFC931] to-[#FF6B35] rounded-full border-4 border-white/10 flex items-center justify-center text-2xl font-bold text-white">
                                    {user.username?.[0]?.toUpperCase() || "U"}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-[#0E0E0E] p-1.5 rounded-full">
                                {user.isBanned ? (
                                    <div className="w-4 h-4 rounded-full bg-red-500" />
                                ) : (
                                    <div className="w-4 h-4 rounded-full bg-[#14B985] shadow-[0_0_10px_#14B985]" />
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-white font-display tracking-tight">
                                    {getDisplayName({ username: user.username, wallet: user.wallet })}
                                </h1>
                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wider uppercase border ${user.role === 'ADMIN'
                                    ? 'bg-[#FB72FF]/10 text-[#FB72FF] border-[#FB72FF]/20'
                                    : 'bg-white/5 text-white/50 border-white/10'
                                    }`}>
                                    {user.role}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm font-medium">
                                <span className="text-white/60">@{user.username}</span>
                                <span className="text-white/20">•</span>
                                <span className="text-white/60">FID: <span className="font-mono text-white/80">{user.fid}</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block mr-4">
                            <div className="text-sm text-white/40 font-medium">Status</div>
                            <div className={`text-lg font-bold ${user.isBanned ? 'text-red-400' : 'text-[#14B985]'
                                }`}>
                                {user.isBanned ? 'BANNED' : 'ACTIVE'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN (MAIN CONTENT) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* STATS ROW */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.07] transition-colors group">
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 group-hover:text-[#FFC931] transition-colors">Referrals</div>
                            <div className="text-3xl font-bold text-white font-display">{user._count.referrals}</div>
                        </div>
                        <div className="bg-white/5 border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.07] transition-colors group">
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 group-hover:text-[#00CFF2] transition-colors">Games Played</div>
                            <div className="text-3xl font-bold text-white font-display">{user._count.entries}</div>
                        </div>
                        <div className="bg-white/5 border border-white/[0.08] rounded-2xl p-5 hover:bg-white/[0.07] transition-colors group">
                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2 group-hover:text-[#14B985] transition-colors">Paid Entries</div>
                            <div className="text-3xl font-bold text-white font-display">{paidEntriesCount}</div>
                        </div>
                    </div>

                    {/* DETAILS CARD */}
                    <div className="bg-white/5 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-sm">
                        <h3 className="text-lg font-bold text-white mb-6 font-display flex items-center">
                            <svg className="w-5 h-5 mr-2 text-[#00CFF2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wide">Wallet Address</label>
                                <div className="font-mono text-sm text-white/90 break-all bg-black/20 p-2 rounded-lg border border-white/5">
                                    {user.wallet || "Not connected"}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wide">User ID</label>
                                <div className="font-mono text-sm text-white/90 break-all bg-black/20 p-2 rounded-lg border border-white/5">
                                    {user.id}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wide">Invite Code</label>
                                <div className="font-mono text-sm text-[#FFC931] font-bold">
                                    {user.inviteCode}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wide">Referred By</label>
                                <div>
                                    {user.referredBy ? (
                                        <Link href={`/admin/users/${user.referredBy.id}`} className="inline-flex items-center text-sm font-medium text-[#00CFF2] hover:underline">
                                            @{user.referredBy.username}
                                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </Link>
                                    ) : (
                                        <span className="text-white/30 text-sm">No referrer</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wide">Joined Date</label>
                                <div className="text-sm text-white/90">
                                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GAME HISTORY */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-white font-display px-1 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-[#FB72FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Recent Game History
                        </h3>
                        {user.entries.length > 0 ? (
                            <div className="bg-white/5 border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="py-4 px-6 text-xs font-bold text-white/40 uppercase tracking-wider">Game</th>
                                            <th className="py-4 px-6 text-xs font-bold text-white/40 uppercase tracking-wider">Date</th>
                                            <th className="py-4 px-6 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Fee</th>
                                            <th className="py-4 px-6 text-xs font-bold text-white/40 uppercase tracking-wider text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {user.entries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-medium text-white">{entry.game.title}</div>
                                                    <div className="text-xs text-white/40 truncate w-32 font-mono mt-0.5">{entry.id}</div>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-white/70">
                                                    {new Date(entry.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="py-4 px-6 text-sm text-right font-medium text-white">
                                                    {entry.paidAmount ? formatCurrency(entry.paidAmount) : '-'}
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${entry.paidAt
                                                        ? 'bg-[#14B985]/10 text-[#14B985] border border-[#14B985]/20'
                                                        : 'bg-white/5 text-white/40 border border-white/10'
                                                        }`}>
                                                        {entry.paidAt ? 'PAID' : 'PENDING'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-white/5 border border-white/[0.08] rounded-2xl p-8 text-center">
                                <p className="text-white/40">No game history found for this user.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN (SIDEBAR) */}
                <div className="space-y-8">

                    {/* ACTIONS */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider px-1">Management</h3>
                        <UserActions user={user} />
                    </div>

                    {/* REFERRALS */}
                    <div className="bg-white/5 border border-white/[0.08] rounded-2xl backdrop-blur-sm overflow-hidden">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-white font-display">Recent Referrals</h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                                {user._count.referrals} total
                            </span>
                        </div>

                        {user.referrals.length > 0 ? (
                            <div className="divide-y divide-white/5">
                                {user.referrals.map((referral) => (
                                    <Link
                                        key={referral.id}
                                        href={`/admin/users/${referral.id}`}
                                        className="flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[#202020] flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                                            {referral.pfpUrl ? (
                                                <Image width={40} height={40} src={referral.pfpUrl} alt={referral.username || ""} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold text-white/60">
                                                    {referral.username?.[0]?.toUpperCase() || "U"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-sm font-medium text-white group-hover:text-[#FFC931] transition-colors truncate">
                                                    @{referral.username}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${referral.isBanned ? 'text-red-400' : 'text-[#14B985]'
                                                    }`}>
                                                    {referral.isBanned ? 'Banned' : 'Active'}
                                                </span>
                                                <span className="text-[10px] text-white/20">•</span>
                                                <span className="text-[10px] text-white/40">
                                                    {new Date(referral.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-white/40 text-sm">
                                Use invite code <span className="text-[#FFC931] font-mono">{user.inviteCode}</span>
                            </div>
                        )}
                        <div className="p-3 bg-white/[0.02] border-t border-white/5 text-center">
                            <span className="text-xs text-white/30 font-medium tracking-wide">Showing last 10</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
