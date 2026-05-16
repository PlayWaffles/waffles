"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useProto } from "../state";
import { ASSETS, Phone, PixelImg, TabBar, TicketIcon, TopHeader } from "../shared";

type NodeState = "done" | "current" | "locked";
type LevelNode = { n: number; state: NodeState; isBoss: boolean };

// Isometric grid cell — a 2:1 rhombus. The CSS floor renders one diamond
// per SVG tile so each visible diamond on the floor is exactly GRID_W × GRID_H.
const GRID_W = 96;
const GRID_H = 48;

// Waffle's TOP face matches one grid cell exactly. The 3D side panels hang
// below the top face — that depth overlaps into the next iso row, which is
// the natural way isometric stacks render.
const TILE_SIZE = GRID_W;
const TILE_VISUAL_H = GRID_H + GRID_H * 0.5; // top face = GRID_H tall, plus 3D depth

// Serpentine zigzag: 3 tiles step diagonally one way, then 3 step back the
// other way. Each step is one TRUE iso-adjacent cell — half a cell over
// horizontally AND half a cell down vertically — so every tile centre lands
// exactly on a grid cell centre.
const ZIG = GRID_W / 2;
const ZIG_LEG = 3;
const offsetForIdx = (i: number) => {
  const cycle = ZIG_LEG * 2;
  const t = i % cycle;
  const col = t < ZIG_LEG ? t : cycle - 1 - t;
  return (col - 1) * ZIG;
};

const SKY_HEIGHT = 0;          // no sky band — uniform forest floor throughout
const PATH_TOP_PAD = GRID_H;   // start the path on the first cell row
// Each row drops by ONE full grid cell so each tile lands on a fresh cell
// row. The slab's depth (the bottom GRID_H/2 of each tile) is the only thing
// that overlaps the next row — its top face stays clean.
const ROW_STRIDE = GRID_H;
const PATH_BOTTOM_PAD = 60;
const WALLY_BLOCK_HEIGHT = 200;

// Infinite-scroll tuning.
const INITIAL_LOOKAHEAD = 14;  // locked levels rendered above current on mount
const HISTORY_DEPTH = 6;       // done levels rendered below current
const EXTEND_BY = 16;          // levels added each time the top sentinel is hit

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

// Decorative scenery sprites. With infinite scroll the world height grows as
// the path extends upward, so scenery is anchored to either the TOP of the
// world (near the sky) or the BOTTOM (the Wally / done-levels region) so it
// stays visually pinned to a stable landmark instead of drifting.
type Scenery = {
  src: string;
  x: string;
  anchor: "top" | "bottom";
  y: number;
  size: number;
  flip?: boolean;
  z?: number;
};

// Scenery is arranged in NATURAL CLUSTERS rather than alternating sides on
// a fixed rhythm — small items hug their bigger neighbours (mushroom under
// a tree, flowers around a pond) so the world reads like a real forest.
// All sprites sit in the safe gutters (path occupies ~20–80% of width on a
// 320px viewport, so scenery lives in 0–18% / 82–100%). Sizes vary to give
// foreground/background depth without breaking the bounds.
const SCENERY: Scenery[] = [
  // Pond + frog + flowers cluster (bottom-right, near Wally)
  { src: ASSETS.forestPond,    x: "78%", anchor: "bottom", y: 70,  size: 70 },
  { src: ASSETS.forestFrog,    x: "86%", anchor: "bottom", y: 92,  size: 24, z: 4 },
  { src: ASSETS.forestFlowers, x: "82%", anchor: "bottom", y: 138, size: 38 },
  // Signpost (bottom-left)
  { src: ASSETS.forestSignpost, x: "1%",  anchor: "bottom", y: 50,  size: 60 },
  { src: ASSETS.forestMushroom, x: "12%", anchor: "bottom", y: 60,  size: 24 },
  // Cabin grove (left side)
  { src: ASSETS.forestCabin,    x: "0%",  anchor: "bottom", y: 220, size: 70 },
  { src: ASSETS.forestTreeBush, x: "12%", anchor: "bottom", y: 230, size: 36 },
  // Right tree pair with undergrowth
  { src: ASSETS.forestTreePine, x: "84%", anchor: "bottom", y: 250, size: 64 },
  { src: ASSETS.forestMushroom, x: "82%", anchor: "bottom", y: 245, size: 24 },
  { src: ASSETS.forestFlowers,  x: "94%", anchor: "bottom", y: 280, size: 30 },
  // Lone tall pine (left)
  { src: ASSETS.forestTreePine, x: "1%",  anchor: "bottom", y: 410, size: 60 },
  { src: ASSETS.forestFlowers,  x: "9%",  anchor: "bottom", y: 408, size: 28 },
  // Right bush stand
  { src: ASSETS.forestTreeBush, x: "82%", anchor: "bottom", y: 470, size: 50 },
  { src: ASSETS.forestMushroom, x: "94%", anchor: "bottom", y: 510, size: 22 },
  // Mushroom patch (left)
  { src: ASSETS.forestMushroom, x: "3%",  anchor: "bottom", y: 580, size: 28 },
  { src: ASSETS.forestMushroom, x: "11%", anchor: "bottom", y: 600, size: 20 },
  // Tree + flowers (right)
  { src: ASSETS.forestTreePine, x: "85%", anchor: "bottom", y: 650, size: 56 },
  { src: ASSETS.forestFlowers,  x: "82%", anchor: "bottom", y: 680, size: 36 },
  // Sparse decorations climbing toward locked region
  { src: ASSETS.forestFlowers,  x: "1%",  anchor: "bottom", y: 760, size: 34 },
  { src: ASSETS.forestTreeBush, x: "84%", anchor: "bottom", y: 820, size: 44 },
  { src: ASSETS.forestMushroom, x: "8%",  anchor: "bottom", y: 880, size: 22 },
  { src: ASSETS.forestFlowers,  x: "84%", anchor: "bottom", y: 920, size: 32 },
];

const Tile = ({
  node,
  x,
  y,
  index,
  onPlay,
  innerRef,
}: {
  node: LevelNode;
  x: number;
  y: number;
  index: number;
  onPlay: () => void;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}) => {
  const interactive = node.state === "current";
  const label =
    node.state === "current" ? `Level ${node.n}, current — play` :
    node.state === "done" ? `Level ${node.n}, completed` :
    `Level ${node.n}, locked`;
  // All waffles are the same size — one grid cell wide. Boss tiles get a
  // distinguishing crown sprite above instead of a larger slab.
  const size = TILE_SIZE;
  const slab =
    node.state === "current" ? ASSETS.waffleSlabActive :
    node.state === "done" ? ASSETS.waffleSlabDone :
    ASSETS.waffleSlabLocked;

  // Stagger entrance: cap at 8 steps so very large index counts (after the
  // path extends via infinite scroll) don't accumulate huge delays.
  const enterDelayMs = (index % 8) * 60;

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: y,
        transform: "translate(-50%, -32%)",
        zIndex: node.state === "current" ? 6 : 5,
      }}
    >
      {/* Inner wrapper handles the entrance animation so the outer centring
          transform isn't clobbered when the keyframe sets transform. */}
      <div
        style={{
          animation: `waffles-v2-tile-enter 360ms cubic-bezier(0.22, 1, 0.36, 1) ${enterDelayMs}ms backwards`,
        }}
      >
      {/* Soft elliptical ground shadow (sits under the slab on the grass) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: size * 0.78,
          transform: "translateX(-50%)",
          width: size * 0.95,
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
            top: size * 0.55,
            width: size * 1.35,
            height: size * 0.55,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255, 201, 49, 0.55), transparent 65%)",
            animation: "waffles-v2-attention-ring 2400ms ease-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
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
          width: size,
          height: TILE_VISUAL_H,
          animation: node.state === "current" ? "waffles-v2-tile-bob 2.4s ease-in-out infinite" : undefined,
        }}
      >
        {node.isBoss && node.state !== "current" && (
          <PixelImg
            src={ASSETS.bossNightOwl}
            size={42}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: -32,
              transform: "translateX(-50%)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        )}
        {/* Isometric slab (the 3D-rendered tile). The active slab PNG was
            drawn with a thicker 3D side face than the done/locked slabs, so
            we squash it vertically to normalize the apparent depth. */}
        <img
          src={slab}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            transform: node.state === "current" ? "scaleY(0.86)" : undefined,
            transformOrigin: "top center",
            filter:
              node.state === "current"
                ? "drop-shadow(0 4px 0 rgba(0, 0, 0, 0.35))"
                : "drop-shadow(0 3px 0 rgba(0, 0, 0, 0.3))",
          }}
        />
        {/* Centered label or icon, sitting on the slab's top face */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "32%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
            opacity: node.state === "locked" ? 0.7 : 1,
            filter: node.state === "locked" ? "grayscale(0.25) brightness(0.85)" : "none",
          }}
        >
          {node.state === "done" ? (
            <PixelImg src={ASSETS.checkmark} size={28} alt="" />
          ) : node.state === "locked" ? (
            <PixelImg src={ASSETS.lock} size={22} alt="" />
          ) : (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color: "var(--frame)",
                textShadow: "0 2px 0 rgba(255, 255, 255, 0.35)",
                lineHeight: 1,
              }}
            >
              {node.n}
            </span>
          )}
        </div>
        {node.state === "current" && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -28,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--berry)",
              color: "var(--frame)",
              fontFamily: "var(--font-display)",
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 0 var(--frame)",
              zIndex: 3,
            }}
          >
            YOU
          </div>
        )}
      </button>
      </div>
    </div>
  );
};

const SkyBand = () => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: SKY_HEIGHT,
      background:
        "linear-gradient(180deg, #0b1730 0%, #1d2a4f 40%, #3b2f5e 75%, rgba(59, 47, 94, 0) 100%)",
      pointerEvents: "none",
      zIndex: 1,
    }}
  >
    {[
      [10, 36], [22, 18], [38, 52], [54, 24], [68, 60], [82, 30], [92, 70],
      [16, 80], [44, 90], [76, 14], [60, 110], [28, 130], [88, 140],
    ].map(([x, y], i) => (
      <span
        key={i}
        style={{
          position: "absolute",
          left: `${x}%`,
          top: y,
          width: 3,
          height: 3,
          borderRadius: 99,
          background: "#fdfbf6",
          opacity: 0.7,
          boxShadow: "0 0 6px rgba(253, 251, 246, 0.9)",
          animation: `waffles-v2-twinkle ${2 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
        }}
      />
    ))}
    <PixelImg
      src={ASSETS.forestMoon}
      size={84}
      alt=""
      style={{ position: "absolute", top: 28, right: 22 }}
    />
  </div>
);

const Fireflies = () => (
  <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 7 }}>
    {[
      { x: 18, y: SKY_HEIGHT + 200, dur: 6, delay: 0 },
      { x: 78, y: SKY_HEIGHT + 350, dur: 7, delay: 1 },
      { x: 32, y: SKY_HEIGHT + 520, dur: 5, delay: 0.5 },
      { x: 70, y: SKY_HEIGHT + 680, dur: 8, delay: 2 },
      { x: 22, y: SKY_HEIGHT + 850, dur: 6, delay: 1.5 },
      { x: 78, y: SKY_HEIGHT + 1020, dur: 7, delay: 3 },
    ].map((f, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${f.x}%`,
          top: f.y,
          animation: `waffles-v2-firefly ${f.dur}s ease-in-out ${f.delay}s infinite`,
        }}
      >
        <PixelImg src={ASSETS.forestFirefly} size={18} alt="" />
      </div>
    ))}
  </div>
);

export const LevelPath = () => {
  const proto = useProto();
  const tickets = proto.tickets;
  const startLevel = proto.startLevel;
  const currentLevel = proto.level;
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTileRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  // Saved scrollHeight from just before an upward extension; used to keep the
  // user's visible content anchored when we prepend more locked levels.
  const heightBeforeExtendRef = useRef<number | null>(null);
  const didInitialScrollRef = useRef(false);

  const bottomLevel = useMemo(
    () => Math.max(1, currentLevel - HISTORY_DEPTH),
    [currentLevel],
  );
  const [topLevel, setTopLevel] = useState(currentLevel + INITIAL_LOOKAHEAD);

  const nodes = useMemo(
    () => buildNodes(currentLevel, topLevel, bottomLevel),
    [currentLevel, topLevel, bottomLevel],
  );

  // Compute total world height from row stride.
  const pathHeight = PATH_TOP_PAD + Math.max(0, nodes.length - 1) * ROW_STRIDE + TILE_VISUAL_H;
  const worldHeight = SKY_HEIGHT + PATH_TOP_PAD + pathHeight + WALLY_BLOCK_HEIGHT + PATH_BOTTOM_PAD;

  // After a top-extend, restore the visible scroll position so the user's
  // content stays anchored where it was (we prepended height above the view).
  useLayoutEffect(() => {
    const before = heightBeforeExtendRef.current;
    if (before === null) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const delta = scroller.scrollHeight - before;
    if (delta > 0) scroller.scrollTop += delta;
    heightBeforeExtendRef.current = null;
  }, [topLevel]);

  // One-shot initial scroll to the current tile. `scrollIntoView` with
  // block:center is more robust than computing offsets ourselves — it works
  // regardless of nested positioned ancestors and always centres the element
  // visually in the scroll viewport.
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    const el = currentTileRef.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
    didInitialScrollRef.current = true;
  }, []);

  // Infinite scroll: when the top sentinel approaches the viewport, prepend
  // more locked levels above the current top. Bottom is fixed at level 1.
  // The observer's first callback after observe() reports the *initial*
  // intersection state — if the sentinel happens to be inside the trigger
  // zone right after mount (e.g. on a short path) it would fire an
  // unwanted extension that pushes the current tile out of view. We swallow
  // the very first callback and only honour subsequent ones.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const scroller = scrollRef.current;
    if (!sentinel || !scroller) return;
    // Defer setup until after the auto-scroll has had a frame to settle.
    let firstCallback = true;
    let extending = false;
    let obs: IntersectionObserver | null = null;
    const t = setTimeout(() => {
      obs = new IntersectionObserver(
        (entries) => {
          if (firstCallback) {
            firstCallback = false;
            return;
          }
          if (extending) return;
          if (entries.some((e) => e.isIntersecting)) {
            extending = true;
            heightBeforeExtendRef.current = scroller.scrollHeight;
            setTopLevel((t) => t + EXTEND_BY);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                extending = false;
              });
            });
          }
        },
        { root: scroller, rootMargin: "400px 0px 0px 0px" },
      );
      obs.observe(sentinel);
    }, 50);
    return () => {
      clearTimeout(t);
      obs?.disconnect();
    };
  }, []);

  return (
    <Phone>
      <TopHeader tickets={tickets} title="FOREST" />

      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          top: 12,
          left: 0,
          right: 0,
          bottom: 140,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          // Isometric grass floor — a single hand-designed pixel-art tile
          // that includes subtle diamond grid lines, grass blade texture, and
          // tiny flower specks. The tile is rendered at GRID_FLOOR_W to make
          // each visible diamond on the floor exactly GRID_W × GRID_H wide.
          // `background-attachment: local` is what sells the illusion: the
          // floor scrolls with the inner content instead of staying pinned
          // to the scroll viewport, so the waffles read as sitting ON it.
          backgroundColor: "#2c5b34",
          backgroundImage: `url(${ASSETS.forestFloorTile})`,
          backgroundSize: `${GRID_W * 4}px ${GRID_W * 4}px`,
          backgroundRepeat: "repeat",
          backgroundPosition: "center top",
          backgroundAttachment: "local",
          imageRendering: "pixelated",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {/* Sticky top vignette so the FOREST title reads cleanly */}
        <div
          aria-hidden="true"
          style={{
            position: "sticky",
            top: 0,
            height: 60,
            marginBottom: -60,
            background: "linear-gradient(180deg, rgba(7,7,5,0.7) 0%, transparent 100%)",
            zIndex: 8,
            pointerEvents: "none",
          }}
        />

        {/* Single continuous world */}
        <div style={{ position: "relative", width: "100%", height: worldHeight }}>

          {/* Scattered scenery — anchored to top or bottom so the props stay
              visually pinned as the path extends upward via infinite scroll. */}
          {SCENERY.map((s, i) => (
            <PixelImg
              key={i}
              src={s.src}
              size={s.size}
              alt=""
              style={{
                position: "absolute",
                left: s.x,
                top: s.anchor === "top" ? s.y : undefined,
                bottom: s.anchor === "bottom" ? s.y : undefined,
                transform: s.flip ? "scaleX(-1)" : undefined,
                zIndex: s.z ?? 2,
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Procedural terrain — sparse stone patches break up the uniform
              forest floor. Placed BEHIND the path tiles via low z-index so the
              path always reads on top. Positions and sizes are bounded to fit
              entirely inside a 320px-wide viewport so patches don't clip. */}
          {nodes.map((node, i) => {
            if (node.n % 4 !== 1) return null; // every 4th level gets a patch
            const y = PATH_TOP_PAD + i * ROW_STRIDE;
            const seed = node.n;
            const onLeft = (seed * 11) % 2 === 0;
            const xPct = onLeft ? ((seed * 7) % 6) : 58 + ((seed * 7) % 8);
            const size = 70 + ((seed * 13) % 24);
            return (
              <PixelImg
                key={`stone-${node.n}`}
                src={ASSETS.terrainStone}
                size={size}
                alt=""
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: y - size * 0.18,
                  opacity: 0.7,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/* Clouds — drift over LOCKED levels so future content feels "yet to
              be discovered" (Mario / Zelda fog-of-war metaphor). Skipping the
              two locked tiles immediately above the current keeps the YOU
              pill and the playable tile's silhouette unobstructed. */}
          {nodes.map((node, i) => {
            if (node.state !== "locked") return null;
            if (node.n - currentLevel < 3) return null; // protect current's neighbours
            if (node.n % 2 !== 0) return null;          // skip every other for density
            const y = PATH_TOP_PAD + i * ROW_STRIDE;
            const seed = node.n;
            const xPct = ((seed * 31) % 56) + 2; // 2% .. 58%
            const size = 80 + ((seed * 17) % 26); // 80-105
            const opacity = 0.78 + ((seed * 7) % 18) / 100;
            const dur = 8 + ((seed * 5) % 6);
            const delay = ((seed * 13) % 40) / 10;
            return (
              <PixelImg
                key={`cloud-${node.n}`}
                src={ASSETS.cloud}
                size={size}
                alt=""
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: y - size * 0.55,
                  opacity,
                  zIndex: 7,
                  pointerEvents: "none",
                  animation: `waffles-v2-cloud-drift ${dur}s ease-in-out ${delay}s infinite`,
                  filter: "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.25))",
                }}
              />
            );
          })}

          {/* Path of waffle tiles down the center. Each tile is absolutely
              placed by isometric grid coordinates; its visual top-face center
              sits on the floor diamond center, while the 3D side face hangs
              into the next row. */}
          <div
            style={{
              position: "absolute",
              top: SKY_HEIGHT,
              left: 0,
              right: 0,
              height: pathHeight,
              zIndex: 4,
            }}
          >
            <div ref={topSentinelRef} aria-hidden="true" style={{ position: "absolute", top: 0, height: 1, width: 1 }} />
            {nodes.map((node, i) => {
              const y = PATH_TOP_PAD + i * ROW_STRIDE;
              return (
                <Tile
                  key={node.n}
                  node={node}
                  x={offsetForIdx(i)}
                  y={y}
                  index={i}
                  onPlay={() => node.state === "current" && startLevel()}
                  innerRef={node.state === "current" ? currentTileRef : undefined}
                />
              );
            })}
          </div>

          {/* Wally on stump + bubble — anchored at the bottom of the world */}
          <div
            style={{
              position: "absolute",
              left: 8,
              top: SKY_HEIGHT + PATH_TOP_PAD + pathHeight + 30,
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              zIndex: 7,
            }}
          >
            <PixelImg src={ASSETS.wallyStump} size={120} alt="" style={{ flexShrink: 0 }} />
            <div className="bubble" style={{ marginBottom: 36, maxWidth: 200 }}>
              Level <b>{proto.level}</b> — three away from your next ticket. Keep going!
            </div>
          </div>

          <Fireflies />
        </div>

        {/* Sticky free-ticket banner */}
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

      <div className="cta-row sticky">
        <button className="cta icon-btn" aria-label="Back to home" onClick={() => proto.goto("home")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="cta" onClick={() => startLevel()}>PLAY LEVEL {proto.level}</button>
      </div>
      <div className="bottom-bar">
        <TabBar active="levels" />
      </div>
    </Phone>
  );
};
