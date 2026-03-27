import { Metadata } from "next";

import { BottomNav } from "@/components/BottomNav";
import LeaderboardClient from "./client";

// ==========================================
// METADATA
// ==========================================
export const metadata: Metadata = {
  title: "Leaderboard | Waffles",
  description: "See who's winning! Top players ranked by score.",
};

// ==========================================
// PAGE COMPONENT
// ==========================================
export default function LeaderboardPage() {
  return (
    <>
      <LeaderboardClient />
      <BottomNav />
    </>
  );
}
