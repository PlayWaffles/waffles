"use client";

import { TrophyIcon, ClockIcon, CheckCircleIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PlayerEngagementProps {
    data: {
        avgScore: number;
        avgAccuracy: number;  // percentage
        avgAnswerTime: number;  // ms
        scoreDistribution: Array<{ range: string; count: number }>;
        totalPlayers: number;
        repeatPlayers: number;  // players who played multiple games
    };
}

export function PlayerEngagement({ data }: PlayerEngagementProps) {
    const repeatRate = data.totalPlayers > 0 ? (data.repeatPlayers / data.totalPlayers) * 100 : 0;

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    return (
        <div className="min-w-0 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FFC931]/10">
                            <TrophyIcon className="h-5 w-5 text-[#FFC931]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Avg Score</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FFC931] font-body ">
                        {data.avgScore.toFixed(0)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">points per player</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#14B985]/10">
                            <CheckCircleIcon className="h-5 w-5 text-[#14B985]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Accuracy</span>
                    </div>
                    <div className="text-3xl font-bold text-[#14B985] font-body ">
                        {data.avgAccuracy.toFixed(1)}%
                    </div>
                    <div className="text-xs text-white/40 mt-1">correct answers</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#00CFF2]/10">
                            <ClockIcon className="h-5 w-5 text-[#00CFF2]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Avg Response</span>
                    </div>
                    <div className="text-3xl font-bold text-[#00CFF2] font-body ">
                        {formatTime(data.avgAnswerTime)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">per question</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FB72FF]/10">
                            <ChartBarIcon className="h-5 w-5 text-[#FB72FF]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Repeat Rate</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FB72FF] font-body ">
                        {repeatRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-white/40 mt-1">{data.repeatPlayers} repeat players</div>
                </div>
            </div>

            {/* Score Distribution */}
            <div className="min-w-0 rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Score Distribution</h3>
                        <p className="text-sm text-white/50">How players performed across all games</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-body">{data.totalPlayers}</div>
                        <div className="text-xs text-white/40">total players</div>
                    </div>
                </div>

                <div className="h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.scoreDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                                dataKey="range"
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="rgba(255,255,255,0.3)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "rgba(10, 10, 11, 0.95)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "12px",
                                }}
                                formatter={(value: number | undefined) => [`${value} players`, "Count"]}
                            />
                            <Bar
                                dataKey="count"
                                fill="#FFC931"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
