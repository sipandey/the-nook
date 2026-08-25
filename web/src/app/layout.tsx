import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader, Hanken_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Editorial type system (Newsreader + Hanken Grotesk) — added alongside
 * the existing Geist default, not replacing it. Scoped intentionally: only
 * the screens rebuilt to the new "editorial" visual direction (see
 * docs/UX_DESIGN_BRIEF.md) opt into these via the font-editorial-display /
 * font-editorial-sans utilities in globals.css. Every other screen keeps
 * the original Geist look until it's deliberately redone — this is a
 * transitional state, not a finished rebrand.
 *
 * Was Playfair Display + Public Sans (black-primary "Nook Design System")
 * until the sage/terracotta "Sanctuary" system replaced it project-wide —
 * see the design-system-migration decision in .agent-room/decisions.md.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
});

/**
 * Material Symbols — self-hosted and subsetted, not loaded from Google's
 * CSS API. That API served a synchronous, cross-origin, render-blocking
 * `<link rel="stylesheet">` on every page (a real, measured cause of a
 * production mobile FCP/LCP of ~7s — see docs/ROADMAP.md NK-20) — and it
 * shipped the *entire* Material Symbols family, ~3.96MB, for the ~77
 * icons this app actually uses. `next/font/local` fixes both at once:
 * self-hosted means no extra origin to connect to, and the font file
 * itself is a `--unicodes=`-subsetted 66KB (see
 * src/lib/materialSymbolsCodepoints.ts for why codepoint subsetting, not
 * the usual ligature-text approach, was necessary to actually shrink it).
 */
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined-subset.woff2",
  variable: "--font-material-symbols",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Nook",
  description: "A quiet place to write, reflect, and watch yourself grow.",
  manifest: "/manifest.json",
};

// Matches public/manifest.json's theme_color — this is the separate
// <meta name="theme-color"> tag (browser chrome while browsing normally),
// not the installed-PWA theming manifest.json controls; kept in sync
// rather than left to default so both agree.
export const viewport: Viewport = {
  themeColor: "#4f6b52",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // No proxyUrl — deliberately. See the matching note in src/proxy.ts:
    // Clerk's production instance for this app uses the DNS-CNAME method
    // (clerk.creator-ai.in), not an app-level /__clerk proxy; an earlier
    // version of this file set proxyUrl="/__clerk" based on a since-
    // superseded dashboard state, which actively broke auth once the
    // domain migration completed and Clerk issued a key scoped to the
    // subdomain instead.
    //
    // signInUrl/signUpUrl set explicitly, matching src/proxy.ts's
    // clerkMiddleware options — without these, client-side Clerk helpers
    // (and the middleware's own auth.protect() redirect) fall back to
    // Clerk's hosted Account Portal instead of this app's own custom
    // /sign-in and /sign-up pages.
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${hankenGrotesk.variable} ${materialSymbols.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
