"use client";

import { TicketIcon, TrophyIcon, CurrencyDollarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GameInsightsProps {
    data: {
        ticketConversion: {
            pending: number;
            paid: number;
            redeemed: number;
            failed: number;
        };
        totalPrizePool: number;
        gamesCompleted: number;
        avgPlayersPerGame: number;
        completionRate: number;  // % of ticket holders who actually played
    };
}

const STATUS_COLORS = {
    pending: "#FFC931",
    paid: "#00CFF2",
    redeemed: "#14B985",
    failed: "#EF4444",
};

export function GameInsights({ data }: GameInsightsProps) {
    const conversionData = [
        { name: "Pending", value: data.ticketConversion.pending, color: STATUS_COLORS.pending },
        { name: "Paid", value: data.ticketConversion.paid, color: STATUS_COLORS.paid },
        { name: "Redeemed", value: data.ticketConversion.redeemed, color: STATUS_COLORS.redeemed },
        { name: "Failed", value: data.ticketConversion.failed, color: STATUS_COLORS.failed },
    ];

    const totalTickets = conversionData.reduce((sum, d) => sum + d.value, 0);
    const paidRate = totalTickets > 0 ? ((data.ticketConversion.paid + data.ticketConversion.redeemed) / totalTickets) * 100 : 0;

    return (
        <div className="min-w-0 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FFC931]/10">
                            <CurrencyDollarIcon className="h-5 w-5 text-[#FFC931]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Prize Pool</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FFC931] font-body ">
                        ${data.totalPrizePool.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/40 mt-1">total prizes</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#14B985]/10">
                            <TrophyIcon className="h-5 w-5 text-[#14B985]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Completed</span>
                    </div>
                    <div className="text-3xl font-bold text-[#14B985] font-body ">
                        {data.gamesCompleted}
                    </div>
                    <div className="text-xs text-white/40 mt-1">games finished</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#00CFF2]/10">
                            <UserGroupIcon className="h-5 w-5 text-[#00CFF2]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Avg Players</span>
                    </div>
                    <div className="text-3xl font-bold text-[#00CFF2] font-body ">
                        {data.avgPlayersPerGame.toFixed(1)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">per game</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FB72FF]/10">
                            <TicketIcon className="h-5 w-5 text-[#FB72FF]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Join Rate</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FB72FF] font-body ">
                        {data.completionRate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-white/40 mt-1">tickets → played</div>
                </div>
            </div>

            {/* Ticket Funnel */}
            <div className="min-w-0 rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Ticket Conversion Funnel</h3>
                        <p className="text-sm text-white/50">From ticket purchase to game entry</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-[#14B985] font-body">{paidRate.toFixed(1)}%</div>
                        <div className="text-xs text-white/40">success rate</div>
                    </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
                    {/* Bar Chart */}
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={conversionData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                                <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={12} width={80} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(10, 10, 11, 0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "12px",
                                    }}
                                    formatter={(value: number | undefined) => [`${value} tickets`, ""]}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {conversionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Funnel Steps */}
                    <div className="space-y-4">
                        {conversionData.map((item, index) => {
                            const percentage = totalTickets > 0 ? (item.value / totalTickets) * 100 : 0;
                            return (
                                <div key={item.name} className="flex items-center gap-4">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                                    >
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm text-white/70">{item.name}</span>
                                            <span className="text-sm font-bold" style={{ color: item.color }}>
                                                {item.value}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${percentage}%`, backgroundColor: item.color }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
