"use client";

import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";
import { ReactNode } from "react";
import { MetricTooltip } from "./MetricTooltip";

interface KPICardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    tooltip?: string;
    change?: {
        value: number;
        isPositive: boolean;
    };
    sparklineData?: number[];
    subtitle?: string;
    glowVariant?: "gold" | "cyan" | "pink" | "success";
}

export function KPICard({
    title,
    value,
    icon,
    tooltip,
    change,
    sparklineData,
    subtitle,
    glowVariant = "gold",
}: KPICardProps) {
    const gradientClasses = {
        gold: "bg-linear-to-br from-[#FFC931]/5 to-transparent",
        cyan: "bg-linear-to-br from-[#00CFF2]/5 to-transparent",
        pink: "bg-linear-to-br from-[#FB72FF]/5 to-transparent",
        success: "bg-linear-to-br from-[#14B985]/5 to-transparent",
    };

    const accentColors = {
        gold: "#FFC931",
        cyan: "#00CFF2",
        pink: "#FB72FF",
        success: "#14B985",
    };

    return (
        <div className="relative overflow-visible">
            <div className={`${gradientClasses[glowVariant]} rounded-2xl border border-white/10 p-5 relative group hover:border-white/20 transition-colors`}>
                {/* Clipped visual layer */}
                <div
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
                    aria-hidden="true"
                >
                    <div
                        className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20"
                        style={{ backgroundColor: accentColors[glowVariant] }}
                    />
                </div>

                <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/50 font-display uppercase tracking-wider">
                            {title}
                        </span>
                        {tooltip ? <MetricTooltip content={tooltip} /> : null}
                    </div>
                    <div className="p-2 rounded-xl bg-white/5">
                        {icon}
                    </div>
                </div>

                {/* Value */}
                <div className="text-3xl font-bold font-body mb-1"
                    style={{ color: accentColors[glowVariant] }}>
                    {value}
                </div>

                {/* Sparkline */}
                {sparklineData && sparklineData.length > 0 && (
                    <div className="h-8 my-2">
                        <Sparkline data={sparklineData} color={accentColors[glowVariant]} />
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                    {change && (
                        <div className={`flex items-center gap-1 text-sm font-medium ${change.isPositive ? "text-[#14B985]" : "text-red-400"
                            }`}>
                            {change.isPositive ? (
                                <ArrowUpIcon className="h-3 w-3" />
                            ) : (
                                <ArrowDownIcon className="h-3 w-3" />
                            )}
                            <span>{Math.abs(change.value).toFixed(1)}%</span>
                            <span className="text-white/40 ml-1">vs prev</span>
                        </div>
                    )}
                    {subtitle && (
                        <span className="text-xs text-white/40">{subtitle}</span>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 100;
    const height = 32;
    const padding = 2;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((value - min) / range) * (height - padding * 2) - padding;
        return `${x},${y}`;
    }).join(" ");

    const areaPath = `M${padding},${height} L${points} L${width - padding},${height} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
            <defs>
                <linearGradient id={`sparkline-gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={areaPath}
                fill={`url(#sparkline-gradient-${color.replace("#", "")})`}
            />
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
