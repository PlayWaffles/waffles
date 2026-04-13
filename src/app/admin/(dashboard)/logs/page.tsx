import { prisma } from "@/lib/db";
import Link from "next/link";

async function getAuditLogs(page: number = 1) {
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            skip,
            take: pageSize,
            orderBy: { createdAt: "desc" },
            include: {
                admin: {
                    select: {
                        fid: true,
                        username: true,
                    },
                },
            },
        }),
        prisma.auditLog.count(),
    ]);

    return { logs, total, page, pageSize };
}

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const resolvedParams = await searchParams;
    const page = parseInt(resolvedParams.page || "1");
    const { logs, total, pageSize } = await getAuditLogs(page);
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white font-display">Audit Logs</h1>
                <p className="text-white/60 mt-1">
                    Track all admin actions — <span className="text-[#FFC931] font-bold">{total.toLocaleString()}</span> total entries
                </p>
            </div>

            <div className="bg-linear-to-br from-white/6 to-white/2 border border-white/8 rounded-2xl backdrop-blur-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-white/6">
                    <thead className="bg-white/3">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase font-display">
                                Timestamp
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase font-display">
                                Admin
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase font-display">
                                Action
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase font-display">
                                Entity
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase font-display">
                                Details
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/3 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                                    {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 bg-[#FB72FF]/20 rounded-full flex items-center justify-center text-[#FB72FF] font-bold text-xs">
                                            {log.admin.username?.[0]?.toUpperCase() || "A"}
                                        </div>
                                        <span className="text-sm text-white">{log.admin.username}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-[#00CFF2]/20 text-[#00CFF2]">
                                        {log.action.replace(/_/g, " ")}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                                    <span className="text-white">{log.entityType}</span>
                                    {log.entityId && <span className="text-[#FFC931] ml-1">#{log.entityId}</span>}
                                </td>
                                <td className="px-6 py-4 text-white/50 max-w-md truncate font-mono text-xs">
                                    {log.details ? JSON.stringify(log.details) : "—"}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                                            <span className="text-3xl">📋</span>
                                        </div>
                                        <p className="text-white font-display">No audit logs yet</p>
                                        <p className="text-sm text-white/50 mt-1">Actions will appear here as admins use the dashboard.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    {page > 1 && (
                        <Link
                            href={`?page=${page - 1}`}
                            className="px-4 py-2 border border-white/10 rounded-xl hover:bg-white/5 text-sm font-medium text-white transition-colors"
                        >
                            Previous
                        </Link>
                    )}
                    <span className="px-4 py-2 text-sm text-white/50">
                        Page <span className="text-white font-medium">{page}</span> of <span className="text-white font-medium">{totalPages}</span>
                    </span>
                    {page < totalPages && (
                        <Link
                            href={`?page=${page + 1}`}
                            className="px-4 py-2 bg-[#FFC931] text-black rounded-xl hover:bg-[#FFD966] text-sm font-bold transition-colors"
                        >
                            Next
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

