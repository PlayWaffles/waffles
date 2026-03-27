"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { notify } from "@/components/ui/Toaster";
import { env } from "@/lib/env";
import { shareTextOrCopy } from "@/lib/share";

interface SuccessViewProps {
    gameId: string;
    displayUsername: string;
    displayAvatar?: string;
    prizePool: number;
    theme: string;
    themeIcon?: string;
    onClose: () => void;
}

export function SuccessView({
    gameId,
    displayUsername,
    displayAvatar,
    prizePool,
    theme,
    themeIcon,
    onClose,
}: SuccessViewProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [showButtons, setShowButtons] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    // Share handler
    const handleShare = useCallback(async () => {
        if (isSharing) return;
        setIsSharing(true);

        try {
            const result = await shareTextOrCopy({
                title: "Waffles",
                text: `I just joined the next Waffles game! Theme: ${theme}. Prize Pool: $${prizePool.toLocaleString()}.`,
                url: `${env.rootUrl}/game/${gameId}`,
            });

            if (result.shared || result.copied) {
                notify.success(result.shared ? "Shared!" : "Invite link copied!");
            }
        } catch (error) {
            console.error("Share error:", error);
            notify.error("Failed to share");
        } finally {
            setIsSharing(false);
        }
    }, [theme, prizePool, isSharing, gameId]);

    // Staggered entrance animations
    useEffect(() => {
        const timer1 = setTimeout(() => setIsVisible(true), 50);
        const timer2 = setTimeout(() => setShowCard(true), 300);
        const timer3 = setTimeout(() => setShowButtons(true), 500);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    return (
        <div
            className="flex flex-col items-center w-full"
            style={{
                gap: "13px",
                paddingTop: "12px",
            }}
        >
            {/* Title Section */}
            <div
                className="flex flex-col justify-center items-start w-full"
                style={{
                    padding: "2px 0",
                    gap: "8px",
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateY(0) scale(1)" : "translateY(-20px) scale(0.9)",
                    transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
            >
                <h2
                    className="font-body text-white text-center w-full"
                    style={{
                        fontSize: "22px",
                        lineHeight: "92%",
                        letterSpacing: "-0.03em",
                        animation: isVisible ? "pulse-glow 2s ease-in-out infinite" : "none",
                    }}
                >
                    WAFFLE SECURED!
                </h2>
                <p
                    className="font-display text-center w-full"
                    style={{
                        fontSize: "16px",
                        lineHeight: "130%",
                        letterSpacing: "-0.03em",
                        color: "#99A0AE",
                    }}
                >
                    You&apos;re in!
                </p>
            </div>

            {/* Info Card with Golden Border */}
            <div
                className="w-full max-w-[361px] relative"
                style={{
                    height: "151px",
                    background:
                        "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 201, 49, 0.12) 100%)",
                    border: "1px solid rgba(255, 201, 49, 0.4)",
                    borderRadius: "16px",
                    opacity: showCard ? 1 : 0,
                    transform: showCard ? "translateY(0) scale(1)" : "translateY(30px) scale(0.95)",
                    transition: "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    boxShadow: showCard ? "0 0 30px rgba(255, 201, 49, 0.15)" : "none",
                }}
            >
                {/* Shimmer effect overlay */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "16px",
                        overflow: "hidden",
                        pointerEvents: "none",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: "-100%",
                            width: "100%",
                            height: "100%",
                            background:
                                "linear-gradient(90deg, transparent, rgba(255, 201, 49, 0.1), transparent)",
                            animation: showCard ? "shimmer 3s ease-in-out infinite" : "none",
                        }}
                    />
                </div>

                {/* User Info Row */}
                <div
                    className="flex items-center absolute"
                    style={{
                        top: "16px",
                        left: "14px",
                        gap: "10px",
                    }}
                >
                    {/* Avatar */}
                    <div>
                        {displayAvatar ? (
                            <Image
                                src={displayAvatar}
                                alt="avatar"
                                width={54}
                                height={54}
                                className="rounded-full"
                                style={{ background: "#D9D9D9" }}
                            />
                        ) : (
                            <div
                                className="rounded-full"
                                style={{
                                    width: "54px",
                                    height: "54px",
                                    background: "#D9D9D9",
                                }}
                            />
                        )}
                    </div>
                    {/* Username + Joined Text */}
                    <div
                        className="flex flex-col justify-center items-start"
                        style={{ gap: "0px" }}
                    >
                        <span
                            className="font-body text-white"
                            style={{
                                fontSize: "23px",
                                lineHeight: "130%",
                            }}
                        >
                            {displayUsername.toUpperCase()}
                        </span>
                        <span
                            className="font-display"
                            style={{
                                fontSize: "14px",
                                lineHeight: "130%",
                                letterSpacing: "-0.03em",
                                color: "#99A0AE",
                            }}
                        >
                            has joined the next game
                        </span>
                    </div>
                </div>

                {/* Prize Pool + Theme Row */}
                <div
                    className="flex items-center absolute"
                    style={{
                        bottom: "19px",
                        left: "15px",
                        gap: "12px",
                    }}
                >
                    {/* Prize Pool */}
                    <div className="flex items-center" style={{ gap: "8.53px" }}>
                        <Image
                            src="/images/illustrations/money-stack.svg"
                            alt="prize pool"
                            width={27}
                            height={28}
                            className="object-contain"
                            style={{
                                animation: showCard ? "bounce-subtle 2s ease-in-out infinite" : "none",
                            }}
                        />
                        <div
                            className="flex flex-col justify-center items-start"
                            style={{ gap: "0px" }}
                        >
                            <span
                                className="font-display"
                                style={{
                                    fontSize: "11.38px",
                                    lineHeight: "130%",
                                    letterSpacing: "-0.03em",
                                    color: "#99A0AE",
                                }}
                            >
                                Prize pool
                            </span>
                            <span
                                className="font-body text-white"
                                style={{
                                    fontSize: "17.07px",
                                    lineHeight: "100%",
                                }}
                            >
                                ${prizePool.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Theme */}
                    <div className="flex items-center" style={{ gap: "8.53px" }}>
                        {themeIcon && (
                            <Image
                                src={themeIcon}
                                alt={theme}
                                width={29}
                                height={28}
                                className="object-contain"
                                style={{
                                    animation: showCard ? "bounce-subtle 2s ease-in-out infinite 0.3s" : "none",
                                }}
                            />
                        )}
                        <div
                            className="flex flex-col justify-center items-start"
                            style={{ gap: "0px" }}
                        >
                            <span
                                className="font-display"
                                style={{
                                    fontSize: "11.38px",
                                    lineHeight: "130%",
                                    letterSpacing: "-0.03em",
                                    color: "#99A0AE",
                                }}
                            >
                                Theme
                            </span>
                            <span
                                className="font-body text-white"
                                style={{
                                    fontSize: "17.07px",
                                    lineHeight: "100%",
                                }}
                            >
                                {theme.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buttons Section */}
            <div
                className="flex flex-col items-start w-full max-w-[361px]"
                style={{
                    gap: "5px",
                    opacity: showButtons ? 1 : 0,
                    transform: showButtons ? "translateY(0)" : "translateY(20px)",
                    transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
            >
                {/* Share Ticket Button */}
                <button
                    className="flex flex-col items-start w-full group"
                    style={{
                        padding: "12px",
                        background: "#FFFFFF",
                        borderWidth: "0px 5px 5px 0px",
                        borderStyle: "solid",
                        borderColor: "#FFC931",
                        borderRadius: "12px",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(255, 201, 49, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                    }}
                    onMouseDown={(e) => {
                        e.currentTarget.style.transform = "translateY(0) scale(0.98)";
                    }}
                    onMouseUp={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px) scale(1)";
                    }}
                    disabled={isSharing}
                    onClick={handleShare}
                >
                    <span
                        className="font-body text-center w-full"
                        style={{
                            fontSize: "26px",
                            lineHeight: "115%",
                            letterSpacing: "-0.02em",
                            color: "#EFB20A",
                        }}
                    >
                        SHARE TICKET
                    </span>
                </button>

                {/* Back to Home Link */}
                <button
                    className="flex justify-center items-center w-full"
                    style={{
                        padding: "12px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "12px",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0, 207, 242, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                    }}
                    onMouseDown={(e) => {
                        e.currentTarget.style.transform = "scale(0.98)";
                    }}
                    onMouseUp={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                    }}
                    onClick={onClose}
                >
                    <span
                        className="font-body"
                        style={{
                            fontSize: "18px",
                            lineHeight: "115%",
                            letterSpacing: "-0.02em",
                            color: "#00CFF2",
                            transition: "all 0.2s ease",
                        }}
                    >
                        BACK TO HOME
                    </span>
                </button>
            </div>

            {/* Keyframe animations */}
            <style jsx>{`
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          50%,
          100% {
            left: 100%;
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            text-shadow: 0 0 10px rgba(255, 201, 49, 0.3);
          }
          50% {
            text-shadow: 0 0 20px rgba(255, 201, 49, 0.6);
          }
        }
        @keyframes bounce-subtle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
        </div>
    );
}
