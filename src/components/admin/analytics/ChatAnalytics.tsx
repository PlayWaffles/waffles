"use client";

import { ChatBubbleLeftRightIcon, UsersIcon, ClockIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ChatAnalyticsProps {
    data: {
        totalMessages: number;
        uniqueChatters: number;
        totalPlayers: number;
        participationRate: number;  // percentage
        messagesByRound: Array<{ round: number; messages: number }>;
        topKeywords: Array<{ word: string; count: number }>;
    };
}

export function ChatAnalytics({ data }: ChatAnalyticsProps) {
    // Determine max count for bubble sizing
    const maxKeywordCount = Math.max(...data.topKeywords.map(k => k.count), 1);

    return (
        <div className="min-w-0 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FFC931]/10">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-[#FFC931]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Messages</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FFC931] font-body ">
                        {data.totalMessages.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/40 mt-1">total chat messages</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#00CFF2]/10">
                            <UsersIcon className="h-5 w-5 text-[#00CFF2]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Chatters</span>
                    </div>
                    <div className="text-3xl font-bold text-[#00CFF2] font-body ">
                        {data.uniqueChatters}
                    </div>
                    <div className="text-xs text-white/40 mt-1">unique participants</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#FB72FF]/10">
                            <UsersIcon className="h-5 w-5 text-[#FB72FF]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Participation</span>
                    </div>
                    <div className="text-3xl font-bold text-[#FB72FF] font-body ">
                        {data.participationRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-white/40 mt-1">of players chatted</div>
                </div>

                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-[#14B985]/10">
                            <ClockIcon className="h-5 w-5 text-[#14B985]" />
                        </div>
                        <span className="text-sm text-white/50 font-display uppercase tracking-wider">Avg/Player</span>
                    </div>
                    <div className="text-3xl font-bold text-[#14B985] font-body ">
                        {data.uniqueChatters > 0 ? (data.totalMessages / data.uniqueChatters).toFixed(1) : 0}
                    </div>
                    <div className="text-xs text-white/40 mt-1">messages per chatter</div>
                </div>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Messages by Round */}
                <div className="min-w-0 rounded-2xl border border-white/10 p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white font-display">Messages by Round</h3>
                        <p className="text-sm text-white/50">Chat activity during game rounds</p>
                    </div>
                    <div className="h-64 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.messagesByRound} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="round"
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                    tickFormatter={(v) => `R${v}`}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.3)"
                                    fontSize={12}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(10, 10, 11, 0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "12px",
                                    }}
                                    formatter={(value: number | undefined) => [`${value} messages`, "Round"]}
                                    labelFormatter={(label) => `Round ${label}`}
                                />
                                <Bar dataKey="messages" fill="#00CFF2" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Keywords (Bubble-like display) */}
                <div className="rounded-2xl border border-white/10 p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white font-display">Popular Topics</h3>
                        <p className="text-sm text-white/50">Most mentioned words in chat</p>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center items-center min-h-[200px]">
                        {data.topKeywords.slice(0, 20).map((keyword, index) => {
                            const sizeRatio = keyword.count / maxKeywordCount;
                            const size = Math.max(32 + sizeRatio * 80, 32);
                            const colors = ["#FFC931", "#00CFF2", "#FB72FF", "#14B985"];
                            const color = colors[index % colors.length];

                            return (
                                <div
                                    key={keyword.word}
                                    className="rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-default"
                                    style={{
                                        width: size,
                                        height: size,
                                        backgroundColor: `${color}20`,
                                        border: `2px solid ${color}40`,
                                    }}
                                    title={`${keyword.word}: ${keyword.count} mentions`}
                                >
                                    <span
                                        className="font-bold text-center leading-tight"
                                        style={{
                                            color,
                                            fontSize: Math.max(10, size * 0.25),
                                        }}
                                    >
                                        {keyword.word}
                                    </span>
                                </div>
                            );
                        })}
                        {data.topKeywords.length === 0 && (
                            <div className="text-center text-white/40 py-8">
                                <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No chat data yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
