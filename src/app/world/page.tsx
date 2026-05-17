import type { CSSProperties } from "react";
import {
  Binoculars,
  Check,
  GraduationCap,
  Home,
  List,
  Menu,
  Puzzle,
  Signal,
  Wifi,
} from "lucide-react";

import styles from "./world.module.css";

type TileState = "done" | "current" | "locked";

type PuzzleTile = {
  id: number;
  x: number;
  y: number;
  state: TileState;
};

type Decoration = {
  src: string;
  alt: string;
  x: number;
  y: number;
  size: number;
  className?: string;
};

const puzzleTiles: PuzzleTile[] = [
  { id: 18, x: 64, y: 1, state: "locked" },
  { id: 17, x: 47, y: 4, state: "locked" },
  { id: 16, x: 62, y: 8, state: "locked" },
  { id: 15, x: 50, y: 12, state: "locked" },
  { id: 14, x: 36, y: 17, state: "locked" },
  { id: 13, x: 23, y: 22, state: "locked" },
  { id: 12, x: 37, y: 27, state: "locked" },
  { id: 11, x: 51, y: 32, state: "locked" },
  { id: 10, x: 63, y: 37, state: "locked" },
  { id: 9, x: 77, y: 41, state: "locked" },
  { id: 8, x: 63, y: 45, state: "locked" },
  { id: 7, x: 49, y: 49, state: "current" },
  { id: 6, x: 36, y: 58, state: "done" },
  { id: 5, x: 24, y: 67, state: "done" },
];

const decorations: Decoration[] = [
  {
    src: "/images/v2/forest-tree-pine.webp",
    alt: "",
    x: 7,
    y: 2,
    size: 170,
    className: styles.treeCluster,
  },
  {
    src: "/images/v2/forest-tree-bush.webp",
    alt: "",
    x: 1,
    y: 27,
    size: 132,
  },
  {
    src: "/images/v2/forest-pond.webp",
    alt: "",
    x: 60,
    y: 36,
    size: 176,
    className: styles.pond,
  },
  {
    src: "/images/v2/forest-frog.webp",
    alt: "",
    x: 79,
    y: 39,
    size: 42,
    className: styles.frog,
  },
  {
    src: "/images/v2/forest-flowers.webp",
    alt: "",
    x: 72,
    y: 58,
    size: 64,
  },
  {
    src: "/images/v2/forest-tree-pine.webp",
    alt: "",
    x: 6,
    y: 70,
    size: 188,
    className: styles.bigTree,
  },
  {
    src: "/images/v2/forest-cabin.webp",
    alt: "",
    x: 61,
    y: 116,
    size: 176,
    className: styles.cabin,
  },
  {
    src: "/images/v2/forest-signpost.webp",
    alt: "",
    x: 40,
    y: 96,
    size: 56,
  },
  {
    src: "/images/v2/forest-mushroom.webp",
    alt: "",
    x: 77,
    y: 111,
    size: 40,
  },
];

const navItems = [
  { label: "Home", icon: Home },
  { label: "Puzzles", icon: Puzzle, active: true },
  { label: "Learn", icon: GraduationCap },
  { label: "Watch", icon: Binoculars },
  { label: "More", icon: Menu },
];

const tileStyle = ({ x, y }: PuzzleTile) =>
  ({
    "--x": `${x}%`,
    "--y": `${y}%`,
  }) as CSSProperties;

const decorationStyle = ({ x, y, size }: Decoration) =>
  ({
    "--x": `${x}%`,
    "--y": `${y}%`,
    "--size": `${size}px`,
  }) as CSSProperties;

function PuzzleTileButton({ tile }: { tile: PuzzleTile }) {
  const isDone = tile.state === "done";
  const isCurrent = tile.state === "current";

  return (
    <button
      className={`${styles.tile} ${styles[tile.state]}`}
      style={tileStyle(tile)}
      type="button"
      aria-label={
        isCurrent
          ? `Puzzle ${tile.id}, current`
          : isDone
            ? `Puzzle ${tile.id}, completed`
            : `Puzzle ${tile.id}, locked`
      }
    >
      <span className={styles.tileTop}>
        <span className={styles.tileRing} />
        <span className={styles.tileLabel}>
          {isDone ? <Check aria-hidden="true" size={36} strokeWidth={4} /> : tile.id}
        </span>
      </span>
      {isCurrent ? (
        <img
          className={styles.playerMarker}
          src="/images/v2/avatar-frog.webp"
          alt=""
          draggable={false}
        />
      ) : null}
    </button>
  );
}

function TopChrome() {
  return (
    <header className={styles.topChrome}>
      <div className={styles.statusBar} aria-hidden="true">
        <span>12:45</span>
        <div className={styles.dynamicIsland}>
          <img src="/images/v2/avatar-owl.webp" alt="" draggable={false} />
          <span />
        </div>
        <div className={styles.statusIcons}>
          <Signal size={21} strokeWidth={3} />
          <Wifi size={22} strokeWidth={3} />
          <span className={styles.battery}>100</span>
        </div>
      </div>

      <div className={styles.titleRow}>
        <span className={styles.ticketBadge}>
          <img src="/images/v2/ticket.webp" alt="" draggable={false} />
          7
        </span>
        <h1>Puzzles</h1>
      </div>
    </header>
  );
}

function CoachBubble() {
  return (
    <div className={styles.coach}>
      <img src="/images/v2/wally.webp" alt="" draggable={false} />
      <p>Feel the need for speed? How about a game of Puzzle Rush?</p>
    </div>
  );
}

function ScoreRail() {
  return (
    <div className={styles.scoreRail} aria-label="Puzzle progress">
      <div>
        <strong>707</strong>
        <span>
          <img src="/images/v2/flame.webp" alt="" draggable={false} />
          12
        </span>
      </div>
      <div className={styles.progressTrack}>
        <span />
      </div>
      <span className={styles.smallTicket}>
        <img src="/images/v2/ticket.webp" alt="" draggable={false} />8
      </span>
    </div>
  );
}

function BottomControls() {
  return (
    <footer className={styles.bottomControls}>
      <div className={styles.ctaRow}>
        <button type="button" className={styles.listButton} aria-label="Puzzle list">
          <List size={32} strokeWidth={3.4} />
        </button>
        <button type="button" className={styles.solveButton}>
          Solve Puzzles
        </button>
      </div>

      <nav className={styles.navTabs} aria-label="World navigation">
        {navItems.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            className={active ? styles.activeTab : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={28} strokeWidth={3} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </footer>
  );
}

export default function WorldPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.phone} aria-label="Puzzle world">
        <TopChrome />

        <div className={styles.mapWindow}>
          <div className={styles.mapSurface}>
            {decorations.map((decoration, index) => (
              <img
                key={`${decoration.src}-${index}`}
                className={`${styles.decoration} ${decoration.className ?? ""}`}
                style={decorationStyle(decoration)}
                src={decoration.src}
                alt={decoration.alt}
                draggable={false}
              />
            ))}

            <div className={styles.bench} aria-hidden="true">
              <span className={styles.benchBoard} />
              <span className={styles.benchBoard} />
              <span className={styles.benchBoard} />
              <span className={styles.benchLeg} />
            </div>

            <div className={styles.flowers} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>

            {puzzleTiles.map((tile) => (
              <PuzzleTileButton key={tile.id} tile={tile} />
            ))}

            <CoachBubble />
          </div>
          <ScoreRail />
        </div>

        <BottomControls />
      </section>
    </main>
  );
}
