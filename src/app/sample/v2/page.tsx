"use client";

import { useEffect } from "react";
import { ProtoProvider, useProto, type ScreenName } from "./state";
import { CompeteScreen } from "./screens/compete";
import { HomeScreen } from "./screens/home";
import { LeaderboardScreen } from "./screens/leaderboard";
import { LeaguesScreen } from "./screens/leagues";
import { LevelFailScreen, LevelWinScreen } from "./screens/level-result";
import { LevelIntroScreen } from "./screens/level-intro";
import { LevelPath } from "./screens/levels";
import { LobbyScreen } from "./screens/lobby";
import { MissionsScreen } from "./screens/missions";
import { ProfileScreen } from "./screens/profile";
import { QuestionScreen } from "./screens/question";
import { ResultsScreen } from "./screens/results";
import { ShopScreen } from "./screens/shop";

const SCREEN_COMPONENTS: Record<ScreenName, React.ComponentType> = {
  home: HomeScreen,
  levels: LevelPath,
  levelIntro: LevelIntroScreen,
  levelWin: LevelWinScreen,
  levelFail: LevelFailScreen,
  pass: CompeteScreen,
  shop: ShopScreen,
  leaderboard: LeaderboardScreen,
  leagues: LeaguesScreen,
  missions: MissionsScreen,
  lobby: LobbyScreen,
  question: QuestionScreen,
  results: ResultsScreen,
  profile: ProfileScreen,
};

const Stage = () => {
  const proto = useProto();
  const Current = SCREEN_COMPONENTS[proto.screen] ?? HomeScreen;
  return (
    <div className="waffles-v2-frame">
      <Current />
    </div>
  );
};

export default function V2Page() {
  useEffect(() => {
    // Easter egg for developers poking around in DevTools.
    if (typeof window !== "undefined" && !(window as unknown as { __wafflesGreeted?: boolean }).__wafflesGreeted) {
      (window as unknown as { __wafflesGreeted: boolean }).__wafflesGreeted = true;
      const big = "color:#FFC931;font-family:Archivo Black,sans-serif;font-size:22px;text-shadow:0 2px 0 #1e1e1e;padding:6px 0;";
      const small = "color:#888;font-size:11px;font-family:ui-monospace,monospace;";
      console.log("%c🧇 Waffles", big);
      console.log("%cReal-time multiplayer trivia. Built with care on Celo.", small);
      console.log("%cLike what you see? Drop us a line — playwaffles.xyz", small);
    }
  }, []);

  return (
    <div className="waffles-v2 waffles-v2-stage">
      <ProtoProvider>
        <Stage />
      </ProtoProvider>
    </div>
  );
}
