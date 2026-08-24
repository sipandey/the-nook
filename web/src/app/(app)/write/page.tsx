"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { MoodPicker, MOOD_OPTIONS } from "@/components/MoodPicker";
import { TagInput } from "@/components/composer/TagInput";
import { VoiceRecorder } from "@/components/composer/VoiceRecorder";
import { useSaveEntry } from "@/lib/hooks/useSaveEntry";
import { useEntries } from "@/lib/hooks/useEntries";
import { useSessionStore } from "@/lib/store/session";
import { computeStreak } from "@/lib/streak";
import { useSignalDetector } from "@/lib/hooks/useSignalDetector";

type Stage = "voice" | "text" | "saved";

function WriteContent() {
  const params = useSearchParams();
  const dek = useSessionStore((s) => s.dek);
  const { data: entries } = useEntries();
  const saveEntry = useSaveEntry();
  const detectSignals = useSignalDetector();

  const [stage, setStage] = useState<Stage>(params.get("mode") === "voice" ? "voice" : "text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mood, setMood] = useState<number | null>(() => {
    const fromQuery = Number(params.get("mood"));
    return fromQuery >= 1 && fromQuery <= 5 ? fromQuery : null;
  });
  const [tags, setTags] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const streak = useMemo(
    () => computeStreak((entries ?? []).map((e) => e.created_at)),
    [entries],
  );

  async function handleSave() {
    if (!dek || !text.trim()) return;
    const plaintext = title.trim() ? `${title.trim()}\n\n${text.trim()}` : text.trim();
    const result = await saveEntry.mutateAsync({
      plaintext,
      moodScore: mood,
      tags,
      dek,
    });
    setSavedId(result.id);
    setStage("saved");
    // Fire-and-forget: the entry is already saved and shown to the user;
    // this shouldn't block or fail the save if it errors.
    void detectSignals(result.id, plaintext, dek);
  }

  if (stage === "voice") {
    return (
      <div className="font-editorial-sans bg-surface text-on-surface h-screen w-full overflow-hidden flex flex-col relative antialiased">
        <VoiceRecorder
          onCancel={() => setStage("text")}
          onTranscribed={(transcript) => {
            setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
            setStage("text");
          }}
        />
      </div>
    );
  }

  if (stage === "saved" && savedId) {
    const moodOpt = mood ? MOOD_OPTIONS[mood - 1] : null;
    return (
      <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
        <header className="relative pt-20 pb-10 px-container-padding flex-shrink-0 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container mb-6 shadow-sm">
            <MaterialIcon name="check" filled size={28} />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary mb-3">
            Thought Captured.
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-sm mx-auto">
            Your entry is encrypted and stored safely.
          </p>
        </header>

        <main className="flex-grow px-container-padding pb-8">
          <div className="max-w-xl mx-auto space-y-stack-gap">
            <section className="bg-surface-container-low rounded-xl p-6 border border-surface-variant shadow-[0_4px_24px_rgba(74,101,78,0.05)]">
              <h2 className="text-label-sm text-outline mb-4 uppercase tracking-wider">Entry Summary</h2>
              <div className="grid grid-cols-2 gap-inline-gap">
                <div className="flex items-center gap-3 bg-surface rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-tertiary-container flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                    <MaterialIcon name="water_drop" size={16} />
                  </div>
                  <div>
                    <p className="text-label-sm text-outline">Mood</p>
                    <p className="text-body-md text-on-surface">{moodOpt?.label ?? "Not set"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-surface rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container flex-shrink-0">
                    <MaterialIcon name="local_fire_department" size={16} />
                  </div>
                  <div>
                    <p className="text-label-sm text-outline">Streak</p>
                    <p className="text-body-md text-on-surface">
                      {streak} {streak === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
              </div>
              {tags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-variant">
                  <p className="text-label-sm text-outline mb-2">Themes</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-label-sm border border-outline-variant"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4 pt-4">
              <Link
                href="/"
                className="w-full text-center bg-primary text-on-primary py-4 px-8 rounded-full text-label-sm hover:bg-surface-tint transition-colors shadow-[0_8px_16px_rgba(74,101,78,0.15)]"
              >
                Back to Home
              </Link>
              <Link
                href={`/journal/${savedId}`}
                className="w-full text-center text-primary py-3 px-6 rounded-full text-label-sm border border-primary hover:bg-primary-container hover:text-on-primary-container transition-colors"
              >
                View in Journal
              </Link>
            </section>

            <div className="text-center pt-4">
              <p className="inline-flex items-center text-outline text-label-sm">
                <MaterialIcon name="lock" size={16} className="mr-1" />
                End-to-End Encrypted
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans bg-surface text-on-surface min-h-screen flex flex-col antialiased pb-24">
      <AppHeader />

      <main className="flex-1 overflow-y-auto px-container-padding py-stack-gap flex flex-col relative max-w-3xl mx-auto w-full">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-transparent border-0 border-b border-transparent focus:border-outline-variant focus:ring-0 px-0 py-2 font-editorial-display text-title-md text-on-surface placeholder:text-outline/50 transition-colors mb-4"
        />

        <div className="flex-1 flex flex-col min-h-[300px] relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing…"
            autoFocus
            className="w-full h-full flex-1 bg-transparent border-none resize-none focus:ring-0 p-0 text-body-lg text-on-surface placeholder:text-on-surface-variant/40 leading-relaxed outline-none"
          />
          <button
            type="button"
            onClick={() => setStage("voice")}
            aria-label="Record instead"
            className="absolute bottom-0 right-0 p-3 bg-surface-container-high rounded-full text-on-surface-variant hover:text-primary transition-colors shadow-sm"
          >
            <MaterialIcon name="mic" />
          </button>
        </div>

        <div className="mt-12 flex flex-col gap-inline-gap bg-surface-container-lowest/50 backdrop-blur-sm p-4 rounded-xl border border-outline-variant/30 shadow-[0_4px_20px_-2px_rgba(74,101,78,0.08)]">
          <div className="flex items-center gap-4 py-2">
            <span className="text-label-sm text-on-surface-variant tracking-wider uppercase opacity-80 min-w-[48px]">
              Mood
            </span>
            <MoodPicker value={mood} onChange={setMood} />
          </div>
          <hr className="border-t border-outline-variant/20" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2">
            <span className="text-label-sm text-on-surface-variant tracking-wider uppercase opacity-80 min-w-[48px]">
              Tags
            </span>
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>

        {saveEntry.isError && (
          <div className="mt-stack-gap w-full rounded-xl bg-error-container/30 border border-error-container/50 p-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-shrink-0 bg-error-container/50 p-3 rounded-full flex items-center justify-center">
              <MaterialIcon name="sync_problem" filled className="text-on-error-container" />
            </div>
            <div className="flex-grow flex flex-col gap-1">
              <h3 className="font-editorial-display text-headline-md text-on-error-container">
                Couldn&rsquo;t save that entry
              </h3>
              <p className="text-body-md text-on-error-container/80">
                Check your connection and try again — nothing&rsquo;s been lost, your text is still
                here.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="flex-shrink-0 bg-on-error-container text-on-error px-6 py-2.5 rounded-full text-label-sm hover:bg-error transition-colors flex items-center gap-2"
            >
              <MaterialIcon name="refresh" size={18} />
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="bg-surface-container-low shrink-0 relative z-20 pb-8 pt-4 px-container-padding border-t border-outline-variant/10">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!text.trim() || saveEntry.isPending || !dek}
            className="w-full bg-primary hover:bg-surface-tint text-on-primary py-4 rounded-xl text-label-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_-2px_rgba(74,101,78,0.08)] disabled:opacity-40"
          >
            <MaterialIcon name="lock" filled size={18} />
            {saveEntry.isPending ? "Saving…" : "Save Entry"}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-on-surface-variant/70">
            <MaterialIcon name="shield_lock" size={14} />
            <span className="text-label-sm opacity-90">End-to-End Encrypted</span>
          </div>
        </div>
      </footer>

      <BottomTabBar />
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={null}>
      <WriteContent />
    </Suspense>
  );
}
