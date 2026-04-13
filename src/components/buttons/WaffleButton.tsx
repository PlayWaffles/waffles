"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { springs, tapBounce, hoverLift } from "@/lib/animations";
import { playSound } from "@/lib/sounds";

interface WaffleButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const WaffleButton = React.forwardRef<
  HTMLButtonElement,
  WaffleButtonProps
>(
  (
    {
      children,
      className,
      type = "button",
      onClick,
      disabled,
      ...props
    },
    ref
  ) => {
    // Wrap onClick to play click sound
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled) {
          playSound("click");
        }
        onClick?.(e);
      },
      [onClick, disabled]
    );

    return (
      <motion.button
        ref={ref}
        type={type as "button" | "submit" | "reset"}
        whileHover={disabled ? undefined : hoverLift}
        whileTap={disabled ? undefined : tapBounce}
        transition={springs.snappy}
        className={cn(
          "relative flex items-center justify-center h-[54px] px-6",
          "bg-white text-[#191919]",
          "font-body font-normal uppercase tracking-[-0.02em] text-center text-[26px] leading-[115%] align-bottom",
          "w-full",
          "max-w-[361px] mx-auto",
          "rounded-[12px]",
          "border-[5px] border-t-0 border-l-0 border-(--brand-cyan)",
          "transition-colors", // Removed transform transition as motion handles it
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]",
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

WaffleButton.displayName = "WaffleButton";
