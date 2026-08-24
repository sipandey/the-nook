import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader, Hanken_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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

export const metadata: Metadata = {
  title: "The Nook",
  description: "A quiet place to write, reflect, and watch yourself grow.",
  manifest: "/manifest.json",
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
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${hankenGrotesk.variable} h-full antialiased`}
      >
        <head>
          {/* Material Symbols — used only by the newly rebuilt "editorial"
              screens; the rest of the app still uses inline SVG icons.
              The no-page-custom-font rule below is a Pages Router-era
              check (targets _document.js, which doesn't exist in App
              Router) — this IS the documented App Router pattern for a
              stylesheet next/font doesn't cover, in the root layout so
              it's global, not single-page. */}
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="min-h-full flex flex-col">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
