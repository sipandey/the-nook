"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/write", label: "Journal", icon: "edit_note" },
  { href: "/playback", label: "Playback", icon: "play_circle" },
  { href: "/manifestations", label: "Manifest", icon: "auto_awesome" },
];

/**
 * Editorial-style bottom nav — see the note in layout.tsx. Used by every
 * screen rebuilt to the new visual system (Home, Write, Manifestations,
 * Settings). The Playback hub/story screens are "Cinematic Night Mode" and
 * render their own dark-themed nav inline rather than using this component.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl bg-surface-container-lowest flex justify-around items-center px-gutter py-stack-loose pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center transition-transform duration-300 active:scale-90 ${
              active
                ? "text-primary bg-secondary-container rounded-full px-4 py-1"
                : "text-secondary p-2 rounded-lg hover:bg-surface-container-low"
            }`}
          >
            <MaterialIcon name={tab.icon} filled={active} className="mb-1" />
            <span className="font-editorial-sans text-label-caps uppercase tracking-wider">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
