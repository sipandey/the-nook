"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useManifestations, useDecryptedManifestations } from "@/lib/hooks/useManifestations";
import { useSessionStore } from "@/lib/store/session";

export default function ManifestationsPage() {
  const { data: manifestations, isLoading } = useManifestations();
  const dek = useSessionStore((s) => s.dek);
  const decrypted = useDecryptedManifestations(manifestations, dek);

  const active = (manifestations ?? []).filter((m) => m.status === "active");

  if (!isLoading && active.length === 0) {
    return (
      <div className="font-editorial-sans min-h-screen flex flex-col relative pb-[90px] md:pb-0 bg-background text-on-background">
        <AppHeader />

        <main className="flex-grow flex flex-col items-center justify-center px-container-padding py-stack-gap mb-24 max-w-lg mx-auto w-full relative">
          <div className="w-full aspect-square mb-stack-gap relative rounded-[40px] overflow-hidden bg-surface-container-low shadow-[inset_0_0_100px_rgba(242,239,233,0.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static decorative asset */}
            <img src="/images/hero-dawn.jpg" alt="" className="w-full h-full object-cover opacity-90 mix-blend-multiply" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
          </div>

          <div className="text-center flex flex-col gap-inline-gap mb-stack-gap max-w-md mx-auto relative z-10">
            <h2 className="font-editorial-display text-headline-lg-mobile text-on-background">A Vision to Weave</h2>
            <p className="text-body-lg text-on-surface-variant leading-relaxed">
              Manifestations are intentions you set for yourself. As you journal, our AI softly
              detects moments where your reality matches your intent.
            </p>
          </div>

          <Link
            href="/manifestations/new"
            className="w-full max-w-sm text-center bg-primary text-on-primary rounded-full py-4 px-8 text-label-sm uppercase tracking-widest hover:bg-on-primary-fixed-variant transition-colors shadow-[0_4px_20px_rgba(74,101,78,0.15)]"
          >
            Set Your First Intention
          </Link>

          <div className="mt-8 flex items-center gap-2 text-on-surface-variant opacity-70">
            <MaterialIcon name="lock" size={14} />
            <span className="text-label-sm">End-to-End Encrypted</span>
          </div>
        </main>

        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="font-editorial-sans min-h-screen flex flex-col relative pb-[90px] md:pb-0 bg-background text-on-background">
      <header className="w-full top-0 sticky bg-background flex justify-between items-center px-container-padding h-16 z-40">
        <span className="w-10" />
        <h1 className="text-headline-md font-editorial-display text-primary tracking-tight">The Nook</h1>
        <Link href="/settings" aria-label="Settings" className="text-on-surface-variant">
          <MaterialIcon name="settings" />
        </Link>
      </header>

      <main className="flex-grow px-container-padding pt-6 pb-32">
        <section className="mb-stack-gap text-center md:text-left">
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary mb-2">
            Manifestations
          </h1>
          <p className="text-body-lg text-outline italic">Your intentions, coming to light.</p>
        </section>

        {isLoading && <p className="text-sm text-on-surface-variant">Loading…</p>}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {active.map((m) => {
            const text = decrypted[m.id];
            const signalCount = m.manifestation_signals?.[0]?.count ?? 0;
            const hasSignals = signalCount > 0;
            return (
              <Link
                key={m.id}
                href={`/manifestations/${m.id}`}
                className={`rounded-xl p-6 flex flex-col h-full transition-colors group ${
                  hasSignals
                    ? "bg-surface-container hover:bg-surface-container-high"
                    : "bg-surface-container-low hover:bg-surface-container border border-outline-variant/30"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  {m.category && (
                    <div
                      className={`text-label-sm px-3 py-1 rounded-full uppercase tracking-wider ${
                        hasSignals
                          ? "bg-surface-variant text-on-surface-variant"
                          : "bg-surface-variant/50 text-on-surface-variant/70"
                      }`}
                    >
                      {m.category}
                    </div>
                  )}
                  {hasSignals && (
                    <MaterialIcon
                      name="arrow_forward"
                      className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </div>
                <h2 className={`text-headline-md font-editorial-display mb-auto pb-6 ${hasSignals ? "text-on-surface" : "text-on-surface/80"}`}>
                  {text === undefined ? "…" : text || "(couldn't decrypt)"}
                </h2>
                <div className={`flex items-center mt-4 pt-4 border-t ${hasSignals ? "text-primary border-surface-dim" : "text-outline border-surface-dim/50"}`}>
                  <MaterialIcon name={hasSignals ? "trending_up" : "hourglass_empty"} size={16} className={`mr-2 ${hasSignals ? "" : "opacity-50"}`} />
                  <p className={`text-sm ${hasSignals ? "font-medium" : "italic"}`}>
                    {hasSignals
                      ? `${signalCount} ${signalCount === 1 ? "entry shows" : "entries show"} this happening`
                      : "No signals yet"}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>

        <div className="mt-stack-gap text-center flex items-center justify-center text-outline">
          <MaterialIcon name="lock" size={16} className="mr-1" />
          <span className="text-label-sm">End-to-End Encrypted</span>
        </div>
      </main>

      <Link
        href="/manifestations/new"
        aria-label="Add new manifestation"
        className="fixed bottom-24 right-6 bg-primary text-on-primary w-14 h-14 rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all z-40"
      >
        <MaterialIcon name="add" size={26} />
      </Link>

      <BottomTabBar />
    </div>
  );
}
