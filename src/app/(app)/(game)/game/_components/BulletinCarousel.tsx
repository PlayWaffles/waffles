"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellAlertIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

import type { LastGameResult } from "@/lib/game";

interface BulletinCarouselProps {
  lastGameResult: LastGameResult | null;
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
    "flex h-[148px] w-[260px] shrink-0 snap-start flex-col rounded-xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition-colors hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffle-gold";

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
  lastGameResult,
  howToPlayHref,
  onOpenWinners,
}: BulletinCarouselProps) {
  const winner = lastGameResult?.winners[0];
  const cards: BulletinCard[] = [
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
