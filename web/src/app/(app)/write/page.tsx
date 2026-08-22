"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HillsHero } from "@/components/HillsHero";
import { MoodDots } from "@/components/MoodDots";
import { TagInput } from "@/components/composer/TagInput";
import { VoiceRecorder } from "@/components/composer/VoiceRecorder";
import { useSaveEntry } from "@/lib/hooks/useSaveEntry";
import { useEntries } from "@/lib/hooks/useEntries";
import { useSessionStore } from "@/lib/store/session";
import { computeStreak } from "@/lib/streak";

type Stage = "voice" | "text" | "saved";

function WriteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const dek = useSessionStore((s) => s.dek);
  const { data: entries } = useEntries();
  const saveEntry = useSaveEntry();

  const [stage, setStage] = useState<Stage>(params.get("mode") === "voice" ? "voice" : "text");
  const [text, setText] = useState("");
  const [mood, setMood] = useState<number | null>(() => {
    const fromQuery = Number(params.get("mood"));
    return fromQuery >= 1 && fromQuery <= 5 ? fromQuery : null;
  });
  const [tags, setTags] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const streak = useMemo(
    () => computeStreak((entries ?? []).map((e) => e.created_at)),
    [entries],
  );

  async function handleSave() {
    if (!dek || !text.trim()) return;
    const result = await saveEntry.mutateAsync({
      plaintext: text.trim(),
      moodScore: mood,
      tags,
      dek,
    });
    setSavedId(result.id);
    setStage("saved");
  }

  if (stage === "voice") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <div className="flex flex-shrink-0 items-center justify-between px-3.5 pt-3.5 pb-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="flex h-7 w-7 items-center justify-center"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12.5 4.5L6.5 10l6 5.5" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-muted">{today}</span>
          <span className="w-7" />
        </div>
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
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <HillsHero height={60} sunSide="center" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-4 text-center">
          <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-accent">
            <svg viewBox="0 0 20 20" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold">Entry saved</h1>
            <p className="mt-1.5 max-w-[220px] text-[12.5px] text-muted">
              Encrypted and saved privately. Only you can read it.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-faint">Mood</span>
              {mood ? (
                <MoodDots value={mood} onChange={() => {}} size={14} />
              ) : (
                <span className="text-xs text-faint">Not set</span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent">
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 2.5c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.8-2.3 1.5-3 0 1.2.7 1.8 1.3 1.8 0-3 .3-5 1.2-6.8z" />
            </svg>
            {streak} day streak
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2.5 px-5 pb-6">
          <Link
            href="/"
            className="rounded-[10px] bg-accent px-4 py-3 text-center text-[13px] font-semibold text-white"
          >
            Back to home
          </Link>
          <Link
            href={`/journal/${savedId}`}
            className="rounded-[10px] border-[1.3px] border-border bg-surface px-4 py-3 text-center text-[13px] font-semibold"
          >
            View entry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-divider px-3.5 pt-3.5 pb-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-7 w-7 items-center justify-center"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12.5 4.5L6.5 10l6 5.5" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-muted">{today}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || saveEntry.isPending || !dek}
          aria-label="Save"
          className="flex h-7 w-7 items-center justify-center text-accent disabled:opacity-30"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-4 pb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing…"
          autoFocus
          className="min-h-[35vh] flex-1 resize-none border-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-faint"
        />

        <div className="flex items-center gap-2.5">
          <span className="w-11 flex-shrink-0 text-[11px] text-muted">Mood</span>
          <MoodDots value={mood} onChange={setMood} size={18} />
        </div>

        <TagInput tags={tags} onChange={setTags} />

        {saveEntry.isError && (
          <p className="text-xs text-warn">Couldn&rsquo;t save that entry. Try again.</p>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5 border-t border-divider px-4 py-3">
        <button
          type="button"
          onClick={() => setStage("voice")}
          aria-label="Record instead"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] border-[1.3px] border-border bg-surface"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
            <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" />
            <path d="M10 15v2.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || saveEntry.isPending || !dek}
          className="flex-1 rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {saveEntry.isPending ? "Saving…" : "Save entry"}
        </button>
      </div>
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
