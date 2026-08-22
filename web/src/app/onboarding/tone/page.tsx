"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useTone } from "@/lib/hooks/useTone";
import type { Tone } from "@/lib/tone";

const GUIDES: { key: Tone; name: string; icon: string; description: string; example: string }[] = [
  {
    key: "coach",
    name: "Coach",
    icon: "insights",
    description: "Direct, motivating, calls out progress.",
    example: "Notice that you mention this frustration often when deadlines approach. How can we break that cycle?",
  },
  {
    key: "friend",
    name: "Friend",
    icon: "favorite",
    description: "Warm, casual, checks in like a friend.",
    example: "It sounds like you've had an incredibly heavy day. It's okay to feel tired.",
  },
  {
    key: "mirror",
    name: "Mirror",
    icon: "psychology",
    description: "Neutral, reflects patterns without opinion.",
    example: "What do you think is the underlying reason you reacted that way?",
  },
  {
    key: "minimal",
    name: "Minimal",
    icon: "water_drop",
    description: "Just the facts and trends.",
    example: "Tell me more.",
  },
];

export default function OnboardingTonePage() {
  const router = useRouter();
  const { tone, setTone } = useTone();
  const [selected, setSelected] = useState<Tone>(tone);
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    setSaving(true);
    try {
      await setTone(selected);
      router.push("/onboarding/notifications");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
      <header className="bg-background top-0 flex justify-between items-center w-full px-container-padding py-4 z-40 sticky">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="text-primary hover:bg-surface-container-low transition-colors rounded-full p-2"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <h1 className="font-editorial-display text-headline-lg-mobile text-primary tracking-tight">The Nook</h1>
        <div className="w-10 h-10" />
      </header>

      <main className="flex-grow flex flex-col px-container-padding py-stack-gap max-w-2xl mx-auto w-full">
        <div className="text-center mb-stack-gap space-y-4">
          <h2 className="font-editorial-display text-headline-lg-mobile text-on-surface">Choose Your Guide</h2>
          <p className="text-body-lg text-on-surface-variant max-w-md mx-auto">
            Select the voice that best supports your reflection.
          </p>
        </div>

        <div className="space-y-4 flex-grow">
          {GUIDES.map((guide) => {
            const active = selected === guide.key;
            return (
              <button
                key={guide.key}
                type="button"
                onClick={() => setSelected(guide.key)}
                className={`w-full text-left p-6 rounded-xl border transition-all duration-300 ${
                  active
                    ? "bg-surface-container-high border-primary shadow-sm"
                    : "border-surface-dim bg-surface hover:border-outline-variant hover:bg-surface-container-lowest"
                }`}
              >
                <div className="flex items-start gap-4">
                  <MaterialIcon
                    name={guide.icon}
                    filled={active}
                    className={`mt-1 transition-colors ${active ? "text-primary" : "text-outline-variant"}`}
                  />
                  <div>
                    <h3 className={`text-headline-md mb-1 transition-colors ${active ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {guide.name}
                    </h3>
                    <p className="text-body-md text-on-surface-variant mb-3">{guide.description}</p>
                    <div className="bg-surface-container-low p-3 rounded-lg rounded-tl-none border-l-2 border-surface-dim">
                      <p className="text-sm text-on-surface italic">&ldquo;{guide.example}&rdquo;</p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-8 pb-4 mt-auto">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="w-full bg-primary text-on-primary text-label-sm py-4 rounded-full shadow-[0_4px_14px_0_rgba(74,101,78,0.1)] hover:bg-surface-tint transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
          <div className="flex items-center justify-center gap-2 mt-6">
            <MaterialIcon name="autorenew" size={16} className="text-outline" />
            <span className="text-label-sm text-outline">Change anytime in Settings</span>
          </div>
        </div>
      </main>
    </div>
  );
}
