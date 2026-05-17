/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { OG_WIDTH, OG_HEIGHT, safeImageUrl } from "../utils";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/**
 * Prize Share OG Image
 * 
 * Displays prize winnings for winners to share.
 * Matches Figma "Outside farcaster" design.
 * 
 * Params:
 * - prizeAmount: number (required) - Prize amount in USD
 * - pfpUrl: string (optional) - Profile picture URL
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Parse params
    const prizeAmount = parseInt(searchParams.get("prizeAmount") || "0", 10);
    const pfpUrlParam = searchParams.get("pfpUrl");

    // Load assets from filesystem
    const publicDir = join(process.cwd(), "public");
    const [fontData, logoBuffer, chestBuffer, bgBuffer, safePfpUrl] = await Promise.all([
        readFile(join(publicDir, "fonts/editundo_bd.ttf")),
        readFile(join(publicDir, "logo-onboarding.png")),
        readFile(join(publicDir, "images/illustrations/treasure-chest.webp")),
        readFile(join(publicDir, "images/share/bg.webp")),
        safeImageUrl(pfpUrlParam),
    ]);

    // Convert to base64
    const logoImage = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    const chestImage = `data:image/png;base64,${chestBuffer.toString("base64")}`;
    const bgImage = `data:image/png;base64,${bgBuffer.toString("base64")}`;

    // Format prize display
    const displayValue = `$${prizeAmount.toLocaleString()}`;

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
                    // Figma: bg image with dark gradient overlay
                    backgroundImage: `linear-gradient(180deg, rgba(30, 30, 30, 0.51) 0%, rgba(0, 0, 0, 0.51) 100%), url(${bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    fontFamily: "EditUndo",
                    textAlign: "center",
                    position: "relative",
                }}
            >
                {/* Golden glow effect - centered behind content */}
                {/* <div
                    style={{
                        position: "absolute",
                        width: 320, // 159.23px * 2
                        height: 340, // 169.5px * 2
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -30%)",
                        background: "#FFC931",
                        opacity: 0.67,
                        filter: "blur(170px)", // 85px * 2
                        borderRadius: "50%",
                    }}
                /> */}

                {/* Main content container */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4, // 2px * 2
                        zIndex: 1,
                    }}
                >
                    {/* PFP + "just won" row */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        {/* Profile Picture */}
                        {safePfpUrl && (
                            <img
                                src={safePfpUrl}
                                alt="Profile"
                                width={43} // 21.48px * 2
                                height={43}
                                style={{
                                    borderRadius: "50%",
                                }}
                            />
                        )}

                        {/* "just won" text */}
                        <span
                            style={{
                                fontSize: 64, // 32px * 2
                                color: "#FFFFFF",
                                letterSpacing: "-0.03em",
                                lineHeight: "92%",
                            }}
                        >
                            just won
                        </span>
                    </div>

                    {/* Prize Amount - Large green text */}
                    <span
                        style={{
                            fontSize: 94, // 47.16px * 2
                            color: "#05FF8F",
                            lineHeight: "92%",
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {displayValue}
                    </span>

                    {/* "on waffles" */}
                    <span
                        style={{
                            fontSize: 40, // 20px * 2
                            color: "#FFFFFF",
                            letterSpacing: "-0.03em",
                            lineHeight: "92%",
                        }}
                    >
                        on waffles
                    </span>
                </div>

                {/* Treasure Chest - below text */}
                <img
                    src={chestImage}
                    alt="Treasure"
                    width={416} // 208px * 2
                    height={387} // 193.62px * 2
                    style={{
                        objectFit: "contain",
                        marginTop: 16,
                        zIndex: 1,
                    }}
                />

                {/* Footer: Waffles logo + PLAYWAFFLES.FUN badge */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        position: "absolute",
                        bottom: 40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 678, // 339px * 2
                        gap: 406, // 203px * 2
                    }}
                >
                    {/* Waffles Logo */}
                    <img
                        src={logoImage}
                        alt="Waffles"
                        width={91} // ~45.33px * 2
                        height={16}
                    />

                    {/* PLAYWAFFLES.FUN badge */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: "8px 12px",
                            border: "2px solid #F5BB1B",
                            borderRadius: 1679, // 839.493px * 2
                        }}
                    >
                        <span
                            style={{
                                fontSize: 16, // 8px * 2
                                color: "#F5BB1B",
                                lineHeight: "115%",
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
            ],
        }
    );
}
