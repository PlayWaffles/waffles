import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Renders the primary Waffles logo image.
 * Acts as a simple wrapper around the next/image component.
 * Accepts standard div props like className for flexible styling.
 */
export default function Logo({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative w-[40px] h-[40px]", className)} {...props}>
      <Image
        src="/logo.webp"
        alt="Waffles Logo"
        fill
        sizes="40px"
        priority
        className="object-contain"
      />
    </div>
  );
}
