"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

/**
 * Header/footer for the small set of public, pre-auth pages (About,
 * Privacy, Encryption explainer, Delete My Data) — see src/proxy.ts's
 * isPublicRoute for the matching auth bypass. Deliberately separate from
 * AppHeader: that component assumes a signed-in visitor (it links to
 * Settings, and its lock icon implies "your journal is encrypted" in the
 * first person) — these pages are reachable by people who haven't signed
 * up yet, so the header offers a way *to* sign in rather than a settings
 * link, and the copy stays in third person ("your entries," not "your
 * journal is currently unlocked").
 */
export function PublicPageHeader() {
  return (
    <header className="w-full sticky top-0 z-40 flex items-center justify-between px-container-padding h-16 shrink-0 bg-background border-b border-outline-variant/20">
      <Link href="/about" className="flex items-center gap-2 text-primary">
        <MaterialIcon name="eco" filled size={20} />
        <span className="font-editorial-display text-title-md">The Nook</span>
      </Link>
      <Link
        href="/sign-in"
        className="text-label-sm text-primary border border-primary/40 rounded-full px-4 py-1.5 hover:bg-primary-container hover:text-on-primary-container transition-colors"
      >
        Sign in
      </Link>
    </header>
  );
}

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/encryption", label: "How we encrypt" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/delete-my-data", label: "Delete my data" },
];

export function PublicPageFooter() {
  return (
    <footer className="w-full px-container-padding py-stack-gap border-t border-outline-variant/20 mt-auto">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 max-w-3xl mx-auto">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-label-sm text-outline hover:text-primary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="text-center text-label-sm text-outline-variant mt-4">The Nook</p>
    </footer>
  );
}
