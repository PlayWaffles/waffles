import { cn } from "@/lib/utils";

type GlowVariant = "gold" | "cyan" | "pink" | "success";
type TrendDirection = "up" | "down" | "flat";

const glowClasses: Record<GlowVariant, string> = {
    gold: " text-[#FFC931]",
    cyan: " text-[#00CFF2]",
    pink: " text-[#FB72FF]",
    success: " text-[#14B985]",
};

const iconBgClasses: Record<GlowVariant, string> = {
    gold: "bg-[#FFC931]/15",
    cyan: "bg-[#00CFF2]/15",
    pink: "bg-[#FB72FF]/15",
    success: "bg-[#14B985]/15",
};

export function StatsCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    glowVariant = "gold",
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: { value: string; direction?: TrendDirection; isPositive?: boolean; label?: string };
    glowVariant?: GlowVariant;
}) {
    const trendDirection = trend?.direction ?? (trend?.isPositive ? "up" : "down");

    return (
        <div className={cn(
            "rounded-2xl border border-white/10 backdrop-blur-lg p-6 transition-all duration-300 font-display",
            glowVariant === "gold" && "bg-linear-to-br from-[#FFC931]/5 to-transparent hover:border-[#FFC931]/30",
            glowVariant === "cyan" && "bg-linear-to-br from-[#00CFF2]/5 to-transparent hover:border-[#00CFF2]/30",
            glowVariant === "pink" && "bg-linear-to-br from-[#FB72FF]/5 to-transparent hover:border-[#FB72FF]/30",
            glowVariant === "success" && "bg-linear-to-br from-[#14B985]/5 to-transparent hover:border-[#14B985]/30"
        )}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-white/60 font-body">{title}</p>
                    <p className={cn(
                        "mt-2 text-3xl font-bold font-body",
                        glowClasses[glowVariant]
                    )}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="mt-1 text-sm text-white/50">{subtitle}</p>
                    )}
                    {trend && (
                        <div className="mt-2 flex items-center gap-1">
                            <span
                                className={cn(
                                    "text-sm font-medium font-display",
                                    trendDirection === "up" && "text-[#14B985]",
                                    trendDirection === "down" && "text-red-400",
                                    trendDirection === "flat" && "text-white/50"
                                )}
                            >
                                {trendDirection === "up" && "↑ "}
                                {trendDirection === "down" && "↓ "}
                                {trendDirection === "flat" && "→ "}
                                {trend.value}
                            </span>
                            <span className="text-xs text-white/40">{trend.label ?? "vs last week"}</span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    "p-3 rounded-xl",
                    iconBgClasses[glowVariant]
                )}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
