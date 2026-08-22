"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { HillsHero } from "@/components/HillsHero";
import { BottomTabBar } from "@/components/BottomTabBar";
import { TONE_OPTIONS } from "@/lib/tone";
import { useTone } from "@/lib/hooks/useTone";
import { useKeyMaterial } from "@/lib/hooks/useKeyMaterial";
import { useNotificationPrefs, useSaveNotificationPrefs } from "@/lib/hooks/useNotificationPrefs";
import { useSessionStore } from "@/lib/store/session";
import { exportUserData } from "@/lib/exportData";

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative h-5 w-[34px] flex-shrink-0 rounded-full ${on ? "bg-accent" : "bg-border"}`}>
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[16px]" : "left-0.5"}`}
      />
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { tone, setTone } = useTone();
  const { data: keyMaterial } = useKeyMaterial();
  const { data: prefs } = useNotificationPrefs();
  const savePrefs = useSaveNotificationPrefs();
  const dek = useSessionStore((s) => s.dek);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    if (!dek) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportUserData(dek);
    } catch {
      setExportError("Couldn't export your data. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      await signOut({ redirectUrl: "/" });
    } catch {
      setDeleteError("Couldn't delete your account. Try again, or contact support.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={52} sunSide="right" />

      <div className="flex-shrink-0 px-4 pt-3 pb-1">
        <h1 className="text-[17px] font-bold">Settings</h1>
      </div>

      <main className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-2">
        <section>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">AI tone</div>
          <div className="overflow-hidden rounded-[10px] border-[1.3px] border-border bg-surface">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTone(opt.key)}
                className="flex w-full items-center gap-2.5 border-b border-divider px-3 py-2.5 text-left last:border-b-0"
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-[1.3px] ${
                    tone === opt.key ? "border-accent" : "border-border"
                  }`}
                >
                  {tone === opt.key && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span>
                  <div className="text-xs font-semibold">{opt.name}</div>
                  <div className="text-[10px] text-muted">{opt.description}</div>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">
            Privacy &amp; encryption
          </div>
          <div className="overflow-hidden rounded-[10px] border-[1.3px] border-border bg-surface">
            <div className="flex items-center gap-2.5 border-b border-divider px-3 py-2.5">
              <div className="flex-1">
                <div className="text-xs font-semibold">Entries encrypted</div>
                <div className="text-[10px] text-muted">AES-256 · your key never leaves your control</div>
              </div>
              <span className="rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                Active
              </span>
            </div>
            <div className="flex items-center gap-2.5 border-b border-divider px-3 py-2.5">
              <div className="flex-1">
                <div className="text-xs font-semibold">Recovery code</div>
                <div className="text-[10px] text-muted">
                  {keyMaterial
                    ? `Saved ${new Date(keyMaterial.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                    : "…"}
                </div>
              </div>
            </div>
            <Link href="/settings/passphrase" className="flex items-center gap-2.5 border-b border-divider px-3 py-2.5">
              <span className="flex-1 text-xs font-semibold">Change journal passphrase</span>
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-faint">
                <path d="M7.5 4.5L13.5 10l-6 5.5" />
              </svg>
            </Link>
            <Link href="/settings/account" className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="flex-1">
                <div className="text-xs font-semibold">Account &amp; sign-in</div>
                <div className="text-[10px] text-muted">Email, password, connected accounts</div>
              </div>
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-faint">
                <path d="M7.5 4.5L13.5 10l-6 5.5" />
              </svg>
            </Link>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            Your account password gets you signed in. Your journal passphrase is
            separate and unlocks your entries. Lose the passphrase without your
            recovery code, and entries can&rsquo;t be recovered — by design.
          </p>
        </section>

        <section>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">Notifications</div>
          <div className="overflow-hidden rounded-[10px] border-[1.3px] border-border bg-surface">
            <div className="flex items-center gap-2.5 border-b border-divider px-3 py-2.5">
              <div className="flex-1">
                <div className="text-xs font-semibold">Daily prompt</div>
                <input
                  type="time"
                  value={prefs?.daily_prompt_time?.slice(0, 5) ?? "20:30"}
                  onChange={(e) => savePrefs.mutate({ daily_prompt_time: `${e.target.value}:00` })}
                  className="mt-1 rounded-[6px] border border-border bg-transparent px-1.5 py-0.5 text-[11px]"
                />
              </div>
              <button type="button" onClick={() => savePrefs.mutate({ daily_prompt_enabled: !prefs?.daily_prompt_enabled })}>
                <Toggle on={prefs?.daily_prompt_enabled ?? true} />
              </button>
            </div>
            <div className="flex items-center gap-2.5 border-b border-divider px-3 py-2.5">
              <span className="flex-1 text-xs font-semibold">Playback ready</span>
              <button type="button" onClick={() => savePrefs.mutate({ playback_ready_enabled: !prefs?.playback_ready_enabled })}>
                <Toggle on={prefs?.playback_ready_enabled ?? true} />
              </button>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="flex-1 text-xs font-semibold">Manifestation resurfaced</span>
              <button type="button" onClick={() => savePrefs.mutate({ manifestation_enabled: !prefs?.manifestation_enabled })}>
                <Toggle on={prefs?.manifestation_enabled ?? false} />
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="overflow-hidden rounded-[10px] border-[1.3px] border-border bg-surface">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !dek}
              className="flex w-full items-center gap-2.5 border-b border-divider px-3 py-2.5 text-left disabled:opacity-50"
            >
              <span className="flex-1 text-xs font-semibold">
                {exporting ? "Exporting…" : "Export my data"}
              </span>
              <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-faint">
                <path d="M7.5 4.5L13.5 10l-6 5.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete((v) => !v)}
              className="flex w-full items-center px-3 py-2.5 text-left"
            >
              <span className="flex-1 text-xs font-semibold text-warn">Delete account</span>
            </button>
          </div>
          {exportError && <p className="mt-1.5 text-[11px] text-warn">{exportError}</p>}

          {confirmingDelete && (
            <div className="mt-2 rounded-[10px] border-[1.3px] border-warn-soft bg-warn-soft p-3">
              <p className="text-[11px] leading-relaxed text-warn">
                This permanently deletes your account, every entry, and every
                manifestation. There is no recovery code for this — it cannot be
                undone. Type <b>DELETE</b> to confirm.
              </p>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2 w-full rounded-[8px] border-[1.3px] border-border bg-surface px-2.5 py-1.5 text-xs outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteConfirmText("");
                  }}
                  className="flex-1 rounded-[8px] border-[1.3px] border-border bg-surface py-2 text-[11px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleting}
                  className="flex-1 rounded-[8px] bg-warn py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
              {deleteError && <p className="mt-2 text-[11px] text-warn">{deleteError}</p>}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => {
            signOut({ redirectUrl: "/" });
            router.push("/");
          }}
          className="text-xs font-semibold text-muted"
        >
          Sign out
        </button>
      </main>

      <BottomTabBar />
    </div>
  );
}
