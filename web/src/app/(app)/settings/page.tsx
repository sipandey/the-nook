"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { MaterialIcon } from "@/components/MaterialIcon";
import { TONE_OPTIONS } from "@/lib/tone";
import { useTone } from "@/lib/hooks/useTone";
import { useKeyMaterial } from "@/lib/hooks/useKeyMaterial";
import { useNotificationPrefs, useSaveNotificationPrefs } from "@/lib/hooks/useNotificationPrefs";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${on ? "bg-primary" : "bg-surface-variant"}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-surface-container-lowest shadow-sm transition-all ${
          on ? "right-1" : "left-1"
        }`}
      />
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onClick,
  href,
  badge,
}: {
  icon: string;
  label: string;
  value?: string;
  onClick?: () => void;
  href?: string;
  badge?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-container transition-colors">
          <MaterialIcon name={icon} />
        </div>
        <div className="text-left">
          <div className="text-body-md text-on-surface">{label}</div>
          {value && <div className="text-sm text-secondary">{value}</div>}
        </div>
      </div>
      {badge ? (
        <span className="bg-primary-container px-3 py-1 rounded-full text-label-sm text-on-primary-container">
          {badge}
        </span>
      ) : (
        <MaterialIcon name="chevron_right" className="text-outline group-hover:text-primary transition-colors" />
      )}
    </>
  );
  const className =
    "setting-row w-full flex items-center justify-between p-4 border-b border-outline/10 last:border-b-0 group transition-colors";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  const { tone, setTone } = useTone();
  const { data: keyMaterial } = useKeyMaterial();
  const { data: prefs } = useNotificationPrefs();
  const savePrefs = useSaveNotificationPrefs();

  const [toneOpen, setToneOpen] = useState(false);

  const currentTone = TONE_OPTIONS.find((t) => t.key === tone);

  return (
    <div className="font-editorial-sans bg-surface text-on-surface min-h-screen flex flex-col antialiased">
      <header className="w-full top-0 sticky z-40 bg-surface/80 backdrop-blur-md flex justify-between items-center px-container-margin py-unit h-16">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close settings"
          className="hover:opacity-80 transition-opacity active:scale-95 duration-200 p-2 -ml-2 text-primary"
        >
          <MaterialIcon name="close" />
        </button>
        <h1 className="font-editorial-display text-headline-lg-mobile text-primary absolute left-1/2 -translate-x-1/2">
          Settings
        </h1>
        <span className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-container-margin pt-6 pb-24 space-y-section-gap">
        <div className="flex items-center justify-center space-x-2 text-privacy-safe text-label-caps opacity-80 mb-4">
          <MaterialIcon name="lock" size={16} />
          <span>Your journal is end-to-end encrypted</span>
        </div>

        <section>
          <h2 className="text-title-md font-editorial-display text-secondary mb-4 px-2">Journal Preferences</h2>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm ring-1 ring-outline/10">
            <button
              type="button"
              onClick={() => setToneOpen((v) => !v)}
              className="setting-row w-full flex items-center justify-between p-4 border-b border-outline/10 group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-container transition-colors">
                  <MaterialIcon name="psychology" />
                </div>
                <div className="text-left">
                  <div className="text-body-md text-on-surface">AI Tone</div>
                  <div className="text-sm text-secondary">{currentTone?.name ?? "…"}</div>
                </div>
              </div>
              <MaterialIcon
                name={toneOpen ? "expand_less" : "chevron_right"}
                className="text-outline group-hover:text-primary transition-colors"
              />
            </button>
            {toneOpen && (
              <div className="border-b border-outline/10">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setTone(opt.key);
                      setToneOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 pl-8 text-left border-b border-outline/5 last:border-b-0"
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                        tone === opt.key ? "border-primary" : "border-outline-variant"
                      }`}
                    >
                      {tone === opt.key && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span>
                      <div className="text-sm font-semibold text-on-surface">{opt.name}</div>
                      <div className="text-xs text-on-surface-variant">{opt.description}</div>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <SettingRow
              icon="security"
              label="Privacy & Encryption"
              value={
                keyMaterial
                  ? `Recovery phrase saved ${new Date(keyMaterial.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                  : "Manage keys"
              }
              href="/settings/passphrase"
              badge="SECURE"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant px-2">
            Your account password gets you signed in. Your journal passphrase is separate and
            unlocks your entries. Lose the passphrase without your recovery phrase, and entries
            can&rsquo;t be recovered — by design.
          </p>
        </section>

        <section>
          <h2 className="text-title-md font-editorial-display text-secondary mb-4 px-2">Notifications</h2>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm ring-1 ring-outline/10">
            <div className="setting-row w-full flex items-center justify-between p-4 border-b border-outline/10">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <MaterialIcon name="notifications" />
                </div>
                <div className="text-left">
                  <div className="text-body-md text-on-surface">Daily Reflection Prompt</div>
                  <input
                    type="time"
                    value={prefs?.daily_prompt_time?.slice(0, 5) ?? "20:30"}
                    onChange={(e) => savePrefs.mutate({ daily_prompt_time: `${e.target.value}:00` })}
                    className="mt-1 rounded-md border border-outline-variant/50 bg-transparent px-1.5 py-0.5 text-xs text-secondary"
                  />
                </div>
              </div>
              <Toggle
                on={prefs?.daily_prompt_enabled ?? true}
                onClick={() => savePrefs.mutate({ daily_prompt_enabled: !prefs?.daily_prompt_enabled })}
              />
            </div>
            <div className="setting-row w-full flex items-center justify-between p-4 border-b border-outline/10">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <MaterialIcon name="auto_awesome" />
                </div>
                <div className="text-left">
                  <div className="text-body-md text-on-surface">Playback Ready</div>
                  <div className="text-sm text-secondary">Push notifications</div>
                </div>
              </div>
              <Toggle
                on={prefs?.playback_ready_enabled ?? true}
                onClick={() => savePrefs.mutate({ playback_ready_enabled: !prefs?.playback_ready_enabled })}
              />
            </div>
            <div className="setting-row w-full flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                  <MaterialIcon name="favorite" />
                </div>
                <div className="text-left">
                  <div className="text-body-md text-on-surface">Manifestation Resurfaced</div>
                </div>
              </div>
              <Toggle
                on={prefs?.manifestation_enabled ?? false}
                onClick={() => savePrefs.mutate({ manifestation_enabled: !prefs?.manifestation_enabled })}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-title-md font-editorial-display text-secondary mb-4 px-2">Account</h2>
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm ring-1 ring-outline/10">
            <SettingRow icon="account_circle" label="Account & sign-in" value="Email, password, connected accounts" href="/settings/account" />
            <SettingRow icon="database" label="Export Data" value="Download your journal entries" href="/settings/export" />
            <button
              type="button"
              onClick={() => {
                signOut({ redirectUrl: "/" });
                router.push("/");
              }}
              className="setting-row w-full flex items-center justify-between p-4 group"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-container transition-colors">
                  <MaterialIcon name="logout" />
                </div>
                <div className="text-left">
                  <div className="text-body-md text-on-surface">Sign Out</div>
                </div>
              </div>
            </button>
          </div>
        </section>

        <div className="pt-8 pb-4 flex flex-col items-center gap-3">
          <Link
            href="/settings/delete-account"
            className="text-body-md text-error opacity-80 hover:opacity-100 transition-opacity active:scale-95 px-4 py-2"
          >
            Delete Account
          </Link>
        </div>

        <div className="text-center text-sm text-secondary opacity-60 pb-8">
          The Nook
          <br />
          Crafted with calm.
        </div>
      </main>
    </div>
  );
}
