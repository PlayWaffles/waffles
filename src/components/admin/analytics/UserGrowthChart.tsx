"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import { useState } from "react";

interface UserGrowthChartProps {
    dailyData: Array<{
        date: string;
        signups: number;
        cumulative: number;
    }>;
    statusData: Array<{
        status: string;
        count: number;
        color: string;
    }>;
}

export function UserGrowthChart({ dailyData, statusData }: UserGrowthChartProps) {
    const [viewMode, setViewMode] = useState<"cumulative" | "daily">("cumulative");

    return (
        <div className="min-w-0 bg-linear-to-br from-[#00CFF2]/5 to-transparent rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">User Growth</h3>
                    <p className="text-sm text-white/50">Registration trends and user base growth</p>
                </div>
                <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                    <button
                        onClick={() => setViewMode("cumulative")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === "cumulative"
                            ? "bg-[#00CFF2] text-black font-bold"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        Cumulative
                    </button>
                    <button
                        onClick={() => setViewMode("daily")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === "daily"
                            ? "bg-[#00CFF2] text-black font-bold"
                            : "text-white/60 hover:text-white"
                            }`}
                    >
                        Daily
                    </button>
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Main Chart */}
                <div className="h-72 min-w-0 lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                        {viewMode === "cumulative" ? (
                            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00CFF2" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#00CFF2" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="date"
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
                                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cumulative"
                                    stroke="#00CFF2"
                                    strokeWidth={2}
                                    fill="url(#userGrowthGradient)"
                                    name="Total Users"
                                />
                            </AreaChart>
                        ) : (
                            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="date"
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
                                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                />
                                <Bar
                                    dataKey="signups"
                                    fill="#FB72FF"
                                    radius={[4, 4, 0, 0]}
                                    name="New Signups"
                                />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-white/50 font-display uppercase tracking-wider">
                        User Status
                    </h4>
                    {statusData.map((item) => {
                        const total = statusData.reduce((acc, s) => acc + s.count, 0);
                        const percentage = total > 0 ? (item.count / total) * 100 : 0;
                        return (
                            <div key={item.status} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-white/70">{item.status}</span>
                                    <span className="text-sm font-bold" style={{ color: item.color }}>
                                        {item.count}
                                    </span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${percentage}%`,
                                            backgroundColor: item.color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
