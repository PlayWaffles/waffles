"use client";

import { ButtonHTMLAttributes, JSX, ReactNode, useState } from "react";

// Color theme configurations
const colorThemes = {
    gold: {
        border: "#FFC931",
        borderHover: "#FFE066",
        edge: "#F5EEDB",
        edgeHover: "#FFF6E0",
        fill: "#FFEDD4",
        fillHover: "#FFFAEB",
        text: "#1E1E1E",
        outlineText: "#FFD972",
    },
    purple: {
        border: "#B01BF5",
        borderHover: "#C644FF",
        edge: "#EDDBF5",
        edgeHover: "#F5E8FF",
        fill: "#F1D4FF",
        fillHover: "#F8E6FF",
        text: "#1E1E1E",
        outlineText: "#D88FFF",
    },
    cyan: {
        border: "#1B8FF5",
        borderHover: "#4DA8F7",
        edge: "#DBE9F5",
        edgeHover: "#E8F2FC",
        fill: "#D4EBFF",
        fillHover: "#E6F3FF",
        text: "#1E1E1E",
        outlineText: "#8DC4F8",
    },
    green: {
        border: "#4CAF50",
        borderHover: "#81C784",
        edge: "#E0F2E1",
        edgeHover: "#ECFAED",
        fill: "#D4F5D6",
        fillHover: "#E6FAE8",
        text: "#1E1E1E",
        outlineText: "#A5D6A7",
    },
} as const;

type ColorTheme = keyof typeof colorThemes;

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: "outline" | "filled";
    /** Color theme for the button */
    colorTheme?: ColorTheme;
    /** Custom width in pixels (must be divisible by 4) */
    width?: number;
    /** Custom height in pixels (must be divisible by 4) */
    height?: number;
    /** Font size in pixels */
    fontSize?: number;
}

/**
 * Reusable pixel-art style button with 4x4 pixel block border
 * - outline: hollow with colored border only
 * - filled: colored interior with border
 * 
 * Usage:
 * - Default gold: <PixelButton variant="filled">Text</PixelButton>
 * - Purple theme: <PixelButton colorTheme="purple" variant="filled">Text</PixelButton>
 * - Custom size: <PixelButton width={296} height={48}>Text</PixelButton>
 */
export function PixelButton({
    children,
    variant = "outline",
    colorTheme = "gold",
    width = 164,
    height = 40,
    fontSize = 14,
    className = "",
    ...props
}: PixelButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    const PIXEL = 4;
    const theme = colorThemes[colorTheme];

    // Colors with hover states
    const BORDER = isHovered ? theme.borderHover : theme.border;
    const FILL = isHovered ? theme.fillHover : theme.fill;
    const EDGE = isHovered ? theme.edgeHover : theme.edge;

    // Calculate grid dimensions
    const cols = Math.floor(width / PIXEL);
    const rows = Math.floor(height / PIXEL);

    // Generate pixel rows
    const renderPixelGrid = () => {
        const elements: JSX.Element[] = [];

        for (let row = 0; row < rows; row++) {
            const y = row * PIXEL;
            const isTopRow = row === 0;
            const isBottomRow = row === rows - 1;
            const isSecondRow = row === 1;
            const isSecondLastRow = row === rows - 2;
            const isMiddleRow = row >= 2 && row <= rows - 3;

            if (isTopRow || isBottomRow) {
                // Top/bottom border rows - inset by 2 pixels on each side
                for (let col = 2; col < cols - 2; col++) {
                    elements.push(
                        <rect
                            key={`${row}-${col}`}
                            x={col * PIXEL}
                            y={y}
                            width={PIXEL}
                            height={PIXEL}
                            fill={BORDER}
                        />
                    );
                }
            } else if (isSecondRow || isSecondLastRow) {
                // Second/second-last rows - corners + optional fill
                elements.push(
                    <rect key={`${row}-left`} x={PIXEL} y={y} width={PIXEL} height={PIXEL} fill={BORDER} />
                );
                if (variant === "filled") {
                    for (let col = 2; col < cols - 2; col++) {
                        elements.push(
                            <rect
                                key={`${row}-${col}`}
                                x={col * PIXEL}
                                y={y}
                                width={PIXEL}
                                height={PIXEL}
                                fill={EDGE}
                            />
                        );
                    }
                }
                elements.push(
                    <rect key={`${row}-right`} x={(cols - 2) * PIXEL} y={y} width={PIXEL} height={PIXEL} fill={BORDER} />
                );
            } else if (isMiddleRow) {
                // Middle rows - left/right borders + fill
                elements.push(
                    <rect key={`${row}-left`} x={0} y={y} width={PIXEL} height={PIXEL} fill={BORDER} />
                );
                if (variant === "filled") {
                    // Left edge
                    elements.push(
                        <rect key={`${row}-ledge`} x={PIXEL} y={y} width={PIXEL} height={PIXEL} fill={EDGE} />
                    );
                    // Inner fill
                    for (let col = 2; col < cols - 2; col++) {
                        elements.push(
                            <rect
                                key={`${row}-${col}`}
                                x={col * PIXEL}
                                y={y}
                                width={PIXEL}
                                height={PIXEL}
                                fill={FILL}
                            />
                        );
                    }
                    // Right edge
                    elements.push(
                        <rect key={`${row}-redge`} x={(cols - 2) * PIXEL} y={y} width={PIXEL} height={PIXEL} fill={EDGE} />
                    );
                }
                elements.push(
                    <rect key={`${row}-right`} x={(cols - 1) * PIXEL} y={y} width={PIXEL} height={PIXEL} fill={BORDER} />
                );
            }
        }

        return elements;
    };

    return (
        <button
            className={`relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e] ${className}`}
            style={{
                width: `${width}px`,
                height: `${height}px`,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: props.disabled ? "not-allowed" : "pointer",
                opacity: props.disabled ? 0.6 : 1,
                transform: isPressed ? "scale(0.96)" : isHovered ? "scale(1.02)" : "scale(1)",
                transition: "transform 0.15s ease, filter 0.15s ease",
                filter: isHovered ? "brightness(1.05)" : "brightness(1)",
                borderRadius: "4px",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsPressed(false);
            }}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
            {...props}
        >
            {/* Glow effect on hover */}
            {isHovered && (
                <div
                    style={{
                        position: "absolute",
                        inset: "-4px",
                        background: variant === "filled"
                            ? `radial-gradient(ellipse, ${theme.border}4D 0%, transparent 70%)`
                            : `radial-gradient(ellipse, ${theme.border}26 0%, transparent 70%)`,
                        borderRadius: "8px",
                        pointerEvents: "none",
                        transition: "opacity 0.2s ease",
                    }}
                />
            )}

            {/* Pixel grid */}
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    pointerEvents: "none",
                    transition: "filter 0.15s ease",
                }}
            >
                {renderPixelGrid()}
            </svg>

            {/* Text */}
            <span
                className="relative z-10 font-display text-center"
                style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: 500,
                    lineHeight: "115%",
                    color: variant === "outline" ? theme.outlineText : theme.text,
                    transition: "color 0.15s ease",
                    textShadow: isHovered && variant === "outline" ? `0 0 8px ${theme.outlineText}80` : "none",
                }}
            >
                {children}
            </span>
        </button>
    );
}
