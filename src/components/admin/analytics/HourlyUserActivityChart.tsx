"use client";

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

export type HourlyUserActivityPoint = {
    hour: string;
    totalArrivals: number;
    returningUsers: number;
    activeUsers: number;
};

interface HourlyUserActivityChartProps {
    data: HourlyUserActivityPoint[];
}

export function HourlyUserActivityChart({ data }: HourlyUserActivityChartProps) {
    return (
        <div className="min-w-0 rounded-2xl border border-white/10 bg-linear-to-br from-[#1B8FF5]/5 to-transparent p-6">
            <div className="mb-6 flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-white font-display">Hourly User Flow</h3>
                <p className="text-sm text-white/50">
                    New and returning users by hour, with app activity overlaid
                </p>
            </div>

            <div className="h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} barGap={-34} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis
                            dataKey="hour"
                            stroke="rgba(255,255,255,0.35)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            interval={1}
                        />
                        <YAxis
                            stroke="rgba(255,255,255,0.35)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.04)" }}
                            contentStyle={{
                                backgroundColor: "rgba(10, 10, 11, 0.95)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "12px",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            }}
                            labelStyle={{ color: "#fff", fontWeight: "bold" }}
                            itemStyle={{ color: "rgba(255,255,255,0.82)" }}
                            formatter={(value: number | undefined, name?: string) => [
                                value ?? 0,
                                name === "totalArrivals"
                                    ? "Users came in"
                                    : name === "returningUsers"
                                        ? "Returning users"
                                        : "Using app",
                            ]}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: "18px" }}
                            formatter={(value) => (
                                <span className="text-sm text-white/70">
                                    {value === "totalArrivals"
                                        ? "Users came in"
                                        : value === "returningUsers"
                                            ? "Returning users"
                                            : "Using app"}
                                </span>
                            )}
                        />
                        <Bar
                            dataKey="totalArrivals"
                            fill="rgba(27,143,245,0.28)"
                            stroke="rgba(27,143,245,0.85)"
                            strokeWidth={1}
                            radius={[3, 3, 0, 0]}
                            barSize={34}
                        />
                        <Bar
                            dataKey="returningUsers"
                            fill="rgba(27,143,245,0.78)"
                            radius={[3, 3, 0, 0]}
                            barSize={34}
                        />
                        <Line
                            type="monotone"
                            dataKey="activeUsers"
                            stroke="#A100FF"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#A100FF", stroke: "#A100FF" }}
                            activeDot={{ r: 6 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
