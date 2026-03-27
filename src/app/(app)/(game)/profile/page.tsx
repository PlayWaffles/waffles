"use client";

import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { useProfileStats } from "@/hooks/useProfileStats";
import { useProfileGames } from "@/hooks/useProfileGames";
import { InviteFriendsIcon, UploadIcon } from "@/components/icons";
import { BottomNav } from "@/components/BottomNav";
import { ProfileCard } from "./_components/ProfileCard";
import { Stats } from "./stats/_components/Stats";
import { WaffleLoader } from "@/components/ui/WaffleLoader";
import { notify } from "@/components/ui/Toaster";
import InviteFriendsButton from "./_components/InviteFriendsButton";
import { InviteDrawer } from "./_components/InviteFriendsDrawer";
import GameHistory from "./games/_components/GameHistory";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { formatAddress } from "@/lib/address";

// ==========================================
// COMPONENT
// ==========================================

export default function ProfilePage() {
  // SWR-based hooks - each fetches independently
  const { user, isLoading: userLoading } = useUser();
  const { stats, isLoading: statsLoading } = useProfileStats();
  const { games, isLoading: gamesLoading } = useProfileGames(2); // Only 2 for preview

  const [inviteOpen, setInviteOpen] = useState(false);

  const isLoading = userLoading || statsLoading || gamesLoading;

  // Loading state
  if (isLoading) {
    return (
      <AnimatePresence>
        <motion.div
          key="profile-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex-1 flex items-center justify-center"
        >
          <WaffleLoader text="LOADING PROFILE..." />
        </motion.div>
        <BottomNav key="bottom-nav" />
      </AnimatePresence>
    );
  }

  // Error state
  if (!user) {
    return (
      <div className="p-4 text-center text-muted">
        User not identified. Cannot load profile.
      </div>
    );
  }

  const safeUsername = user.username || formatAddress(user.wallet);
  const safeAvatarUrl = user.pfpUrl || "/images/avatars/a.png";
  const showReferralButton = user.inviteQuota !== null && user.inviteQuota > 0;

  // Transform games for GameHistory component
  const recentGames = games.map((g) => ({
    id: g.gameId,
    gameNumber: g.game.gameNumber,
    onchainId: g.game.onchainId,
    name: g.game.title,
    score: g.score,
    claimedAt: g.claimedAt ? new Date(g.claimedAt) : null,
    prizeAmount: g.prize,
  }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      } as const,
    },
  } as const;

  return (
    <>
      {/* Main container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col overflow-auto px-3 gap-3 pb-4"
      >
        {/* Header */}
        <motion.header
          variants={itemVariants}
          className="flex flex-row items-center py-3 gap-2 w-full shrink-0"
        >
          <div
            className="flex flex-row justify-center items-center p-1 gap-2 w-7 h-7 bg-[#1B8FF5] rounded-[900px] opacity-0"
            aria-hidden="true"
          >
            <UploadIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="flex-1 font-body font-normal text-[22px] leading-[92%] text-center tracking-[-0.03em] text-white select-none">
            PROFILE
          </h1>
          <motion.button
            whileHover={{
              scale: 1.1,
              backgroundColor: "rgba(255, 255, 255, 0.2)",
            }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setInviteOpen(true)}
            aria-label="Invite Friends"
            className={cn(
              "box-border flex flex-row justify-center items-center p-2 gap-2 w-[34px] h-[34px] bg-white/13 rounded-[900px] transition-all duration-200",
              !showReferralButton && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showReferralButton}
          >
            <InviteFriendsIcon className="w-[18px] h-[18px]" />
          </motion.button>
        </motion.header>

        {/* Profile Card */}
        <motion.div variants={itemVariants} className="shrink-0">
          <ProfileCard
            username={safeUsername}
            streak={stats?.currentStreak ?? 0}
            avatarUrl={safeAvatarUrl}
            onUpload={() => {
              notify.info("Avatar upload coming soon!");
            }}
          />
        </motion.div>

        {/* Invite Button */}
        <motion.div variants={itemVariants} className="shrink-0">
          <InviteFriendsButton onInvite={() => setInviteOpen(true)} />
        </motion.div>

        {/* Stats Section */}
        <motion.div variants={itemVariants} className="shrink-0">
          <Stats
            stats={{
              totalGames: stats?.totalGames ?? 0,
              wins: stats?.wins ?? 0,
              winRate: stats?.winRate ?? 0,
              totalWon: stats?.totalWon ?? 0,
              highestScore: stats?.highestScore ?? 0,
              avgScore: stats?.avgScore ?? 0,
              currentStreak: stats?.currentStreak ?? 0,
              bestRank: stats?.bestRank ?? null,
            }}
            fid={user.fid ?? 0}
          />
        </motion.div>

        {/* Game History */}
        <motion.div variants={itemVariants} className="shrink-0 pb-2">
          <GameHistory gameHistory={recentGames} />
        </motion.div>
      </motion.div>

      <BottomNav />

      <InviteDrawer isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  );
}
