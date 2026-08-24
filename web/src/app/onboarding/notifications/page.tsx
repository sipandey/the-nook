"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useNotificationPrefs, useSaveNotificationPrefs } from "@/lib/hooks/useNotificationPrefs";
import { useSubscribeToPush } from "@/lib/hooks/usePushSubscription";

function Toggle({ on, onClick, id }: { on: boolean; onClick: () => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full border-2 border-transparent transition-colors ${
        on ? "bg-primary" : "bg-surface-variant"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-on-primary shadow-sm transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/**
 * Stands in for the brief's "lock-screen push notification appearance"
 * device-frame mockup — a real iOS/Android lock screen can't be rendered
 * from a web app, so this shows the same 3 notification types as a compact
 * in-context preview instead of a separate unreachable device-frame route.
 */
function NotificationPreview() {
  const items = [
    { icon: "menu_book", label: "A quiet moment for reflection?" },
    { icon: "history_edu", label: "Your weekly recap is ready." },
    { icon: "auto_awesome", label: "A signal of growth was detected." },
  ];
  return (
    <div className="w-full flex flex-col gap-2 mb-stack-gap">
      {items.map((item) => (
        <div
          key={item.icon}
          className="rounded-2xl p-3 flex gap-3 items-start bg-surface-container-low border border-outline-variant/30"
        >
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
            <MaterialIcon name={item.icon} filled size={16} className="text-on-primary-container" />
          </div>
          <div className="flex-1 pt-0.5">
            <div className="text-label-sm text-on-surface-variant font-semibold">The Nook</div>
            <p className="text-sm text-on-surface leading-tight">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OnboardingNotificationsPage() {
  const router = useRouter();
  const { data: prefs } = useNotificationPrefs();
  const savePrefs = useSaveNotificationPrefs();
  const subscribeToPush = useSubscribeToPush();
  const [showPreview, setShowPreview] = useState(false);

  async function handleEnable() {
    await savePrefs.mutateAsync({
      daily_prompt_enabled: prefs?.daily_prompt_enabled ?? true,
      playback_ready_enabled: prefs?.playback_ready_enabled ?? true,
      manifestation_enabled: prefs?.manifestation_enabled ?? false,
    });
    // The type toggles above are meaningful on their own even if this
    // fails or is denied — a denied/skipped permission prompt shouldn't
    // block finishing onboarding, just leave push inactive until the
    // user grants it later from Settings.
    try {
      await subscribeToPush.mutateAsync();
    } catch {
      // Intentionally swallowed — see above.
    }
    router.push("/");
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-dvh flex flex-col justify-center items-center p-container-padding antialiased">
      <main className="w-full max-w-md mx-auto flex flex-col items-center">
        <div className="text-center mb-stack-gap w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-6 shadow-sm border border-surface-variant">
            <MaterialIcon name="notifications" size={26} className="text-primary" />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-on-background mb-4">
            Gentle Nudges
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-sm">
            We only reach out when it matters. Choose how you&rsquo;d like to stay connected.
          </p>
        </div>

        <div className="w-full bg-surface-container-lowest border border-surface-variant rounded-[24px] p-6 flex flex-col gap-8 shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-stack-gap">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="toggle-daily" className="text-[20px] leading-[28px] text-on-surface cursor-pointer">
                Daily Reflection
              </label>
              <p className="text-body-md text-outline">A gentle reminder to pause.</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-body-md text-primary bg-surface-container-low px-3 py-1 rounded-full flex items-center gap-1">
                  <MaterialIcon name="schedule" size={16} />
                  {prefs?.daily_prompt_time?.slice(0, 5) ?? "8:00 AM"}
                </span>
              </div>
            </div>
            <div className="pt-1">
              <Toggle
                id="toggle-daily"
                on={prefs?.daily_prompt_enabled ?? true}
                onClick={() => savePrefs.mutate({ daily_prompt_enabled: !(prefs?.daily_prompt_enabled ?? true) })}
              />
            </div>
          </div>
          <div className="h-px w-full bg-surface-variant opacity-50" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="toggle-weekly" className="text-[20px] leading-[28px] text-on-surface cursor-pointer">
                Weekly Recap
              </label>
              <p className="text-body-md text-outline">Notified when your story is ready.</p>
            </div>
            <div className="pt-1">
              <Toggle
                id="toggle-weekly"
                on={prefs?.playback_ready_enabled ?? true}
                onClick={() => savePrefs.mutate({ playback_ready_enabled: !(prefs?.playback_ready_enabled ?? true) })}
              />
            </div>
          </div>
          <div className="h-px w-full bg-surface-variant opacity-50" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="toggle-manifest" className="text-[20px] leading-[28px] text-on-surface cursor-pointer">
                Manifestation Signals
              </label>
              <p className="text-body-md text-outline">Notified when progress is detected.</p>
            </div>
            <div className="pt-1">
              <Toggle
                id="toggle-manifest"
                on={prefs?.manifestation_enabled ?? false}
                onClick={() => savePrefs.mutate({ manifestation_enabled: !(prefs?.manifestation_enabled ?? false) })}
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-label-sm text-primary mb-4 flex items-center gap-1"
        >
          {showPreview ? "Hide" : "See what these look like"}
          <MaterialIcon name={showPreview ? "expand_less" : "expand_more"} size={16} />
        </button>
        {showPreview && <NotificationPreview />}

        <div className="w-full flex flex-col gap-4 items-center">
          <button
            type="button"
            onClick={handleEnable}
            disabled={savePrefs.isPending}
            className="w-full bg-primary text-on-primary text-label-sm py-4 px-6 rounded-full transition-all hover:bg-on-primary-fixed-variant active:scale-[0.98] disabled:opacity-50"
          >
            {savePrefs.isPending ? "Saving…" : "Enable Notifications"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-label-sm text-outline hover:text-on-surface transition-colors py-2 px-4 rounded-full"
          >
            Not now
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-1.5 opacity-60">
          <MaterialIcon name="lock" size={14} filled className="text-outline" />
          <span className="text-label-sm text-outline tracking-wider">Notifications only — no tracking</span>
        </div>
      </main>
    </div>
  );
}
