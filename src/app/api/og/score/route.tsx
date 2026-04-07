/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { OG_WIDTH, OG_HEIGHT, COLORS, safeImageUrl } from "../utils";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/**
 * Score Share OG Image - Clean & Minimal Design
 * 
 * A stunning, minimalist score card with strong visual hierarchy.
 * The score is the hero - everything else supports it.
 * 
 * Params:
 * - score: number (required)
 * - username: string (required)
 * - pfpUrl: string (optional)
 * - gameNumber: number (required)
 * - rank: number (optional)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Parse params
    const score = parseInt(searchParams.get("score") || "0", 10);
    const username = searchParams.get("username") || "Player";
    const pfpUrlParam = searchParams.get("pfpUrl");
    const gameNumber = parseInt(searchParams.get("gameNumber") || "1", 10);
    const rankParam = searchParams.get("rank");
    const rank = rankParam ? parseInt(rankParam, 10) : null;

    // Load assets
    const publicDir = join(process.cwd(), "public");
    const [fontData, brockmannData, bgBuffer, logoBuffer, safePfpUrl] = await Promise.all([
        readFile(join(publicDir, "fonts/editundo_bd.ttf")),
        readFile(join(process.cwd(), "src/lib/fonts/brockmann_bd.otf")),
        readFile(join(publicDir, "images/share/bg.png")),
        readFile(join(publicDir, "logo-onboarding.png")),
        safeImageUrl(pfpUrlParam),
    ]);

    // Convert to base64
    const bgImage = `data:image/png;base64,${bgBuffer.toString("base64")}`;
    const logoImage = `data:image/png;base64,${logoBuffer.toString("base64")}`;

    // Format display values
    const gameName = `WAFFLES #${String(gameNumber).padStart(3, "0")}`;
    const formattedScore = score.toLocaleString();

    // Rank display with ordinal suffix
    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.8) 100%), url(${bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    fontFamily: "EditUndo",
                }}
            >
                {/* Logo - Top Center */}
                <img
                    src={logoImage}
                    alt="Waffles"
                    width={160}
                    height={32}
                    style={{ position: "absolute", top: 40 }}
                />

                {/* Main Content - Centered & Clean */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 20,
                    }}
                >
                    {/* User Identity */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "#2A2A2A",
                                border: "3px solid rgba(255, 255, 255, 0.2)",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {safePfpUrl ? (
                                <img
                                    src={safePfpUrl}
                                    alt=""
                                    width={64}
                                    height={64}
                                    style={{ objectFit: "cover" }}
                                />
                            ) : (
                                <span style={{ fontSize: 30, color: "rgba(255,255,255,0.6)" }}>
                                    {username[0]?.toUpperCase() ?? "?"}
                                </span>
                            )}
                        </div>
                        <span
                            style={{
                                fontFamily: "EditUndo",
                                fontSize: 44,
                                color: COLORS.white,
                                textTransform: "uppercase",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {username}
                        </span>
                    </div>

                    {/* Score - The Hero */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0,
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "Brockmann",
                                fontSize: 36,
                                color: COLORS.grayLabel,
                                letterSpacing: "0.2em",
                                textTransform: "uppercase",
                            }}
                        >
                            scored
                        </span>
                        <span
                            style={{
                                fontFamily: "EditUndo",
                                fontSize: 200,
                                color: COLORS.gold,
                                lineHeight: 0.9,
                                letterSpacing: "-0.03em",
                            }}
                        >
                            {formattedScore}
                        </span>
                        <span
                            style={{
                                fontFamily: "Brockmann",
                                fontSize: 40,
                                color: "rgba(255, 201, 49, 0.6)",
                                letterSpacing: "0.15em",
                                textTransform: "uppercase",
                                marginTop: 10,
                            }}
                        >
                            points
                        </span>
                    </div>

                    {/* Rank - Only if available */}
                    {rank && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 16,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "Brockmann",
                                    fontSize: 28,
                                    color: COLORS.grayLabel,
                                }}
                            >
                                Finished
                            </span>
                            <span
                                style={{
                                    fontFamily: "EditUndo",
                                    fontSize: 44,
                                    color: rank <= 3 ? "#14B985" : COLORS.white,
                                }}
                            >
                                {getOrdinal(rank)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer - Game Info & Branding */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        position: "absolute",
                        bottom: 50,
                        left: 60,
                        right: 60,
                    }}
                >
                    {/* Game Info */}
                    <span
                        style={{
                            fontFamily: "EditUndo",
                            fontSize: 30,
                            color: COLORS.white,
                            opacity: 0.8,
                        }}
                    >
                        {gameName}
                    </span>

                    {/* Play CTA */}
                    <div
                        style={{
                            display: "flex",
                            padding: "14px 32px",
                            border: `2px solid ${COLORS.goldAlt}`,
                            borderRadius: 100,
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "EditUndo",
                                fontSize: 24,
                                color: COLORS.goldAlt,
                            }}
                        >
                            PLAYWAFFLES.FUN
                        </span>
                    </div>
                </div>
            </div>
        ),
        {
            width: OG_WIDTH,
            height: OG_HEIGHT,
            fonts: [
                {
                    name: "EditUndo",
                    data: fontData.buffer as ArrayBuffer,
                    style: "normal",
                    weight: 700,
                },
                {
                    name: "Brockmann",
                    data: brockmannData.buffer as ArrayBuffer,
                    style: "normal",
                    weight: 700,
                },
            ],
        }
    );
}
