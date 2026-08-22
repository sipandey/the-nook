"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

export function AppHeader({ variant = "light" }: { variant?: "light" | "dark" }) {
  const dark = variant === "dark";
  const fg = dark ? "text-inverse-on-surface" : "text-primary";
  return (
    <header
      className={`w-full sticky top-0 z-40 flex items-center justify-between px-container-padding h-16 shrink-0 ${
        dark ? "bg-inverse-surface" : "bg-background"
      }`}
    >
      <span className={`w-10 flex ${fg}`}>
        <MaterialIcon name="lock" filled size={20} />
      </span>
      <h1 className={`font-editorial-display text-title-md tracking-tight ${fg}`}>The Nook</h1>
      <Link href="/settings" aria-label="Settings" className={`w-10 flex justify-end ${fg}`}>
        <MaterialIcon name="settings" size={20} />
      </Link>
    </header>
  );
}
