import { UnlockGate } from "@/components/unlock/UnlockGate";

/**
 * Every screen under this route group requires both a Clerk session
 * (enforced by src/proxy.ts, before this even renders) and an unlocked
 * DEK (enforced here). Sign-in/sign-up stay outside this group — they're
 * how you get a Clerk session in the first place, so gating them on the
 * DEK would be circular.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <UnlockGate>{children}</UnlockGate>;
}
