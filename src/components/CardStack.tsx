"use client";

import { useMemo, useRef, type PointerEventHandler } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardStackProps {
  size?: number | string;
  borderColor?: string;
  rotations?: number[];
  interactive?: boolean;
  maxCards?: number;
  ariaLabel?: string;
  className?: string;
  imageUrls?: string[];
}

const DEFAULT_ROTATIONS = [-8.71, 5.85, -3.57, 7.56];

export function CardStack({
  size = "clamp(21px, 6vw, 48px)",
  borderColor = "#FFFFFF",
  rotations = DEFAULT_ROTATIONS,
  interactive = false,
  maxCards = 4,
  ariaLabel = "Image card stack",
  className,
  imageUrls,
}: CardStackProps) {
  const defaultAvatars = useMemo(() => {
    return [
      "/images/avatars/a.webp",
      "/images/avatars/b.webp",
      "/images/avatars/c.webp",
      "/images/avatars/d.webp",
    ];
  }, []);

  const spotsAvatars = useMemo(() => {
    // Use provided imageUrls if available, otherwise fallback to default
    if (imageUrls && imageUrls.length > 0) {
      return imageUrls;
    }
    return defaultAvatars;
  }, [imageUrls, defaultAvatars]);
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-100, 100], [-4, 4]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    x.set(e.clientX - (rect.left + rect.width / 2));
  };

  const handleLeave = () => {
    if (interactive) {
      x.set(0);
    }
  };
  const cardsToDisplay = useMemo(
    () => spotsAvatars.slice(0, maxCards),
    [spotsAvatars, maxCards]
  );


  const cardSize = typeof size === "number" ? size : null;
  const cardSizeStr = typeof size === "number" ? `${size}px` : size;
  const offsetFactor = 0.4;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <motion.div
        ref={containerRef}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        aria-label={ariaLabel}
        className="relative"
        style={{
          height: cardSizeStr,
          width: `calc(${cardSizeStr} + (${cardsToDisplay.length - 1} * ${cardSizeStr} * ${offsetFactor}))`,
        }}
      >
        {cardsToDisplay.map((img, i) => {
          const staticRotation = rotations[i % rotations.length] ?? 0;
          const imageUrl = spotsAvatars[i];

          return (
            <motion.div
              key={`${imageUrl}-${i}`}
              style={{
                position: "absolute",
                top: 0,
                left: `calc(${i} * ${cardSizeStr} * ${offsetFactor})`,
                width: cardSizeStr,
                height: cardSizeStr,
                borderColor: borderColor,
                borderWidth: "3.01px",
                borderRadius: "6.02px",
                rotate: interactive ? 0 : `${staticRotation}deg`,
                zIndex: 10 + i,
              }}
              className="shrink-0 bg-muted overflow-hidden"
              whileHover={interactive ? { y: -3, scale: 1.02 } : undefined}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <motion.div
                style={{
                  width: "100%",
                  height: "100%",
                  rotate: interactive ? tilt : 0,
                }}
                className="w-full h-full"
              >
                <img
                  src={imageUrl}
                  alt={`Card ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
