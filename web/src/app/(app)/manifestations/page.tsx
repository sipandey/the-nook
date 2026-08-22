"use client";

import Link from "next/link";
import { HillsHero } from "@/components/HillsHero";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useManifestations, useDecryptedManifestations } from "@/lib/hooks/useManifestations";
import { useSessionStore } from "@/lib/store/session";

export default function ManifestationsPage() {
  const { data: manifestations, isLoading } = useManifestations();
  const dek = useSessionStore((s) => s.dek);
  const decrypted = useDecryptedManifestations(manifestations, dek);

  const active = (manifestations ?? []).filter((m) => m.status === "active");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={52} sunSide="center" />

      <div className="flex flex-shrink-0 items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-[17px] font-bold">Manifestations</h1>
        <Link
          href="/manifestations/new"
          aria-label="New manifestation"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border-[1.3px] border-border"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </Link>
      </div>

      <main className="flex flex-1 flex-col gap-2.5 px-4 pb-3">
        {isLoading && <p className="text-xs text-muted">Loading…</p>}

        {!isLoading && active.length === 0 && (
          <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted">
              Write down something you&rsquo;re working toward — we&rsquo;ll
              resurface it when it seems relevant.
            </p>
            <Link href="/manifestations/new" className="text-xs font-semibold text-accent">
              Add your first one
            </Link>
          </div>
        )}

        {active.map((m) => {
          const text = decrypted[m.id];
          const signalCount = m.manifestation_signals?.[0]?.count ?? 0;
          return (
            <Link
              key={m.id}
              href={`/manifestations/${m.id}`}
              className="rounded-[10px] border-[1.3px] border-border bg-surface p-3"
            >
              <div className="text-[13px] font-semibold leading-snug">
                {text === undefined ? "…" : text || "(couldn't decrypt)"}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {m.category && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                    {m.category}
                  </span>
                )}
                <span className="text-[10px] text-faint">
                  Written {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-accent">
                {signalCount > 0 ? (
                  <>
                    <div className="flex gap-[3px]">
                      {Array.from({ length: Math.min(signalCount, 5) }).map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" />
                      ))}
                    </div>
                    {signalCount} {signalCount === 1 ? "entry shows" : "entries show"} this happening
                  </>
                ) : (
                  <span className="text-faint">No signals detected yet</span>
                )}
              </div>
            </Link>
          );
        })}
      </main>

      <BottomTabBar />
    </div>
  );
}
