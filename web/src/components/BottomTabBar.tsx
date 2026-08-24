"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/journal", label: "Journal", icon: "edit_note" },
  { href: "/playback", label: "Playback", icon: "play_circle" },
  { href: "/manifestations", label: "Manifest", icon: "auto_awesome" },
];

/**
 * Shared bottom nav — every screen in the (app) group uses this, including
 * Playback (light and dark "Cinematic Night Mode" states via `variant`).
 * Previously Playback kept its own inline copy of this nav, which drifted
 * from this component: a different active-tab color (peach/secondary here
 * vs. green/primary there), different label casing, different icon/label
 * spacing. Unified on this component's styling — green active state
 * throughout, per design direction — so there's one definition, not three.
 */
export function BottomTabBar({ variant = "light" }: { variant?: "light" | "dark" }) {
  const pathname = usePathname();
  const dark = variant === "dark";

  return (
    <nav
      className={`md:hidden fixed bottom-0 w-full z-50 rounded-t-xl flex justify-around items-center px-gutter py-stack-loose pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.04)] ${
        dark ? "bg-inverse-surface/90 backdrop-blur-md" : "bg-surface-container-lowest"
      }`}
    >
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center transition-transform duration-300 active:scale-90 ${
              active
                ? "bg-primary-container text-on-primary-container rounded-full px-4 py-1"
                : dark
                  ? "text-inverse-on-surface/70 hover:text-inverse-primary p-2"
                  : "text-secondary hover:bg-surface-container-low p-2 rounded-lg"
            }`}
          >
            <MaterialIcon name={tab.icon} filled={active} className="mb-1" />
            <span className="font-editorial-sans text-label-sm">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
