"use client";

import { useRouter } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { MaterialIcon } from "@/components/MaterialIcon";

/**
 * Clerk's prebuilt <UserProfile/> handles the real account internals
 * (password, 2FA, connected accounts, sessions) — this only reskins the
 * surrounding frame to match the design system, per the brief's "lighter-
 * touch wrapper, not necessarily Clerk's internals." The `appearance` prop
 * tints Clerk's own UI toward the same palette rather than faking editable
 * fields (email/name/2FA/connected-accounts) that Clerk already renders
 * for real.
 */
export default function AccountSettingsPage() {
  const router = useRouter();

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
      <header className="w-full top-0 sticky z-40 bg-background flex justify-between items-center px-container-padding h-16">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-primary hover:opacity-80 transition-opacity p-2 -ml-2"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <h1 className="font-editorial-display text-headline-md text-primary">The Nook</h1>
        <span className="w-10" />
      </header>

      <main className="flex-grow w-full max-w-2xl mx-auto px-container-padding py-stack-gap flex flex-col gap-stack-gap pb-24">
        <div className="text-center mb-2">
          <h2 className="font-editorial-display text-headline-md text-on-background mb-2">Account Details</h2>
          <p className="text-body-md text-on-surface-variant">Manage your identity and security settings.</p>
        </div>

        <div className="flex justify-center overflow-x-auto">
          <UserProfile
            routing="hash"
            appearance={{
              variables: {
                colorPrimary: "#4a654e",
                colorBackground: "#f4f4f0",
                borderRadius: "0.75rem",
              },
            }}
          />
        </div>

        <div className="flex justify-center items-center gap-2 opacity-60 mt-4">
          <MaterialIcon name="lock" size={16} />
          <span className="text-label-sm uppercase tracking-widest">End-to-End Encrypted</span>
        </div>
      </main>
    </div>
  );
}
