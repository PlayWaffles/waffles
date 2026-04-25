"use client";

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
  return (
    <div className="waffles-v2 waffles-v2-stage">
      <ProtoProvider>
        <Stage />
      </ProtoProvider>
    </div>
  );
}
