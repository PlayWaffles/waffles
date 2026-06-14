"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { LIVES_MAX, LIVES_REFILL_COST, useProto, type LevelTrack } from "../state";
import { ASSETS, Phone, PixelImg, TabBar, TicketIcon, TopHeader, useNow } from "../shared";

// The two parallel solo campaigns the levels-page tab switches between. Each has
// its own progression (state.levelByTrack); the active accent skins the tab.
const TRACKS: { id: LevelTrack; label: string; accent: string }[] = [
  { id: "standard", label: "FOREST", accent: "var(--maple-500)" },
  { id: "world-cup", label: "WORLD CUP", accent: "#2bbf5b" },
];

// Segmented toggle: one pill "track" with a sliding thumb that animates between
// the two segments and tints to the active track's accent. Reads as a single
// switch rather than two separate buttons. The thumb width matches a segment
// exactly, so translateX(100%) lands it perfectly on the second segment.
const TrackTabs = ({ active, onSelect }: { active: LevelTrack; onSelect: (t: LevelTrack) => void }) => {
  const activeIdx = Math.max(0, TRACKS.findIndex((t) => t.id === active));
  const accent = TRACKS[activeIdx].accent;
  return (
    <div style={{ position: "absolute", top: 12, left: 14, right: 14, zIndex: 14 }}>
      <div
        role="tablist"
        aria-label="Level track"
        style={{
          position: "relative",
          display: "flex",
          padding: 5,
          borderRadius: 999,
          background: "linear-gradient(180deg, #14201a 0%, #0b130e 100%)",
          border: "1px solid rgba(255,255,255,.10)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,.5), 0 4px 14px rgba(0,0,0,.4)",
        }}
      >
        {/* Sliding thumb — sits behind the labels. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 5,
            bottom: 5,
            left: 5,
            width: "calc(50% - 5px)",
            borderRadius: 999,
            background: accent,
            boxShadow: `0 2px 10px ${accent}59, inset 0 1px 0 rgba(255,255,255,.3)`,
            transform: activeIdx === 1 ? "translateX(100%)" : "translateX(0)",
            transition: "transform .3s cubic-bezier(.22,1,.36,1), background .3s ease, box-shadow .3s ease",
          }}
        />
        {TRACKS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => !on && onSelect(t.id)}
              style={{
                position: "relative",
                zIndex: 1,
                flex: 1,
                height: 38,
                border: "none",
                background: "transparent",
                color: on ? "var(--frame)" : "rgba(255,255,255,.6)",
                fontFamily: "var(--font-display)",
                fontSize: 14,
                letterSpacing: 0.5,
                cursor: on ? "default" : "pointer",
                transition: "color .25s ease",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

type NodeState = "done" | "current" | "locked";
type LevelNode = { n: number; state: NodeState; isBoss: boolean };
const shouldShowBossMarker = (node: LevelNode, currentLevel: number) => {
  if (!node.isBoss || node.state !== "locked") return false;
  const nextBossLevel = Math.ceil(currentLevel / 5) * 5;
  return node.n === nextBossLevel;
};

// Isometric grid cell: one visible diamond is exactly GRID_W x GRID_H.
const GRID_W = 144;
const GRID_H = 72;
const GRID_CANVAS_W = GRID_W * 7;
const GRID_ORIGIN_X = GRID_CANVAS_W / 2;
const SLAB_TOP_FACE_RENDER_W = 104;
const ROW_STRIDE = GRID_H / 2;
const CLOUD_BOUNDARY_CLEARANCE = GRID_H * 4;

// Infinite-scroll tuning.
const INITIAL_LOOKAHEAD = 14;  // locked slabs shown above the current level
const HISTORY_DEPTH = 6;       // done levels rendered below current
const INITIAL_CLOUD_LOOKAHEAD = 16; // fog-band rows above the revealed lookahead
const REVEALED_LOCKED_LEVELS = INITIAL_LOOKAHEAD;

// The slab source art is 320x214, but its top diamond is only about 252x126.
// Rendering the whole asset at this scale makes the top face exactly match
// one visible grid diamond.
const TILE_SOURCE_W = 320;
const TILE_SOURCE_H = 214;
const SLAB_METRICS: Record<NodeState, {
  topFaceSourceW: number;
  anchorSourceX: number;
  anchorSourceY: number;
}> = {
  done: { topFaceSourceW: 252, anchorSourceX: 159.5, anchorSourceY: 109 },
  current: { topFaceSourceW: 249, anchorSourceX: 160, anchorSourceY: 107.5 },
  locked: { topFaceSourceW: 236, anchorSourceX: 159.5, anchorSourceY: 105 },
};
const MAX_TILE_BOTTOM_OFFSET = Math.max(
  ...Object.values(SLAB_METRICS).map((metrics) => {
    const scale = SLAB_TOP_FACE_RENDER_W / metrics.topFaceSourceW;
    return (TILE_SOURCE_H - metrics.anchorSourceY) * scale;
  }),
);

type ScreenPoint = { x: number; y: number };

const latticeToScreen = (halfCol: number, row: number): ScreenPoint => ({
  x: GRID_ORIGIN_X + halfCol * (GRID_W / 2),
  y: PATH_TOP_PAD + row * (GRID_H / 2),
});

// Adjacent grid cells only. Each next slab moves one real isometric cell along
// the zigzag, so there are no empty diamonds between path slabs.
const PATH_HALF_COLUMNS = [-2, -1, 0, 1, 0, -1];
const positiveMod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const pointForLevel = (level: number, currentLevel: number, rowOffset: number) => {
  const relativeRow = REVEALED_LOCKED_LEVELS + currentLevel - level;
  return latticeToScreen(
    PATH_HALF_COLUMNS[positiveMod(relativeRow, PATH_HALF_COLUMNS.length)],
    relativeRow + rowOffset,
  );
};

type ScenerySprite = {
  id: string;
  src: string;
  halfCol: number;
  row: number;
  size: number;
  z?: number;
  flip?: boolean;
  motion?: "firefly";
  motionDelayMs?: number;
};

const FOREST_SCENERY: ScenerySprite[] = [
  { id: "upper-left-pine", src: ASSETS.forestTreePine, halfCol: -2.153, row: 2.139, size: 124, z: 2 },
  { id: "upper-left-bush", src: ASSETS.forestTreeBush, halfCol: -2.556, row: 7.889, size: 78, z: 2 },
  { id: "upper-left-flowers", src: ASSETS.forestFlowers, halfCol: 1.028, row: 0.333, size: 42, z: 3 },
  { id: "upper-right-stone", src: ASSETS.terrainStone, halfCol: 1.972, row: 0.833, size: 118, z: 2 },
  { id: "upper-right-bush", src: ASSETS.forestTreeBush, halfCol: 1.292, row: 6.528, size: 76, z: 2 },
  { id: "upper-right-flowers", src: ASSETS.forestFlowers, halfCol: -0.292, row: 5.889, size: 42, z: 3 },
  { id: "mid-left-pine", src: ASSETS.forestTreePine, halfCol: 0.458, row: 4.944, size: 128, z: 2 },
  { id: "mid-left-bush", src: ASSETS.forestTreeBush, halfCol: -2.083, row: 8.361, size: 86, z: 2 },
  { id: "mid-left-mushroom", src: ASSETS.forestMushroom, halfCol: 0.264, row: 11.472, size: 38, z: 3 },
  { id: "mid-right-pond", src: ASSETS.forestPond, halfCol: 1.625, row: 11.444, size: 132, z: 2 },
  { id: "mid-right-frog", src: ASSETS.forestFrog, halfCol: 2.083, row: 11.333, size: 38, z: 3 },
  { id: "mid-right-firefly", src: ASSETS.forestFirefly, halfCol: 1.125, row: 10.417, size: 52, z: 4, flip: true, motion: "firefly", motionDelayMs: -900 },
  { id: "mid-right-flowers", src: ASSETS.forestFlowers, halfCol: 1.083, row: 13.278, size: 44, z: 3 },
  { id: "lower-left-signpost", src: ASSETS.forestSignpost, halfCol: -2, row: 14.389, size: 86, z: 2 },
  { id: "lower-left-stump", src: ASSETS.forestStump, halfCol: -1.347, row: 14.861, size: 56, z: 2 },
  { id: "lower-left-mushroom", src: ASSETS.forestMushroom, halfCol: 1.875, row: 19.722, size: 38, z: 3 },
  { id: "lower-right-cabin", src: ASSETS.forestCabin, halfCol: 1.903, row: 17.611, size: 198, z: 2 },
  { id: "lower-right-bush", src: ASSETS.forestTreeBush, halfCol: 2.153, row: 9.444, size: 78, z: 2 },
  { id: "lower-right-flowers", src: ASSETS.forestFlowers, halfCol: 0.236, row: 18.111, size: 44, z: 3 },
];

// World Cup scenery reuses the forest LAYOUT (positions, sizes, ids, z-order,
// flip/motion) but swaps each prop's art for a football-stadium equivalent, so
// the WC level track is reskinned without re-tuning placement. Keeping the same
// ids means the elevated/airborne classification below still applies.
const FOREST_TO_WC_SRC: Record<string, string> = {
  [ASSETS.forestTreePine]: ASSETS.wcFloodlight,
  [ASSETS.forestTreeBush]: ASSETS.wcCornerFlag,
  [ASSETS.forestFlowers]: ASSETS.wcFootball,
  [ASSETS.terrainStone]: ASSETS.wcScoreboard,
  [ASSETS.forestMushroom]: ASSETS.wcCone,
  [ASSETS.forestPond]: ASSETS.wcPodium,
  [ASSETS.forestFrog]: ASSETS.wcFootball,
  [ASSETS.forestFirefly]: ASSETS.wcBalloons,
  [ASSETS.forestSignpost]: ASSETS.wcSignboard,
  [ASSETS.forestStump]: ASSETS.wcCone,
  [ASSETS.forestCabin]: ASSETS.wcStadium,
};
const WORLDCUP_SCENERY: ScenerySprite[] = FOREST_SCENERY.map((s) => ({
  ...s,
  src: FOREST_TO_WC_SRC[s.src] ?? s.src,
}));

const ELEVATED_TREE_IDS = new Set([
  "upper-left-pine",
  "upper-left-bush",
  "upper-right-bush",
  "mid-left-pine",
  "mid-left-bush",
  "lower-right-bush",
]);

const AIRBORNE_SCENERY_IDS = new Set(["mid-right-firefly"]);

// Vertical tiling of the forest scene. The hand-authored FOREST_SCENERY layout
// spans ~20 rows; we repeat that exact arrangement every SCENERY_PERIOD_ROWS
// down the (infinite) path so the decoration never runs out. The period is a
// multiple of the 6-row path zigzag (so each repeat relates to the tiles the
// same way) and large enough to clear the tallest props (cabin/stone) without
// the next copy colliding with them.
const SCENERY_PERIOD_ROWS = 24;
const SCENE_MIN_ROW = Math.min(...FOREST_SCENERY.map((s) => s.row));
const SCENE_MAX_ROW = Math.max(...FOREST_SCENERY.map((s) => s.row));

const SKY_HEIGHT = 0;          // no sky band — uniform forest floor throughout
const PATH_TOP_PAD = GRID_H;   // start the path on the first cell row
// Just enough breathing room below the lowest level so its slab isn't flush
// against the scroll edge. No large reserved block — the world ends at the path,
// so you never scroll into empty terrain past the first/last level (this was the
// dead "other half" visible on low/new tracks and at the bottom of any track).
const PATH_BOTTOM_PAD = 24;

// Ground texture per level track. Forest: dark-green floor, grass speckle + a
// faint iso grid. World Cup: a mown football pitch — alternating mow-stripe
// bands, periodic white chalk lines, brighter pitch green.
type GroundStyle = Pick<
  React.CSSProperties,
  "backgroundColor" | "backgroundImage" | "backgroundSize" | "backgroundPosition" | "backgroundRepeat"
>;
const FOREST_GROUND: GroundStyle = {
  backgroundColor: "#102619",
  backgroundImage:
    "radial-gradient(circle at 50% 50%, rgba(70,120,82,0.13) 0 1.5px, transparent 2px), radial-gradient(circle at 50% 50%, rgba(8,24,15,0.22) 0 1.5px, transparent 2px), repeating-linear-gradient(26.57deg, rgba(140,190,150,0.05) 0 1px, transparent 1px 30px), repeating-linear-gradient(-26.57deg, rgba(140,190,150,0.05) 0 1px, transparent 1px 30px), linear-gradient(180deg, #1c3d2a 0%, #173323 45%, #102619 100%)",
  backgroundSize: "13px 13px, 21px 21px, auto, auto, 100% 100%",
  backgroundPosition: "0 0, 6px 9px, 0 0, 0 0, 0 0",
  backgroundRepeat: "repeat, repeat, repeat, repeat, no-repeat",
};
const PITCH_GROUND: GroundStyle = {
  // Matched to the forest treatment: dense grass flecks + a tight, deep gradient
  // so the pitch never reads as a flat/bright patch and no brightness seam shows
  // where the scrolling world meets the static background. Mown vertical stripes
  // keep the football-pitch identity.
  backgroundColor: "#205834",
  backgroundImage:
    "radial-gradient(circle at 50% 50%, rgba(170,215,170,0.10) 0 1.5px, transparent 2px), radial-gradient(circle at 50% 50%, rgba(8,30,16,0.22) 0 1.5px, transparent 2px), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 70px, rgba(0,0,0,0.06) 70px 140px), linear-gradient(180deg, #266b3c 0%, #215c36 55%, #1c5230 100%)",
  backgroundSize: "13px 13px, 21px 21px, auto, 100% 100%",
  backgroundPosition: "0 0, 6px 9px, 0 0, 0 0",
  backgroundRepeat: "repeat, repeat, repeat, no-repeat",
};
const GROUND_BY_TRACK: Record<LevelTrack, GroundStyle> = {
  standard: FOREST_GROUND,
  "world-cup": PITCH_GROUND,
};

const buildNodes = (
  currentLevel: number,
  topLevel: number,
  bottomLevel: number,
): LevelNode[] => {
  const result: LevelNode[] = [];
  for (let n = topLevel; n >= bottomLevel; n--) {
    const state: NodeState =
      n < currentLevel ? "done" : n === currentLevel ? "current" : "locked";
    result.push({ n, state, isBoss: n % 5 === 0 });
  }
  return result;
};

const Tile = ({
  node,
  point,
  index,
  currentLevel,
  obscured = false,
  onPlay,
  innerRef,
  unlocking = false,
}: {
  node: LevelNode;
  point: ScreenPoint;
  index: number;
  currentLevel: number;
  obscured?: boolean;
  onPlay: () => void;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  unlocking?: boolean;
}) => {
  const interactive = node.state === "current";
  const label =
    node.state === "current" ? `Level ${node.n}, current — play` :
    node.state === "done" ? `Level ${node.n}, completed` :
    `Level ${node.n}, locked`;
  const slab =
    node.state === "current" ? ASSETS.waffleSlabActive :
    node.state === "done" ? ASSETS.waffleSlabDone :
    ASSETS.waffleSlabLocked;
  const metrics = SLAB_METRICS[node.state];
  const tileScale = SLAB_TOP_FACE_RENDER_W / metrics.topFaceSourceW;
  const tileRenderW = TILE_SOURCE_W * tileScale;
  const tileRenderH = TILE_SOURCE_H * tileScale;
  const tileAnchorX = metrics.anchorSourceX * tileScale;
  const tileAnchorY = metrics.anchorSourceY * tileScale;

  // Stagger entrance: cap at 8 steps so very large index counts (after the
  // path extends via infinite scroll) don't accumulate huge delays.
  const enterDelayMs = (index % 8) * 60;

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: point.x - tileAnchorX,
        top: point.y - tileAnchorY,
        width: tileRenderW,
        height: tileRenderH,
        zIndex: 5 + index + (node.state === "current" ? 100 : 0),
      }}
    >
      {/* Inner wrapper handles the entrance animation so the outer centring
          transform isn't clobbered when the keyframe sets transform. */}
      <div
        style={{
          animation: `waffles-v2-tile-enter 360ms cubic-bezier(0.22, 1, 0.36, 1) ${enterDelayMs}ms backwards`,
          opacity: obscured ? 0.42 : undefined,
          filter: obscured ? "grayscale(0.45) saturate(0.45) brightness(1.55)" : undefined,
        }}
      >
      {/* Soft elliptical ground shadow (sits under the slab on the grass) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: tileRenderH * 0.78,
          transform: "translateX(-50%)",
          width: tileRenderW * 0.72,
          height: 12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* Attention ring under the current tile — a soft expanding glow that
          pulls the eye to the playable level. Pure decoration, hidden from AT. */}
      {node.state === "current" && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: tileAnchorY,
            width: GRID_W * 1.35,
            height: GRID_H * 0.9,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255, 201, 49, 0.55), transparent 65%)",
            animation: "waffles-v2-attention-ring 2400ms ease-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      {/* Unlock burst — a bright flash + expanding ring the moment the tile is
          unlocked. One-shot; sits above the slab. */}
      {unlocking && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: tileAnchorY,
              width: GRID_W * 1.1,
              height: GRID_W * 1.1,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.95), rgba(255,201,49,0.5) 45%, transparent 70%)",
              animation: "waffles-v2-unlock-flash 600ms ease-out both",
              pointerEvents: "none",
              zIndex: 6,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: tileAnchorY,
              width: GRID_W,
              height: GRID_W,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              border: "3px solid rgba(255, 201, 49, 0.9)",
              animation: "waffles-v2-unlock-ring 650ms cubic-bezier(0.22, 1, 0.36, 1) both",
              pointerEvents: "none",
              zIndex: 6,
            }}
          />
        </>
      )}
      <button
        type="button"
        className="pressable"
        disabled={!interactive}
        onClick={onPlay}
        aria-label={label}
        style={{
          display: "block",
          padding: 0,
          position: "relative",
          width: tileRenderW,
          height: tileRenderH,
          animation: node.state === "current" ? "waffles-v2-tile-bob 2.4s ease-in-out infinite" : undefined,
        }}
      >
        {shouldShowBossMarker(node, currentLevel) && (
          <PixelImg
            src={ASSETS.bossNightOwl}
            size={58}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: -44,
              transform: "translateX(-50%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}
        {/* Isometric slab (the 3D-rendered tile). */}
        <PixelImg
          src={slab}
          size={tileRenderW}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: tileRenderW,
            height: tileRenderH,
            filter:
              node.state === "current"
                ? "drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35))"
                : "drop-shadow(0 3px 0 rgba(0, 0, 0, 0.3))",
            // Newly-unlocked tile pops in with an overshoot.
            animation: unlocking ? "waffles-v2-unlock-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both" : undefined,
            transformOrigin: "50% 65%",
          }}
        />
        {/* Tile marker. Every tile shows its level number so the path reads
            both ways; the current tile swaps the number for a bright PLAY chip
            that doubles as the "you are here / tap to play" affordance (which is
            why the old berry YOU tag is gone — it was redundant). */}
        <div
          aria-hidden="true"
          className="level-tile-mark"
          data-state={node.state}
        >
          {node.state === "current" ? (
            <span className="level-tile-play">
              <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
              </svg>
              PLAY
            </span>
          ) : (
            <span
              className="level-tile-number"
              data-digits={String(node.n).length}
            >
              {node.n}
            </span>
          )}
        </div>
      </button>
      </div>
    </div>
  );
};

const CLOUD_CURTAIN_MASSES = [
  { id: "top-right", top: -80, right: 88, size: 380, opacity: 0.94, delayMs: -700 },
  { id: "upper-left", top: 58, left: 54, size: 410, opacity: 0.96, delayMs: -1500 },
  { id: "mid-right", top: 330, right: 48, size: 440, opacity: 0.95, delayMs: -2300 },
  { id: "lower-left", top: 560, left: 64, size: 500, opacity: 0.94, delayMs: -3200 },
  { id: "lower-right", top: 720, right: 72, size: 390, opacity: 0.78, delayMs: -4200 },
];

const CLOUD_PUFFS = [
  { left: "0%", top: "34%", width: "46%", height: "42%", color: "#c3ecef" },
  { left: "16%", top: "8%", width: "48%", height: "56%", color: "#f2faee" },
  { left: "42%", top: "18%", width: "54%", height: "48%", color: "#c3ecef" },
  { left: "8%", top: "58%", width: "58%", height: "40%", color: "#f2faee" },
  { left: "54%", top: "54%", width: "44%", height: "38%", color: "#f2faee" },
  { left: "30%", top: "42%", width: "52%", height: "46%", color: "#c3ecef" },
];

const CloudCurtain = ({ height }: { height: number }) => {
  if (height <= 0) return null;
  const cloudLimit = Math.max(0, height - CLOUD_BOUNDARY_CLEARANCE);
  const cloudMasses = CLOUD_CURTAIN_MASSES.filter((cloud) => (
    cloud.top + cloud.size * 0.68 <= cloudLimit
  ));

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: GRID_CANVAS_W,
        height: height + GRID_H * 2,
        overflow: "hidden",
        pointerEvents: "none",
        // Above the tiled scenery (ground 2 / airborne 140 / elevated trees
        // 160) so the far-up forest fades into the fog instead of poking
        // through the clouds. The curtain is height-clipped to the top region,
        // so this only affects the foggy "unknown future" zone.
        zIndex: 200,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(221, 244, 246, 0.76) 0%, rgba(186, 219, 226, 0.68) 74%, rgba(186, 219, 226, 0) 100%)",
        }}
      />
      {cloudMasses.map((cloud) => (
        <div
          key={cloud.id}
          data-cloud-curtain="true"
          data-cloud-id={cloud.id}
          style={{
            position: "absolute",
            top: cloud.top,
            left: "left" in cloud ? cloud.left : undefined,
            right: "right" in cloud ? cloud.right : undefined,
            width: cloud.size,
            height: cloud.size * 0.68,
            opacity: cloud.opacity,
            animation: "waffles-v2-cloud-drift 7800ms ease-in-out infinite",
            animationDelay: `${cloud.delayMs}ms`,
            filter: "drop-shadow(0 9px 5px rgba(105, 139, 148, 0.22))",
            willChange: "transform",
          }}
        >
          {CLOUD_PUFFS.map((puff, puffIndex) => (
            <div
              key={`${cloud.id}-${puffIndex}`}
              style={{
                position: "absolute",
                left: puff.left,
                top: puff.top,
                width: puff.width,
                height: puff.height,
                borderRadius: "50%",
                backgroundColor: puff.color,
                border: "5px solid rgba(238, 252, 244, 0.55)",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const GridLayer = ({
  height,
  winTop,
  winBot,
}: {
  height: number;
  // Visible y-window (px, path-container coords). Only grass cells inside it are
  // emitted so the SVG doesn't carry hundreds of <image>s for the whole path.
  winTop: number;
  winBot: number;
}) => {
  const half = GRID_H / 2;
  const totalRows = Math.ceil((height - PATH_TOP_PAD) / half) + 4;
  const startRow = Math.max(0, Math.floor((winTop - PATH_TOP_PAD) / half) - 2);
  const endRow = Math.min(totalRows, Math.ceil((winBot - PATH_TOP_PAD) / half) + 2);
  const halfCols = [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  const cells: { key: string; center: ScreenPoint }[] = [];
  for (let row = startRow; row <= endRow; row++) {
    for (const halfCol of halfCols) {
      if (Math.abs(halfCol % 2) === row % 2) {
        cells.push({ key: `${row}-${halfCol}`, center: latticeToScreen(halfCol, row) });
      }
    }
  }

  return (
    <svg
      aria-hidden="true"
      width={GRID_CANVAS_W}
      height={height}
      viewBox={`0 0 ${GRID_CANVAS_W} ${height}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "visible",
      }}
    >
      <g opacity="1">
        {cells.map(({ key, center }) => (
          <image
            key={`grass-${key}`}
            href={ASSETS.forestGridCellGrass}
            x={center.x - GRID_W / 2}
            y={center.y - GRID_H / 2}
            width={GRID_W}
            height={GRID_H}
            preserveAspectRatio="none"
            style={{ imageRendering: "pixelated" }}
          />
        ))}
      </g>
      <g opacity="0.38">
        {cells.map(({ key, center }) => (
          <path
            key={key}
            d={[
              `M ${center.x} ${center.y - GRID_H / 2}`,
              `L ${center.x + GRID_W / 2} ${center.y}`,
              `L ${center.x} ${center.y + GRID_H / 2}`,
              `L ${center.x - GRID_W / 2} ${center.y}`,
              "Z",
            ].join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
};

const renderScenerySprite = (sprite: ScenerySprite, rowOffset: number, copyKey: number = 0) => {
  const point = latticeToScreen(sprite.halfCol, sprite.row + rowOffset);
  return (
    <div
      key={`${sprite.id}-${copyKey}`}
      style={{
        position: "absolute",
        left: point.x,
        top: point.y,
        width: sprite.size,
        height: sprite.size,
        transform: "translate(-50%, -50%)",
        zIndex: sprite.z ?? 2,
      }}
    >
      <div
        style={{
          width: sprite.size,
          height: sprite.size,
          animation:
            sprite.motion === "firefly"
              ? "waffles-v2-firefly 5200ms ease-in-out infinite"
              : undefined,
          animationDelay: sprite.motionDelayMs ? `${sprite.motionDelayMs}ms` : undefined,
          willChange: sprite.motion === "firefly" ? "transform, opacity" : undefined,
        }}
      >
        <PixelImg
          src={sprite.src}
          size={sprite.size}
          alt=""
          priority="deferred"
          style={{
            display: "block",
            transform: sprite.flip ? "scaleX(-1)" : undefined,
            filter:
              sprite.motion === "firefly"
                ? "drop-shadow(0 0 7px rgba(255, 198, 49, 0.8))"
                : undefined,
          }}
        />
      </div>
    </div>
  );
};

// Split a scenery set into its z-layers (ground / airborne / elevated) by id.
const sceneryGroups = (set: ScenerySprite[]) => ({
  ground: set.filter((s) => !ELEVATED_TREE_IDS.has(s.id) && !AIRBORNE_SCENERY_IDS.has(s.id)),
  airborne: set.filter((s) => AIRBORNE_SCENERY_IDS.has(s.id)),
  elevated: set.filter((s) => ELEVATED_TREE_IDS.has(s.id)),
});
// Scenery per level track — picked by the levels-page tab.
const SCENERY_BY_TRACK: Record<LevelTrack, ReturnType<typeof sceneryGroups>> = {
  standard: sceneryGroups(FOREST_SCENERY),
  "world-cup": sceneryGroups(WORLDCUP_SCENERY),
};

const SceneryLayer = ({ track, rowOffset, winTop, winBot }: { track: LevelTrack; rowOffset: number; winTop: number; winBot: number }) => {
  const groups = SCENERY_BY_TRACK[track];
  // Tile the scene down the path. `rowOffset` keeps the base copy aligned with
  // the tiles (it shifts with them as the path extends); the other copies sit a
  // whole period above/below so the exact same layout repeats. We only render
  // copies whose row band intersects the visible y-window, so the sprite count
  // stays bounded no matter how far the (infinite) path has extended.
  const winTopRow = Math.max(0, (winTop - PATH_TOP_PAD) / ROW_STRIDE);
  const winBotRow = (winBot - PATH_TOP_PAD) / ROW_STRIDE;
  const kMin = Math.floor((winTopRow - rowOffset - SCENE_MAX_ROW) / SCENERY_PERIOD_ROWS);
  const kMax = Math.ceil((winBotRow - rowOffset - SCENE_MIN_ROW) / SCENERY_PERIOD_ROWS);
  const copies: number[] = [];
  for (let k = kMin; k <= kMax; k++) copies.push(k);

  const renderGroup = (group: ScenerySprite[]) =>
    copies.flatMap((k) =>
      group.map((sprite) => renderScenerySprite(sprite, rowOffset + k * SCENERY_PERIOD_ROWS, k)),
    );

  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
        {renderGroup(groups.ground)}
      </div>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 140 }}>
        {renderGroup(groups.airborne)}
      </div>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 160 }}>
        {renderGroup(groups.elevated)}
      </div>
    </>
  );
};

const LevelPathInner = () => {
  const proto = useProto();
  const track = proto.levelTrack;
  const tickets = proto.tickets;
  const startLevel = proto.startLevel;
  const currentLevel = proto.level;
  // One-shot unlock animation flag for the newly-unlocked tile; cleared after it
  // plays so revisiting the path doesn't replay it.
  const { levelJustUnlocked, update } = proto;
  useEffect(() => {
    if (levelJustUnlocked == null) return;
    const t = setTimeout(() => update({ levelJustUnlocked: null }), 1200);
    return () => clearTimeout(t);
  }, [levelJustUnlocked, update]);
  // Lives gate (proto.lives / nextLifeAt kept current by the provider regen tick).
  const outOfLives = proto.lives <= 0;
  const livesNow = useNow(proto.lives < LIVES_MAX);
  const livesNextMs = proto.nextLifeAt ? Math.max(0, proto.nextLifeAt - livesNow) : 0;
  const nextLifeIn = `${String(Math.floor(livesNextMs / 60000)).padStart(2, "0")}:${String(Math.floor((livesNextMs % 60000) / 1000)).padStart(2, "0")}`;
  const canRefill = proto.tickets >= LIVES_REFILL_COST;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTileRef = useRef<HTMLDivElement>(null);
  const [showJumpToCurrent, setShowJumpToCurrent] = useState(false);
  // Visible scroll window {top, height} in scroller coords, used to window the
  // grass/scenery/tiles so only what's near the viewport is rendered. Seeded
  // generously so the first paint isn't empty before the scroll handler runs.
  const [viewport, setViewport] = useState({ top: 0, height: 1200 });
  const didInitialScrollRef = useRef(false);

  const bottomLevel = useMemo(
    () => Math.max(1, currentLevel - HISTORY_DEPTH),
    [currentLevel],
  );
  // Fixed lookahead above the current level — a few revealed locked slabs then a
  // fog band, and then a HARD TOP. Not infinite: you can't scroll endlessly into
  // empty future terrain. (Was `useState` + an on-scroll top-extend that grew the
  // path forever.)
  const topLevel = currentLevel + REVEALED_LOCKED_LEVELS + INITIAL_CLOUD_LOOKAHEAD;
  const topExtensionRows = Math.max(
    0,
    topLevel - (currentLevel + REVEALED_LOCKED_LEVELS),
  );

  const nodes = useMemo(
    () => buildNodes(currentLevel, topLevel, bottomLevel),
    [currentLevel, topLevel, bottomLevel],
  );
  const pathPoints = useMemo(
    () => nodes.map((node) => pointForLevel(node.n, currentLevel, topExtensionRows)),
    [nodes, currentLevel, topExtensionRows],
  );
  // The world ends right at the lowest level's slab (+ a little pad) — no
  // reserved empty block below — so you can't scroll past the first/last level
  // into bare terrain. `lastPoint` is the bottom-most node (e.g. Level 1, which
  // has no Level 0 beneath it: the path must stop dead there).
  const lastPoint = pathPoints[pathPoints.length - 1] ?? latticeToScreen(0, 0);
  const pathHeight = lastPoint.y + MAX_TILE_BOTTOM_OFFSET + PATH_BOTTOM_PAD;
  const worldHeight = SKY_HEIGHT + pathHeight;

  // One-shot initial scroll to centre the current tile.
  //
  // We set scrollTop directly rather than using `scrollIntoView`: the scroll
  // container has `scroll-behavior: smooth`, and `scrollIntoView({behavior:
  // "auto"})` resolves "auto" to that CSS value — i.e. an *animated* scroll.
  // On mount that animation starts from the top and gets interrupted by the
  // first top-extend re-render, leaving the view parked on the cloud curtain
  // instead of the current level. Summing offsetTop up to the scroller gives
  // the tile's position regardless of the nested positioned wrappers, and the
  // direct assignment jumps instantly with no animation to interrupt.
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    const el = currentTileRef.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== scroller && scroller.contains(node)) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    scroller.scrollTop = Math.max(0, top + el.offsetHeight / 2 - scroller.clientHeight / 2);
    didInitialScrollRef.current = true;
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    // Coalesce scroll work into one rAF per frame: reading layout + setState on
    // every raw scroll event thrashes layout and over-renders. One measurement
    // per frame is plenty for the window/jump-button/extend checks.
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setViewport({ top: scroller.scrollTop, height: scroller.clientHeight });

        const currentTile = currentTileRef.current;
        if (currentTile) {
          const currentCenter = currentTile.offsetTop + currentTile.offsetHeight / 2;
          const viewportCenter = scroller.scrollTop + scroller.clientHeight / 2;
          setShowJumpToCurrent(viewportCenter < currentCenter - GRID_H * 3);
        }
      });
    };

    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [nodes.length, topExtensionRows]);

  // Render window: one viewport-height of buffer above and below the visible
  // area (SKY_HEIGHT is 0, so scroller coords match the path container's). Tiles
  // outside it aren't mounted — except the current tile, which is always kept so
  // the jump-to-current button and initial centering can rely on its ref.
  const winTop = viewport.top - viewport.height;
  const winBot = viewport.top + viewport.height * 2;

  return (
    <Phone>
      <TopHeader tickets={tickets} title="FOREST" />
      <TrackTabs active={track} onSelect={proto.setLevelTrack} />

      {/* Lives chip — current lives + time to the next one. */}
      <div style={{ position: "absolute", top: 66, right: 16, zIndex: 13, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 99, padding: "5px 10px" }}>
        <PixelImg src={ASSETS.heartFull} size={18} alt="" />
        <span style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{proto.lives}</span>
        {proto.lives < LIVES_MAX && (
          <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{nextLifeIn}</span>
        )}
      </div>

      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 140,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          // Full field texture (not a flat colour) so any area the level world
          // doesn't cover still reads as the field, never a bare flat patch.
          ...GROUND_BY_TRACK[track],
          // No `scroll-behavior: smooth` here: it would make the programmatic
          // initial-centering (and the top-extend anchor restore) animate and
          // get interrupted, parking the view on the cloud curtain. The
          // jump-to-current button requests smooth scrolling explicitly.
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* Single continuous world. The ground is given a procedural terrain
            texture — grass speckle (two dot layers), a faint isometric grid
            echoing the tiles, and a vertical depth gradient — so the area below
            the tiles never reads as a flat colour. */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: worldHeight,
            // Always at least fill the viewport so the field never ends in a
            // bare flat strip below the lowest level.
            minHeight: "100%",
            // Clip everything to the world's bounds. The scenery layer tiles
            // sprites following the scroll viewport with no lower bound; without
            // this, each sprite below the path extends the scrollable area, which
            // renders more scenery, which extends it again — letting you scroll
            // endlessly into empty "forest + floor" past the first/last level.
            // Clipping breaks that loop so the scroll ends at the path.
            overflow: "hidden",
            ...GROUND_BY_TRACK[track],
          }}
        >
          <div
            style={{
              position: "absolute",
              top: SKY_HEIGHT,
              left: "50%",
              width: GRID_CANVAS_W,
              height: pathHeight,
              transform: "translateX(-50%)",
            }}
          >
            <GridLayer height={pathHeight} winTop={winTop} winBot={winBot} />
            <SceneryLayer track={track} rowOffset={topExtensionRows} winTop={winTop} winBot={winBot} />
            {nodes.map((node, i) => {
              const point = pathPoints[i];
              // Window the tiles: skip those well outside the viewport, but never
              // drop the current tile (its ref backs the jump button + centering).
              if (node.state !== "current" && (point.y < winTop || point.y > winBot)) {
                return null;
              }
              const obscured = node.state === "locked" && node.n > currentLevel + REVEALED_LOCKED_LEVELS;

              return (
                <Tile
                  key={node.n}
                  node={node}
                  point={point}
                  index={i}
                  currentLevel={currentLevel}
                  obscured={obscured}
                  onPlay={() => node.state === "current" && startLevel()}
                  innerRef={node.state === "current" ? currentTileRef : undefined}
                  unlocking={node.n === levelJustUnlocked}
                />
              );
            })}
            <CloudCurtain height={PATH_TOP_PAD + topExtensionRows * ROW_STRIDE} />
          </div>
        </div>

        {/* Sticky free-ticket banner — floats on the field */}
        <div
          style={{
            position: "sticky",
            bottom: 8,
            margin: "0 14px",
            background: "linear-gradient(180deg, var(--maple-500), var(--maple-400))",
            border: "3px solid var(--frame)",
            borderRadius: 14,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 0 var(--frame)",
            zIndex: 10,
          }}
        >
          <TicketIcon size={28} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--frame)", lineHeight: 1 }}>
              Level 21 · Free Ticket
            </div>
            <div style={{ fontSize: 11, color: "var(--frame)", fontWeight: 700, opacity: 0.75 }}>
              3 levels away
            </div>
          </div>
          <div style={{ height: 6, width: 80, borderRadius: 99, background: "rgba(30,30,30,.25)", overflow: "hidden" }}>
            <div style={{ width: "70%", height: "100%", background: "var(--frame)", borderRadius: 99 }} />
          </div>
        </div>
      </div>

      {showJumpToCurrent && (
        <button
          type="button"
          aria-label="Jump to current level"
          onClick={() => currentTileRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })}
          style={{
            position: "absolute",
            right: 22,
            bottom: 238,
            width: 58,
            height: 58,
            borderRadius: 14,
            border: "3px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(52, 60, 62, 0.78)",
            color: "var(--ink)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 0 rgba(0, 0, 0, 0.28)",
            zIndex: 12,
          }}
        >
          <ArrowDown size={34} strokeWidth={3.25} />
        </button>
      )}

      <div className="cta-row sticky">
        <button className="cta icon-btn" aria-label="Back to home" onClick={() => proto.goto("home")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {outOfLives ? (
          <button className="cta maple" onClick={() => proto.refillLives()} disabled={!canRefill} style={!canRefill ? { opacity: 0.55, cursor: "default" } : undefined} aria-label={canRefill ? `Refill lives for ${LIVES_REFILL_COST} ticket` : `Next life in ${nextLifeIn}`}>
            {canRefill ? <>REFILL <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><TicketIcon size={14} />{LIVES_REFILL_COST}</span></> : `NEXT LIFE ${nextLifeIn}`}
          </button>
        ) : (
          <button className="cta" data-coach="levels-play" onClick={() => startLevel()}>PLAY LEVEL {proto.level}</button>
        )}
      </div>
      <div className="bottom-bar">
        <TabBar active="levels" />
      </div>
    </Phone>
  );
};

// Keyed by the active track so switching tabs remounts the scroll world fresh —
// its current-level centering, infinite-scroll window and refs all re-seed for
// the new campaign instead of carrying over the other track's scroll position.
export const LevelPath = () => {
  const track = useProto().levelTrack;
  return <LevelPathInner key={track} />;
};
