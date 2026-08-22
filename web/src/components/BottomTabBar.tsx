"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9.5L10 3l7 6.5" />
        <path d="M5 8.5V17h10V8.5" />
      </svg>
    ),
  },
  {
    href: "/journal",
    label: "Journal",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 3.5h9a2 2 0 0 1 2 2V17H6a2 2 0 0 1-2-2V3.5z" />
        <path d="M4 3.5a2 2 0 0 0-2 2V15a2 2 0 0 0 2 2" />
      </svg>
    ),
  },
  {
    href: "/playback",
    label: "Playback",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="7.5" />
        <path d="M8.5 7.2 13 10l-4.5 2.8V7.2z" />
      </svg>
    ),
  },
  {
    href: "/manifestations",
    label: "Manifest",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 17S3 12.5 3 7.8A3.8 3.8 0 0 1 10 5.5 3.8 3.8 0 0 1 17 7.8C17 12.5 10 17 10 17z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.4 4.6l-1.4 1.4M6 12.6l-1.4 1.4M15.4 15.4l-1.4-1.4M6 7.4 4.6 6" />
      </svg>
    ),
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-shrink-0 items-center justify-around border-t border-border bg-background py-2">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[9px] ${
              active ? "text-accent" : "text-muted"
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
