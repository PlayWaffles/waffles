"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { speedTierMeta, type SpeedTier } from "@/lib/game/tension";

const optionColorThemes = ["gold", "purple", "cyan", "green"] as const;

const optionVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

interface QuestionOptionProps {
  option: string;
  index: number;
  selectedOptionIndex: number | null;
  onSelect: (index: number) => void;
  disabled: boolean;
  tremor?: number;
  speedTier?: SpeedTier | null;
  buttonWidth?: number;
}

export function QuestionOption({
  option,
  index,
  selectedOptionIndex,
  onSelect,
  disabled,
  tremor = 0,
  speedTier = null,
  buttonWidth = 296,
}: QuestionOptionProps) {
  const [isStamping, setIsStamping] = useState(false);

  const isSelected = selectedOptionIndex === index;
  const hasSelection = selectedOptionIndex !== null;
  const colorTheme = optionColorThemes[index % optionColorThemes.length];
  const fb = isSelected && speedTier ? speedTierMeta[speedTier] : null;

  const handleTap = () => {
    if (disabled || hasSelection) return;
    setIsStamping(true);
    setTimeout(() => {
      onSelect(index);
    }, 100);
  };

  // Slide unselected options away laterally
  const getExitX = () => {
    if (!hasSelection || isSelected || selectedOptionIndex === null) return 0;
    return index < selectedOptionIndex ? -120 : 120;
  };

  // Tremor when timer is low and no selection yet
  const tremorX =
    tremor > 0 && !hasSelection ? (Math.random() - 0.5) * tremor * 2 : 0;
  const tremorY =
    tremor > 0 && !hasSelection ? (Math.random() - 0.5) * tremor * 1.5 : 0;

  return (
    <motion.li
      className="mx-auto flex justify-center relative"
      style={{ zIndex: isSelected ? 10 : 1 }}
      variants={optionVariants}
      animate={{
        opacity: hasSelection && !isSelected ? 0 : 1,
        x: hasSelection && !isSelected ? getExitX() : tremorX,
        y: tremorY,
        scale: isStamping ? 0.93 : isSelected ? 1.08 : 1,
      }}
      transition={
        hasSelection && !isSelected
          ? {
              opacity: {
                duration: 0.25,
                delay:
                  Math.abs(index - (selectedOptionIndex ?? 0)) * 0.05,
              },
              x: {
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay:
                  Math.abs(index - (selectedOptionIndex ?? 0)) * 0.04,
              },
            }
          : isSelected
            ? { scale: { type: "spring", stiffness: 600, damping: 15 } }
            : {
                x: { duration: 0 },
                y: { duration: 0 },
                scale: { type: "spring", stiffness: 400, damping: 25 },
              }
      }
    >
      {/* Speed tag on the selected button */}
      <AnimatePresence>
        {isSelected && fb && (
          <motion.span
            className="absolute -top-2 -right-2 z-20 px-2 py-0.5 rounded-full font-display text-[9px] font-bold tracking-wider"
            style={{
              backgroundColor: fb.color,
              color: "#1E1E1E",
              boxShadow: `0 0 12px ${fb.color}80`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 15,
              delay: 0.3,
            }}
          >
            {fb.label}
          </motion.span>
        )}
      </AnimatePresence>

      <PixelButton
        aria-pressed={isSelected}
        tabIndex={-1}
        variant="filled"
        colorTheme={colorTheme}
        width={buttonWidth}
        height={53}
        fontSize={15}
        onClick={handleTap}
        disabled={disabled}
      >
        {option}
      </PixelButton>
    </motion.li>
  );
}
