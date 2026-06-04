"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BellAlertIcon,
  BoltIcon,
  ClockIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  TicketIcon,
  TrophyIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";

import type { GameWithQuestionCount, LastGameResult } from "@/lib/game";
import type { GameEntryData } from "@/components/providers/RealtimeProvider";
import { getTicketCloseTime } from "@/lib/game/ticket-window";

interface BulletinCarouselProps {
  game: GameWithQuestionCount | null;
  lastGameResult: LastGameResult | null;
  claimablePrize:
    | {
        gameId: string;
        gameNumber: number;
        amount: number;
      }
    | null;
  entry: GameEntryData | null;
  playerCount: number | null;
  prizePool: number | null;
  howToPlayHref: string;
  onOpenWinners: () => void;
}

interface BulletinCard {
  id: string;
  badge: string;
  title: string;
  body: string;
  icon: ReactNode;
  action?: string;
  href?: string;
  onClick?: () => void;
}

function formatPrize(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatGameNumber(value: number | null | undefined) {
  return String(value ?? 0).padStart(3, "0");
}

function formatTimeDistance(targetMs: number, nowMs: number) {
  const totalMinutes = Math.max(0, Math.ceil((targetMs - nowMs) / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function BulletinCardView({ card }: { card: BulletinCard }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-waffle-gold/15 bg-waffle-gold/10 text-waffle-gold">
          {card.icon}
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-1 font-display text-[10px] uppercase leading-none tracking-[0.18em] text-white/40">
          {card.badge}
        </span>
      </div>
      <div className="min-w-0 space-y-1.5">
        <h3 className="truncate font-body text-[17px] leading-none text-white">
          {card.title}
        </h3>
        <p className="line-clamp-2 min-h-[34px] font-display text-[12px] leading-[1.4] text-white/45">
          {card.body}
        </p>
      </div>
      {card.action && (
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-[12px] text-waffle-gold">
            {card.action}
          </span>
          <ChevronRightIcon className="h-4 w-4 text-white/25" />
        </div>
      )}
    </>
  );

  const className =
    "flex h-[148px] w-[260px] shrink-0 snap-start flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition-colors hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffle-gold";

  if (card.href) {
    return (
      <Link href={card.href} scroll={false} className={className}>
        {content}
      </Link>
    );
  }

  if (card.onClick) {
    return (
      <button type="button" onClick={card.onClick} className={className}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export function BulletinCarousel({
  game,
  lastGameResult,
  claimablePrize,
  entry,
  playerCount,
  prizePool,
  howToPlayHref,
  onOpenWinners,
}: BulletinCarouselProps) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNowMs(Date.now());
    const initialTimer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  const winner = lastGameResult?.winners[0];
  const effectivePlayerCount = playerCount ?? game?.playerCount ?? 0;
  const effectivePrizePool = prizePool ?? game?.prizePool ?? 0;
  const spotsLeft = Math.max(0, (game?.maxPlayers ?? 0) - effectivePlayerCount);
  const startsAtMs = game?.startsAt.getTime() ?? 0;
  const ticketsOpenAtMs = game?.ticketsOpenAt?.getTime() ?? startsAtMs;
  const ticketCloseAtMs = game ? getTicketCloseTime(game.endsAt).getTime() : 0;
  const hasTicket = Boolean(entry?.hasTicket);
  const currentGameClaimablePrize =
    entry?.prize != null && entry.prize > 0 && entry.claimedAt == null
      ? entry.prize
      : null;
  const hasPrizeBoost = Boolean(game && effectivePrizePool > game.pricing.currentPrice * effectivePlayerCount);
  const showTicketsOpeningSoon = Boolean(
    game &&
      nowMs != null &&
      ticketsOpenAtMs > nowMs,
  );
  const showTicketsLive = Boolean(
    game &&
      nowMs != null &&
      !hasTicket &&
      ticketsOpenAtMs <= nowMs &&
      nowMs < ticketCloseAtMs &&
      spotsLeft > 0,
  );
  const showGameStartsSoon = Boolean(
    game &&
      nowMs != null &&
      hasTicket &&
      startsAtMs > nowMs &&
      startsAtMs - nowMs <= 60 * 60 * 1000,
  );
  const showAlmostSoldOut = Boolean(
    game &&
      !hasTicket &&
      spotsLeft > 0 &&
      spotsLeft <= Math.max(3, Math.ceil((game.maxPlayers ?? 0) * 0.1)),
  );
  const cards: BulletinCard[] = [
    ...(claimablePrize
      ? [
          {
            id: "claim-prize",
            badge: "Prize",
            title: `$${formatPrize(claimablePrize.amount)} waiting`,
            body: `Your Waffles #${formatGameNumber(claimablePrize.gameNumber)} winnings are ready to claim.`,
            action: "Claim prize",
            icon: <WalletIcon className="h-4 w-4" />,
            href: `/game/${claimablePrize.gameId}/result`,
          },
        ]
      : currentGameClaimablePrize && game
        ? [
          {
            id: "claim-prize",
            badge: "Prize",
            title: `$${formatPrize(currentGameClaimablePrize)} waiting`,
            body: `Your Waffles #${formatGameNumber(game.gameNumber)} winnings are ready to claim.`,
            action: "Claim prize",
            icon: <WalletIcon className="h-4 w-4" />,
            href: `/game/${game.id}/result`,
          },
        ]
        : []),
    ...(showTicketsLive && game
      ? [
          {
            id: "tickets-live",
            badge: "Tickets",
            title: "Tickets are live",
            body: `Waffles #${formatGameNumber(game.gameNumber)} is open. ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`,
            action: "Get ticket",
            icon: <TicketIcon className="h-4 w-4" />,
            href: "/game",
          },
        ]
      : []),
    ...(showTicketsOpeningSoon && game && nowMs != null
      ? [
          {
            id: "tickets-opening",
            badge: "Soon",
            title: `Tickets in ${formatTimeDistance(ticketsOpenAtMs, nowMs)}`,
            body: `Waffles #${formatGameNumber(game.gameNumber)} opens soon. Be ready when spots drop.`,
            action: "Check game",
            icon: <ClockIcon className="h-4 w-4" />,
            href: "/game",
          },
        ]
      : []),
    ...(showGameStartsSoon && game && nowMs != null
      ? [
          {
            id: "game-starting",
            badge: "Ready",
            title: `Game in ${formatTimeDistance(startsAtMs, nowMs)}`,
            body: `You are in for Waffles #${formatGameNumber(game.gameNumber)}. Come back ready to play.`,
            action: "Open game",
            icon: <BoltIcon className="h-4 w-4" />,
            href: `/game/${game.id}/live`,
          },
        ]
      : []),
    ...(showAlmostSoldOut
      ? [
          {
            id: "almost-sold-out",
            badge: "Scarcity",
            title: `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`,
            body: "This game is almost full. Grab your ticket before it closes.",
            action: "Grab spot",
            icon: <TicketIcon className="h-4 w-4" />,
            href: "/game",
          },
        ]
      : []),
    ...(hasPrizeBoost && game
      ? [
          {
            id: "prize-boost",
            badge: "Pot",
            title: `$${formatPrize(effectivePrizePool)} pot`,
            body: `Waffles #${formatGameNumber(game.gameNumber)} has extra prize money in play.`,
            action: "View game",
            icon: <SparklesIcon className="h-4 w-4" />,
            href: "/game",
          },
        ]
      : []),
    ...(lastGameResult && winner
      ? [
          {
            id: "winners",
            badge: "Results",
            title: "Winners are in",
            body: `${winner.username ?? "Player"} + ${
              lastGameResult.totalWinners - 1
            } won $${formatPrize(lastGameResult.prizeAwarded)}.`,
            action: "View winners",
            icon: <TrophyIcon className="h-4 w-4" />,
            onClick: onOpenWinners,
          } satisfies BulletinCard,
        ]
      : []),
    {
      id: "minipay-updates",
      badge: "Updates",
      title: "You will see it here first",
      body: "New games, prize news, feature drops, and important announcements will land in the Bulletin.",
      icon: <BellAlertIcon className="h-4 w-4" />,
    },
    {
      id: "gamer-names",
      badge: "New",
      title: "Gamer names are live",
      body: "Every MiniPay player now has a Waffles name. You can edit yours from profile.",
      action: "Edit profile",
      icon: <PencilSquareIcon className="h-4 w-4" />,
      href: "/profile",
    },
    {
      id: "how-to-play",
      badge: "Guide",
      title: "How to win",
      body: "Buy a ticket, guess the scenes fast, and finish top 10 to split the pot.",
      action: "Read rules",
      icon: <QuestionMarkCircleIcon className="h-4 w-4" />,
      href: howToPlayHref,
    },
  ];

  return (
    <section className="w-full pt-5">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-white/45">
            <MegaphoneIcon className="h-4 w-4 text-waffle-gold/80" />
            <h2 className="font-body text-[15px] leading-none text-white/70">
              Bulletin
            </h2>
          </div>
          <span className="font-display text-[11px] text-white/25">
            Swipe for updates
          </span>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((card) => (
            <BulletinCardView key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
