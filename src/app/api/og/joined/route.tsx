/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_WIDTH, OG_HEIGHT, COLORS, safeImageUrl } from "../utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;

        // Parse params
        const username = searchParams.get("username") || "User";
        const prizePool = searchParams.get("prizePool") || "0";
        const theme = searchParams.get("theme") || "General";
        const pfpUrlParam = searchParams.get("pfpUrl");
        const themeImageUrl = searchParams.get("themeImageUrl");

        // Require themeImageUrl
        if (!themeImageUrl) {
            return new Response("Missing required parameter: themeImageUrl", { status: 400 });
        }

        // Load assets from filesystem
        const publicDir = join(process.cwd(), "public");
        const bgPath = join(publicDir, "images/share/bg.webp");
        const moneyPath = join(publicDir, "images/share/money.webp");
        const fontPath = join(publicDir, "fonts/editundo_bd.ttf");
        const brockmannPath = join(process.cwd(), "src/lib/fonts/brockmann_bd.otf");

        // Load assets and safely fetch pfpUrl in parallel
        const [bgBuffer, moneyBuffer, fontData, brockmannData, safePfpUrl] = await Promise.all([
            readFile(bgPath),
            readFile(moneyPath),
            readFile(fontPath),
            readFile(brockmannPath),
            safeImageUrl(pfpUrlParam), // Returns null if fetch fails
        ]);

        // Convert to base64
        const bgImage = `data:image/png;base64,${bgBuffer.toString("base64")}`;
        const moneyIcon = `data:image/png;base64,${moneyBuffer.toString("base64")}`;

        // Format prize pool
        const formattedPrize = `$${Number(prizePool).toLocaleString()}`;

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
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        padding: 64, // 32px * 2 from Figma
                    }}
                >
                    {/* Card Container - exact Figma specs (2x scale) */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                            width: 1014, // 461px * 2.2
                            height: 435, // 197.5px * 2.2
                            // Figma: linear-gradient(0deg, rgba(0,0,0,0.6)), linear-gradient(180deg, transparent 0%, #FFC931 100%)
                            background: "linear-gradient(0deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #FFC931 100%)",
                            border: "2.6px solid #FFC931", // 1.29px * 2, solid gold
                            borderRadius: 41, // 20.68px * 2
                        }}
                    >
                        {/* ─────────── Top Row: User avatar + name ─────────── */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 22, // 10px * 2.2
                                position: "absolute",
                                top: 63, // 28.77px * 2.2
                                left: 39, // 17.88px * 2.2
                            }}
                        >
                            {/* Avatar - 54x54 in Figma */}
                            <div
                                style={{
                                    width: 119, // 54px * 2.2
                                    height: 119,
                                    borderRadius: "50%",
                                    background: "#D9D9D9",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {safePfpUrl ? (
                                    <img
                                        src={safePfpUrl}
                                        alt="Avatar"
                                        width={119}
                                        height={119}
                                        style={{ objectFit: "cover" }}
                                    />
                                ) : (
                                    <span
                                        style={{
                                            fontFamily: "EditUndo",
                                            fontSize: 51, // 23px * 2.2
                                            color: COLORS.white,
                                        }}
                                    >
                                        {username[0]?.toUpperCase() ?? "•"}
                                    </span>
                                )}
                            </div>

                            {/* Username + subtitle */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "flex-start",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "EditUndo",
                                        fontSize: 51, // 23px * 2.2
                                        lineHeight: "130%",
                                        color: COLORS.white,
                                    }}
                                >
                                    {username.toUpperCase()}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "Brockmann",
                                        fontSize: 31, // 14px * 2.2
                                        lineHeight: "130%",
                                        letterSpacing: "-0.03em",
                                        color: COLORS.white,
                                        opacity: 0.6, // Figma: opacity 0.6
                                    }}
                                >
                                    has joined the next game
                                </span>
                            </div>
                        </div>

                        {/* ─────────── Bottom Row: Prize Pool + Theme ─────────── */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 34, // 15.51px * 2.2
                                position: "absolute",
                                top: 288, // 130.79px * 2.2
                                left: 42, // 19.16px * 2.2
                            }}
                        >
                            {/* Prize Pool */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 24, // 11.03px * 2.2
                                }}
                            >
                                <img
                                    src={moneyIcon}
                                    alt="Prize"
                                    width={77} // 35.22px * 2.2
                                    height={81} // 36.76px * 2.2
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "flex-start",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: "Brockmann",
                                            fontSize: 32, // 14.7045px * 2.2
                                            lineHeight: "130%",
                                            letterSpacing: "-0.03em",
                                            color: "#99A0AE", // Figma label color
                                        }}
                                    >
                                        Prize pool
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: "EditUndo",
                                            fontSize: 49, // 22.0567px * 2.2
                                            lineHeight: "100%",
                                            color: COLORS.white,
                                        }}
                                    >
                                        {formattedPrize}
                                    </span>
                                </div>
                            </div>

                            {/* Theme */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 24, // 11.03px * 2.2
                                }}
                            >
                                <img
                                    src={themeImageUrl}
                                    alt="Theme"
                                    width={83} // 37.63px * 2.2
                                    height={81} // 36.74px * 2.2
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "flex-start",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: "Brockmann",
                                            fontSize: 32, // 14.7045px * 2.2
                                            lineHeight: "130%",
                                            letterSpacing: "-0.03em",
                                            color: "#99A0AE", // Figma label color
                                        }}
                                    >
                                        Theme
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: "EditUndo",
                                            fontSize: 49, // 22.0567px * 2.2
                                            lineHeight: "100%",
                                            color: COLORS.white,
                                        }}
                                    >
                                        {theme.toUpperCase()}
                                    </span>
                                </div>
                            </div>
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
    } catch (error) {
        console.error("OG image generation error:", error);
        return new Response("Failed to generate image", { status: 500 });
    }
}
