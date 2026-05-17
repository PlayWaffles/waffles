"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

interface WaffleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
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
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative flex items-center justify-center h-[54px] px-6",
          "bg-white text-[#191919]",
          "font-body font-normal uppercase tracking-[-0.02em] text-center text-[26px] leading-[115%] align-bottom",
          "w-full",
          "max-w-[361px] mx-auto",
          "rounded-[12px]",
          "border-[5px] border-t-0 border-l-0 border-(--brand-cyan)",
          "transition-[background-color,color,transform] duration-150 ease-out",
          "hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.98]",
          "disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]",
          className
        )}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

WaffleButton.displayName = "WaffleButton";
