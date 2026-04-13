"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/animations";

const navItems = [
  { id: "home", label: "Lobby", href: "/game" },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
  { id: "profile", label: "Profile", href: "/profile" },
];

// ============================================
// ANIMATED SVG ICONS with inner path animations
// ============================================

function AnimatedHomeIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg width={25} height={24} viewBox="0 0 25 24" fill="none" className="h-5 w-5">
      {/* Roof triangle area - bounces */}
      <motion.path
        d="M14.58 2H10.58V4H8.58V6H6.58V8H4.58V10H2.58V12H4.58V10H6.58V8H8.58V6H10.58V4H14.58V6H16.58V8H18.58V10H20.58V12H22.58V10H20.58V8H18.58V6H16.58V4H14.58V2Z"
        fill="currentColor"
        animate={isActive ? { y: [0, -2, 0] } : { y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
      />
      {/* House body - scales from bottom */}
      <motion.path
        d="M4.58 12V22H11.58V16H13.58V22H20.58V12H18.58V20H15.58V14H9.58V20H6.58V12H4.58Z"
        fill="currentColor"
        animate={isActive ? { scaleY: [1, 1.05, 1] } : { scaleY: 1 }}
        transition={{ duration: 0.25, delay: 0.1, ease: "easeOut" as const }}
        style={{ transformOrigin: "center bottom" }}
      />
      {/* Door - pulses when active */}
      <motion.rect
        x="11"
        y="16"
        width="3"
        height="4"
        fill="currentColor"
        animate={isActive ? { opacity: [1, 0.5, 1] } : { opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2, ease: "easeInOut" as const }}
      />
    </svg>
  );
}

function AnimatedLeaderboardIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg width={25} height={24} viewBox="0 0 25 24" fill="none" className="h-5 w-5">
      {/* Top arrow - slides right */}
      <motion.path
        d="M12.5 1H14.5V9H22.5V13H20.5V11H12.5V5H10.5V3H12.5V1ZM8.5 7V5H10.5V7H8.5ZM6.5 9V7H8.5V9H6.5ZM4.5 11V9H6.5V11H4.5Z"
        fill="currentColor"
        animate={isActive ? { x: [0, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" as const }}
      />
      {/* Bottom arrow - slides left */}
      <motion.path
        d="M14.5 19V21H12.5V23H10.5V15H2.5V11H4.5V13H12.5V19H14.5ZM16.5 17V19H14.5V17H16.5ZM18.5 15V17H16.5V15H18.5ZM18.5 15H20.5V13H18.5V15Z"
        fill="currentColor"
        animate={isActive ? { x: [0, -3, 0] } : { x: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeInOut" as const }}
      />
    </svg>
  );
}

function AnimatedProfileIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg width={25} height={24} viewBox="0 0 25 24" fill="none" className="h-5 w-5">
      {/* Frame - subtle pulse */}
      <motion.path
        d="M3.41998 3H21.42V21H3.41998V3ZM19.42 19V5H5.41998V19H19.42Z"
        fill="currentColor"
        animate={isActive ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" as const }}
        style={{ transformOrigin: "center" }}
      />
      {/* Face - wiggles */}
      <motion.path
        d="M14.42 7H10.42V11H14.42V7Z"
        fill="currentColor"
        animate={isActive ? { rotate: [0, -5, 5, -3, 3, 0] } : { rotate: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" as const }}
        style={{ transformOrigin: "center" }}
      />
      {/* Body - bounces */}
      <motion.path
        d="M15.42 13H9.41998V15H7.41998V17H9.41998V15H15.42V17H17.42V15H15.42V13Z"
        fill="currentColor"
        animate={isActive ? { y: [0, -2, 0] } : { y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" as const }}
      />
    </svg>
  );
}

// ============================================
// NAV ITEM COMPONENT
// ============================================

interface NavItemProps {
  item: typeof navItems[0];
  isActive: boolean;
}

function NavItem({ item, isActive }: NavItemProps) {
  const IconComponent =
    item.id === "home"
      ? AnimatedHomeIcon
      : item.id === "leaderboard"
        ? AnimatedLeaderboardIcon
        : AnimatedProfileIcon;

  return (
    <Link
      href={item.href}
      className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-3 landscape:py-1.5 landscape:gap-0.5"
      role="tab"
      aria-selected={isActive}
      aria-label={item.label}
    >
      {/* Icon - glows when active */}
      <motion.div
        className={isActive ? "text-primary" : "text-muted-foreground"}
        whileHover={!isActive ? { scale: 1.15, y: -2 } : undefined}
        whileTap={{ scale: 0.9 }}
        transition={springs.snappy}
      >
        <IconComponent isActive={isActive} />
      </motion.div>
      {/* Label */}
      <motion.span
        className={cn(
          "text-xs font-medium font-display landscape:text-[10px]",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
        animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" as const }}
      >
        {item.label}
      </motion.span>
    </Link>
  );
}

// ============================================
// BOTTOM NAV
// ============================================

export function BottomNav() {
  const pathname = usePathname();

  return (
    <footer
      className={cn(
        "border-t-2 border-border",
        "bg-card",
        "shrink-0",
        "w-full"
      )}
    >
      <nav className="flex items-stretch justify-around w-full">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return <NavItem key={item.href} item={item} isActive={isActive} />;
        })}
      </nav>
    </footer>
  );
}
