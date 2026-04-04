"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ThemeAnalyticsProps {
    data: Array<{
        theme: string;
        games: number;
        revenue: number;
        players: number;
    }>;
}

const THEME_COLORS: Record<string, string> = {
    FOOTBALL: "#16A34A",
    MOVIES: "#EF4444",
    ANIME: "#EC4899",
    POLITICS: "#3B82F6",
    CRYPTO: "#F97316",
};

const THEME_ICONS: Record<string, string> = {
    FOOTBALL: "⚽",
    MOVIES: "🎬",
    ANIME: "🎌",
    POLITICS: "🏛️",
    CRYPTO: "₿",
};

export function ThemeAnalytics({ data }: ThemeAnalyticsProps) {
    const totalRevenue = data.reduce((acc, item) => acc + item.revenue, 0);
    const totalPlayers = data.reduce((acc, item) => acc + item.players, 0);

    return (
        <div className="min-w-0 bg-linear-to-br from-[#FB72FF]/5 to-transparent rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">Theme Performance</h3>
                    <p className="text-sm text-white/50">Revenue and engagement by game theme</p>
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Revenue by Theme Bar Chart */}
                <div className="min-w-0">
                    <h4 className="text-sm font-medium text-white/50 font-display uppercase tracking-wider mb-4">
                        Revenue by Theme
                    </h4>
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <XAxis
                                    type="number"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="theme"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                    width={80}
                                    tickFormatter={(value) => `${THEME_ICONS[value] || ""} ${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(10, 10, 11, 0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "12px",
                                    }}
                                    labelStyle={{ color: "#fff", fontWeight: "bold" }}
                                    formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Revenue"]}
                                />
                                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                                    {data.map((entry) => (
                                        <Cell
                                            key={entry.theme}
                                            fill={THEME_COLORS[entry.theme] || "#666"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Theme Cards */}
                <div className="grid grid-cols-2 gap-3">
                    {data.map((theme) => {
                        const revenueShare = totalRevenue > 0 ? (theme.revenue / totalRevenue) * 100 : 0;
                        const playerShare = totalPlayers > 0 ? (theme.players / totalPlayers) * 100 : 0;

                        return (
                            <div
                                key={theme.theme}
                                className="p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">{THEME_ICONS[theme.theme] || "🎮"}</span>
                                    <span className="text-sm font-medium text-white">{theme.theme}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/50">Games</span>
                                        <span className="text-white font-medium">{theme.games}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/50">Revenue</span>
                                        <span className="text-[#FFC931] font-bold">${theme.revenue.toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/50">Players</span>
                                        <span className="text-[#00CFF2] font-medium">{theme.players}</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/40">Share</span>
                                            <span
                                                className="font-bold"
                                                style={{ color: THEME_COLORS[theme.theme] || "#fff" }}
                                            >
                                                {revenueShare.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
