"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

interface RevenueChartProps {
    data: Array<{
        date: string;
        revenue: number;
        tickets: number;
    }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
    return (
        <div className="min-w-0 bg-linear-to-br from-[#FFC931]/5 to-transparent rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">Revenue Over Time</h3>
                    <p className="text-sm text-white/50">Daily revenue and ticket sales trend</p>
                </div>
            </div>

            <div className="h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FFC931" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#FFC931" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00CFF2" stopOpacity={0.3} />
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
                            yAxisId="revenue"
                            stroke="rgba(255,255,255,0.3)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <YAxis
                            yAxisId="tickets"
                            orientation="right"
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
                                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            }}
                            labelStyle={{ color: "#fff", fontWeight: "bold" }}
                            itemStyle={{ color: "rgba(255,255,255,0.8)" }}
                            formatter={(value: number | undefined, name?: string) => [
                                name === "revenue" ? `$${(value ?? 0).toFixed(2)}` : (value ?? 0),
                                name === "revenue" ? "Revenue" : "Tickets"
                            ]}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: "20px" }}
                            formatter={(value) => (
                                <span className="text-white/70 text-sm">
                                    {value === "revenue" ? "Revenue ($)" : "Tickets Sold"}
                                </span>
                            )}
                        />
                        <Area
                            yAxisId="revenue"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#FFC931"
                            strokeWidth={2}
                            fill="url(#revenueGradient)"
                        />
                        <Area
                            yAxisId="tickets"
                            type="monotone"
                            dataKey="tickets"
                            stroke="#00CFF2"
                            strokeWidth={2}
                            fill="url(#ticketsGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
