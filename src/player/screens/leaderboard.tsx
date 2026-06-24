"use client";

import { useEffect, useState } from "react";
import { useProto } from "../state";
import { useResilientAction } from "../useResilientAction";
import { ASSETS, InfoButton, Phone, PixelImg, resolveAvatar, TabBar } from "../shared";
import { listPreviousGames, loadAllTimeLeaderboard, loadCurrentTournamentBoard, loadLevelsLeaderboard, loadTournamentBoard } from "@/player/api";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

// Two boards under one screen: TOURNAMENT (paid on-chain games) and LEVELS (free
// solo XP progression). Tournament has three sub-tabs — This game / Top earners
// (all-time, ranked by winnings) / Past games — and shows each player's USDT
// winnings. Levels ranks everyone by total XP.
type Mode = "tournament" | "levels";
type Tab = "current" | "alltime" | "past";

type Player = {
  rank: number;
  name: string;
  avatar: string;
  you?: boolean;
  // Tournament rows.
  score?: number;
  winnings?: number; // USDT (payment-token units); shown when > 0
  // Levels rows.
  level?: number;
  xp?: number;
};

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

const LeaderRow = ({ p }: { p: Player }) => {
  // Top-3 ranks get the brand maple gold, everyone else uses the muted-ink ramp.
  const rankColor = p.rank === 1 ? "var(--maple-500)" : p.rank === 2 ? "#bfc7d0" : p.rank === 3 ? "#cd7f32" : "var(--ink-faint)";
  const valueColor = p.you ? "var(--maple-500)" : "var(--ink)";
  const isLevels = p.level != null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 16px", color: "var(--ink)" }}>
      <div style={{ width: 22, fontFamily: "var(--font-display)", fontSize: 13, color: rankColor, textAlign: "center", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{p.rank}</div>
      <PixelImg src={p.avatar} size={40} alt="" style={{ borderRadius: 99, objectFit: "cover" }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
      {isLevels ? (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--maple-500)", background: "rgba(255,210,77,.14)", border: "1px solid rgba(255,210,77,.3)", borderRadius: 99, padding: "2px 8px" }}>Lv {p.level}</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: valueColor, fontVariantNumeric: "tabular-nums", minWidth: 52, textAlign: "right" }}>{(p.xp ?? 0).toLocaleString()} XP</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {p.winnings != null && p.winnings > 0 && (
            <span style={{ fontFamily: "var(--font-display)", fontSize: 12, color: "var(--leaf)", background: "rgba(20,185,133,.14)", border: "1px solid rgba(20,185,133,.3)", borderRadius: 99, padding: "2px 8px", fontVariantNumeric: "tabular-nums" }}>{fmtUsd(p.winnings)}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <PixelImg src={ASSETS.trophy} size={24} alt="" />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: valueColor, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>{(p.score ?? 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const LeaderboardScreen = () => {
  const proto = useProto();
  const [mode, setMode] = useState<Mode>("tournament");
  const [tab, setTab] = useState<Tab>("current");
  const [pickedGameId, setPickedGameId] = useState<string | null>(null);
  const isLevels = mode === "levels";

  const { data: currentBoard } = useResilientAction(() => loadCurrentTournamentBoard(), []);
  const { data: allTimeBoard } = useResilientAction(() => loadAllTimeLeaderboard(), []);
  const { data: levelsBoard } = useResilientAction(() => loadLevelsLeaderboard(), []);
  const { data: pastGames } = useResilientAction(() => listPreviousGames(), []);
  // The picker defaults to the most recent ended game (derived, not stored, so we
  // never setState in an effect just to pick a default).
  const selectedGameId = pickedGameId ?? pastGames?.[0]?.id ?? null;
  const { data: pastBoard } = useResilientAction(
    () => (selectedGameId ? loadTournamentBoard(selectedGameId) : Promise.resolve(null)),
    [selectedGameId],
  );

  const tBoard = tab === "current" ? currentBoard : tab === "alltime" ? allTimeBoard : pastBoard;

  const avatarFor = (s: { userId: string; you: boolean }) =>
    resolveAvatar(s.you ? proto.avatarId ?? null : null, s.userId);

  const leaders: Player[] = isLevels
    ? (levelsBoard?.standings ?? []).map((s) => ({ rank: s.rank, name: s.you ? proto.username || s.name : s.name, you: s.you, avatar: avatarFor(s), level: s.level, xp: s.xp }))
    : (tBoard?.standings ?? []).map((s) => ({ rank: s.rank, name: s.you ? proto.username || s.name : s.name, you: s.you, avatar: avatarFor(s), score: s.score, winnings: s.prize }));

  const you: Player | null = isLevels
    ? (levelsBoard?.you ? { rank: levelsBoard.you.rank, name: proto.username || levelsBoard.you.name, you: true, avatar: avatarFor(levelsBoard.you), level: levelsBoard.you.level, xp: levelsBoard.you.xp } : null)
    : (tBoard?.you ? { rank: tBoard.you.rank, name: proto.username || tBoard.you.name, you: true, avatar: avatarFor(tBoard.you), score: tBoard.you.score, winnings: tBoard.you.prize } : null);

  const fieldSize = (isLevels ? levelsBoard?.fieldSize : tBoard?.fieldSize) ?? leaders.length;
  const hasBoard = Boolean(isLevels ? levelsBoard : tBoard);

  useEffect(() => {
    trackClientEvent(AnalyticsEvent.LeaderboardViewed, {
      screen: "leaderboard",
      leaderboard_tab: isLevels ? "levels" : tab,
      field_size: fieldSize,
      rank: you?.rank ?? 0,
      score_after: (isLevels ? you?.xp : you?.score) ?? 0,
      has_live_board: hasBoard,
    });
  }, [isLevels, tab, fieldSize, you?.rank, you?.xp, you?.score, hasBoard]);

  const heading = isLevels
    ? "Top by XP"
    : tab === "current"
      ? "This game"
      : tab === "alltime"
        ? "Top earners"
        : pastGames?.find((g) => g.id === selectedGameId)?.title ?? "Past games";

  const metricLabel = isLevels ? "Level" : tab === "alltime" ? "Won" : "Score";
  const metricInfo = isLevels
    ? "Players ranked by total XP. You earn XP for every question you answer — in both levels and live tournaments — and your level is your XP milestone."
    : tab === "alltime"
      ? "Top earners — ranked by total winnings (USDT) across every tournament you've cashed in."
      : "Your score is the points you earned answering questions — faster correct answers score more. Winnings (USDT) show beside the score once a game settles.";
  const emptyCopy = isLevels
    ? "Play levels to earn XP and climb the ranks."
    : tab === "current"
      ? "This game's board fills up as players answer."
      : tab === "alltime"
        ? "Win a tournament to land on the top earners board."
        : "Pick a game above to see its final standings.";

  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, background: "radial-gradient(ellipse at center top, rgba(255, 210, 77, 0.22), transparent 65%)", pointerEvents: "none" }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 220,
          backgroundImage: "radial-gradient(circle, #FFD24D 2px, transparent 2.5px), radial-gradient(circle, #FB72FF 2px, transparent 2.5px), radial-gradient(circle, #FF9F1C 2px, transparent 2.5px)",
          backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.35, pointerEvents: "none",
        }}
      />

      <div style={{ position: "absolute", top: 96, left: 0, right: 0, textAlign: "center", color: "var(--ink)", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, filter: "drop-shadow(0 0 24px rgba(255, 210, 77, 0.35))" }}>
          <PixelImg src={ASSETS.trophy} size={58} alt="" />
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 0.5 }}>Leaderboard</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", marginTop: 2 }}>{heading}</div>
        {/* Mode toggle — Tournament (paid games) vs Levels (XP) — sits in the
            header above the board so the card holds only its own tabs + list. */}
        <div style={{ display: "flex", gap: 6, maxWidth: 320, margin: "16px auto 0", padding: "0 14px" }}>
          {([
            { id: "tournament" as const, label: "Tournament" },
            { id: "levels" as const, label: "Levels" },
          ]).map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (mode !== m.id) {
                    trackClientEvent(AnalyticsEvent.LeaderboardTabChanged, { screen: "leaderboard", previous_tab: isLevels ? "levels" : tab, leaderboard_tab: m.id });
                  }
                  setMode(m.id);
                }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 13, cursor: "pointer", background: active ? "var(--maple-500)" : "var(--surface-2)", color: active ? "var(--frame)" : "var(--ink-soft)", border: active ? "1.5px solid var(--frame)" : "1px solid rgba(253,251,246,.08)" }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: "absolute", top: 290, left: 14, right: 14, bottom: 80, background: "var(--surface-1)", borderRadius: 18, border: "1px solid rgba(253, 251, 246, 0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tournament sub-tabs. */}
        {!isLevels && (
          <div style={{ display: "flex", borderBottom: "1px solid rgba(253, 251, 246, 0.08)", padding: "0 12px" }}>
            {[
              { id: "current" as const, label: "This game" },
              { id: "alltime" as const, label: "Top earners" },
              { id: "past" as const, label: "Past games" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (tab !== t.id) {
                    trackClientEvent(AnalyticsEvent.LeaderboardTabChanged, { screen: "leaderboard", previous_tab: tab, leaderboard_tab: t.id });
                  }
                  setTab(t.id);
                }}
                style={{ flex: 1, background: "transparent", border: "none", padding: "14px 0 12px", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: tab === t.id ? 900 : 700, color: tab === t.id ? "var(--ink)" : "var(--ink-faint)", borderBottom: tab === t.id ? "2.5px solid var(--maple-500)" : "2.5px solid transparent", cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Past-games picker — horizontal scroll of ended games. */}
        {!isLevels && tab === "past" && pastGames && pastGames.length > 0 && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", overflowX: "auto", scrollbarWidth: "none", scrollPaddingInline: 16 }}>
            {pastGames.map((g) => {
              const active = g.id === selectedGameId;
              return (
                <button
                  key={g.id}
                  onClick={() => setPickedGameId(g.id)}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 99, fontFamily: "var(--font-display)", fontSize: 12, cursor: "pointer", background: active ? "var(--maple-500)" : "var(--surface-2)", color: active ? "var(--frame)" : "var(--ink-soft)", border: active ? "1.5px solid var(--frame)" : "1px solid rgba(253,251,246,.08)" }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        )}

        {leaders.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center" }}>
            <PixelImg src={ASSETS.trophy} size={64} alt="" style={{ opacity: 0.85, marginBottom: 16 }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", letterSpacing: 0.4 }}>No scores yet</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.45, maxWidth: 260 }}>
              {emptyCopy}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px 8px", color: "var(--ink-soft)" }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>Position</span>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                {metricLabel}
                <InfoButton title={metricLabel} text={metricInfo} size={18} />
              </span>
            </div>
            <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
              {leaders.map((p) => <LeaderRow key={`${p.rank}-${p.name}`} p={p} />)}
              {you && (
                <div data-coach="leaderboard-you" style={{ position: "sticky", bottom: 0, background: "#191507", borderTop: "1.5px solid var(--maple-500)", boxShadow: "0 -10px 18px rgba(0, 0, 0, 0.45)" }}>
                  <LeaderRow p={you} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bottom-bar">
        <TabBar active="leaderboard" />
      </div>
    </Phone>
  );
};
