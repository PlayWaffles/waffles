"use client";

import type { CSSProperties, ReactNode } from "react";
import { useProto } from "./state";

const ASSETS_BASE = "/images/v2";

export const ASSETS = {
  wally: `${ASSETS_BASE}/wally.png`,
  ticket: `${ASSETS_BASE}/ticket.png`,
  flame: `${ASSETS_BASE}/flame.png`,
  trophy: `${ASSETS_BASE}/trophy.png`,
  heartFull: `${ASSETS_BASE}/heart-full.png`,
  heartEmpty: `${ASSETS_BASE}/heart-empty.png`,
  heartBroken: `${ASSETS_BASE}/heart-broken.png`,
  checkmark: `${ASSETS_BASE}/checkmark.png`,
  lock: `${ASSETS_BASE}/lock.png`,
  vipStar: `${ASSETS_BASE}/vip-star.png`,
  xpGem: `${ASSETS_BASE}/xp-gem.png`,
  powerup5050: `${ASSETS_BASE}/powerup-5050.png`,
  powerupTime: `${ASSETS_BASE}/powerup-time.png`,
  powerupSkip: `${ASSETS_BASE}/powerup-skip.png`,
  powerupShield: `${ASSETS_BASE}/powerup-shield.png`,
  chestRainbow: `${ASSETS_BASE}/chest-rainbow.png`,
  chestPurple: `${ASSETS_BASE}/chest-purple.png`,
  chestBrown: `${ASSETS_BASE}/chest-brown.png`,
  medalApprentice: `${ASSETS_BASE}/medal-apprentice.png`,
  medalSilver: `${ASSETS_BASE}/medal-silver.png`,
  medalAdvanced: `${ASSETS_BASE}/medal-advanced.png`,
  medalGenius: `${ASSETS_BASE}/medal-genius.png`,
  medalMaster: `${ASSETS_BASE}/medal-master.png`,
  avatarFox: `${ASSETS_BASE}/avatar-fox.png`,
  avatarBear: `${ASSETS_BASE}/avatar-bear.png`,
  avatarFrog: `${ASSETS_BASE}/avatar-frog.png`,
  avatarPanda: `${ASSETS_BASE}/avatar-panda.png`,
  avatarOwl: `${ASSETS_BASE}/avatar-owl.png`,
  avatarCat: `${ASSETS_BASE}/avatar-cat.png`,
  avatarDog: `${ASSETS_BASE}/avatar-dog.png`,
  avatarRabbit: `${ASSETS_BASE}/avatar-rabbit.png`,
  bossNightOwl: `${ASSETS_BASE}/boss-night-owl.png`,
  iconTarget: `${ASSETS_BASE}/icon-target.png`,
  iconCalendar: `${ASSETS_BASE}/icon-calendar.png`,
  coin: "/images/illustrations/golden-coin.png",
} as const;

// Pixel-art image helper. `imageRendering: pixelated` keeps the chunky aesthetic when scaled.
export const PixelImg = ({
  src,
  size,
  alt = "",
  style,
  className,
}: {
  src: string;
  size: number;
  alt?: string;
  style?: CSSProperties;
  className?: string;
}) => (
  <img
    src={src}
    alt={alt}
    className={className}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      imageRendering: "pixelated",
      display: "inline-block",
      flexShrink: 0,
      ...style,
    }}
  />
);

export const StatusBar = ({ time = "9:41", dark = false }: { time?: string; dark?: boolean }) => (
  <div className={"status-bar" + (dark ? " dark" : "")}>
    <span>{time}</span>
    <div className="right">
      <div className="dot-row">
        <span /><span /><span /><span />
      </div>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path
          d="M8 10.5C9.5 9 11 8.5 14 11C14.5 10 15.5 9 16 8.5C12 4 4 4 0 8.5C0.5 9 1.5 10 2 11C5 8.5 6.5 9 8 10.5Z"
          fill="currentColor"
        />
      </svg>
      <div className="battery"><i /></div>
    </div>
  </div>
);

export const Phone = ({
  children,
  statusDark = false,
  time,
}: {
  children: ReactNode;
  statusDark?: boolean;
  time?: string;
}) => (
  <div className="phone">
    <StatusBar dark={statusDark} time={time} />
    <div className="body">{children}</div>
  </div>
);

// `color` arg kept for API compatibility but no longer used — pixel art has fixed palette.
export const TicketIcon = ({ size = 18 }: { size?: number; color?: string }) => (
  <PixelImg src={ASSETS.ticket} size={size} alt="ticket" />
);

export const FlameIcon = ({ size = 16 }: { size?: number }) => (
  <PixelImg src={ASSETS.flame} size={size} alt="streak" />
);

export const TopHeader = ({ tickets = 7, title = "Levels" }: { tickets?: number; title?: string }) => (
  <div className="top-header">
    <div className="ticket-pill">
      <TicketIcon />
      <span>{tickets}</span>
    </div>
    <div className="title">{title}</div>
  </div>
);

export const TabBar = ({ active = "home" }: { active?: string }) => {
  const proto = useProto();
  const onTab = (id: string) => {
    const map: Record<string, string> = {
      home: "home",
      levels: "levels",
      compete: "pass",
      shop: "shop",
      me: "profile",
    };
    proto.goto((map[id] || id) as Parameters<typeof proto.goto>[0]);
  };
  const tabs: { id: string; label: string; icon: ReactNode }[] = [
    {
      id: "home",
      label: "Home",
      icon: (
        <path
          d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
      ),
    },
    {
      id: "levels",
      label: "Levels",
      icon: (
        <>
          <rect x="3" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="9" y="8" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="15" y="3" width="6" height="17" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
        </>
      ),
    },
    {
      id: "compete",
      label: "Compete",
      icon: (
        <>
          <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path
            d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ),
    },
    {
      id: "shop",
      label: "Shop",
      icon: (
        <path
          d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 8zM8 8V6a4 4 0 0 1 8 0v2"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
      ),
    },
    {
      id: "me",
      label: "Me",
      icon: (
        <>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M4 21c1-4 4-6 8-6s7 2 8 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ),
    },
  ];
  return (
    <div className="tab-bar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={"tab" + (t.id === active ? " active" : "")}
          onClick={() => onTab(t.id)}
          style={{ cursor: "pointer" }}
        >
          <svg viewBox="0 0 24 24">{t.icon}</svg>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
};

export const CategoryIcon = ({ name, size = 28 }: { name: string; size?: number }) => {
  const map: Record<string, ReactNode> = {
    Movies: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" />
        <circle cx="8" cy="9" r="1.2" fill="white" />
        <circle cx="16" cy="9" r="1.2" fill="white" />
        <circle cx="8" cy="15" r="1.2" fill="white" />
        <circle cx="16" cy="15" r="1.2" fill="white" />
      </>
    ),
    Sports: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" stroke="white" strokeWidth="1.5" fill="none" />
      </>
    ),
    Crypto: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <text x="12" y="16" fontSize="11" fontWeight="900" fill="white" textAnchor="middle">
          ₿
        </text>
      </>
    ),
    History: (
      <>
        <rect x="4" y="6" width="16" height="14" rx="1.5" fill="currentColor" />
        <path d="M4 9h16M9 6V4h6v2" stroke="white" strokeWidth="1.5" fill="none" />
      </>
    ),
    Geography: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="white" strokeWidth="1.2" fill="none" />
      </>
    ),
    Science: (
      <>
        <path d="M9 3h6v5l4 10a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 18L9 8V3z" fill="currentColor" />
        <circle cx="11" cy="14" r="1" fill="white" />
        <circle cx="14" cy="16" r=".8" fill="white" />
      </>
    ),
    Music: (
      <>
        <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="7" cy="18" r="2.5" fill="currentColor" />
        <circle cx="17" cy="16" r="2.5" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {map[name]}
    </svg>
  );
};

export const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Movies: { bg: "#1e1e1e", fg: "#FB72FF" },
  Sports: { bg: "#1e1e1e", fg: "#00CFF2" },
  Crypto: { bg: "#1e1e1e", fg: "#FFC931" },
  History: { bg: "#1e1e1e", fg: "#F5BB1B" },
  Geography: { bg: "#1e1e1e", fg: "#00CFF2" },
  Science: { bg: "#1e1e1e", fg: "#FB72FF" },
  Music: { bg: "#1e1e1e", fg: "#FFC931" },
};

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontFamily: "Archivo Black",
      fontSize: 11,
      color: "rgba(255,255,255,.5)",
      letterSpacing: 1.2,
      marginBottom: 8,
      marginTop: 2,
    }}
  >
    {children}
  </div>
);
