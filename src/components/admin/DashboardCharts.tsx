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

// Brand colors
const COLORS = {
    gold: "#FFC931",
    cyan: "#00CFF2",
    pink: "#FB72FF",
    success: "#14B985",
    gridLine: "rgba(255, 255, 255, 0.06)",
    axisText: "rgba(255, 255, 255, 0.5)",
};

// Custom tooltip style matching the admin theme
const tooltipStyle = {
    backgroundColor: "rgba(10, 10, 11, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    padding: "12px 16px",
};

const tooltipLabelStyle = {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: "12px",
    marginBottom: "4px",
};

export function DashboardCharts({
    userGrowth,
    revenueData,
}: {
    userGrowth: { date: string; count: number }[];
    revenueData: { date: string; amount: number }[];
}) {
    return (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            {/* User Growth Chart */}
            <div className="min-w-0 bg-linear-to-br from-[#00CFF2]/5 to-transparent border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6 font-body">User Growth</h3>
                <div className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={userGrowth}>
                            <defs>
                                <linearGradient id="colorUsersCyan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke={COLORS.gridLine}
                            />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: COLORS.axisText, fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: COLORS.axisText, fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                labelStyle={tooltipLabelStyle}
                                itemStyle={{ color: COLORS.cyan, fontWeight: 600 }}
                                cursor={{ stroke: COLORS.cyan, strokeOpacity: 0.2 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke={COLORS.cyan}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorUsersCyan)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="min-w-0 bg-linear-to-br from-[#FFC931]/5 to-transparent border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-6 font-body">Revenue (USDC)</h3>
                <div className="h-[300px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                            <defs>
                                <linearGradient id="colorRevenueGold" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={COLORS.gold} stopOpacity={1} />
                                    <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke={COLORS.gridLine}
                            />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: COLORS.axisText, fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: COLORS.axisText, fontSize: 12 }}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255, 201, 49, 0.05)' }}
                                contentStyle={tooltipStyle}
                                labelStyle={tooltipLabelStyle}
                                itemStyle={{ color: COLORS.gold, fontWeight: 600 }}
                                formatter={(value: number | undefined) => [`$${value ?? 0}`, 'Revenue']}
                            />
                            <Bar
                                dataKey="amount"
                                fill="url(#colorRevenueGold)"
                                radius={[6, 6, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
