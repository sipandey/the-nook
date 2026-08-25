"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { MoodPicker, MOOD_OPTIONS } from "@/components/MoodPicker";
import { TagInput } from "@/components/composer/TagInput";
import { VoiceRecorder } from "@/components/composer/VoiceRecorder";
import { useSaveEntry } from "@/lib/hooks/useSaveEntry";
import { useAppendToEntry } from "@/lib/hooks/useAppendToEntry";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { useSessionStore } from "@/lib/store/session";
import { computeStreak } from "@/lib/streak";
import { useSignalDetector } from "@/lib/hooks/useSignalDetector";
import { useComposerDraft } from "@/lib/hooks/useComposerDraft";
import { getTodaysEntry } from "@/lib/todaysEntry";
import { useAiEnabled } from "@/lib/hooks/useAiEnabled";

type Stage = "voice" | "text" | "saved";

function WriteContent() {
  const params = useSearchParams();
  const dek = useSessionStore((s) => s.dek);
  const { aiEnabled } = useAiEnabled();
  const { data: entries } = useEntries();
  const saveEntry = useSaveEntry();
  const appendToEntry = useAppendToEntry();
  const detectSignals = useSignalDetector();

  // Append mode — see docs/plans/2026-08-24-append-to-todays-entry-design.md.
  // ?entryId= (from the entry-detail page's "Add to this entry" button) is
  // authoritative when present; otherwise fall back to whatever today's
  // entry happens to be, matching Home's "Continue today's entry" CTA.
  const appendEntryId = params.get("entryId");
  const todaysEntry = useMemo(() => getTodaysEntry(entries ?? []), [entries]);
  const appendTarget = useMemo(() => {
    if (appendEntryId) return entries?.find((e) => e.id === appendEntryId);
    return todaysEntry;
  }, [appendEntryId, entries, todaysEntry]);
  const isAppendMode = Boolean(appendTarget);

  const appendDecrypted = useDecryptedEntries(appendTarget ? [appendTarget] : undefined, dek);
  const existingText = appendTarget ? appendDecrypted[appendTarget.id] : undefined;

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

  const [showRestoredBanner, setShowRestoredBanner] = useState(false);

  // Called once from inside useComposerDraft's own restore effect — see
  // that file's comment on why this is a callback rather than state this
  // component mirrors via its own effect. A restored mood only overrides
  // the query-param-derived initial mood if the draft actually had one
  // set — an empty draft shouldn't clobber an explicit incoming ?mood=
  // from a Home-screen quick pick.
  const { saveDraft, flushDraft, clearDraft } = useComposerDraft((restored) => {
    setTitle(restored.title);
    setText(restored.text);
    if (restored.mood !== null) setMood(restored.mood);
    setTags(restored.tags);
    setShowRestoredBanner(true);
  });

  // Pre-fill mood/tags from the entry being appended to — see the design
  // doc's "mood & tags" decision. A restored draft (above) takes
  // precedence: if the user already had an in-progress append underway
  // when they left, that's what they should see back, not the entry's
  // original values overwriting it.
  //
  // Adjusted during render, not in a useEffect: this is React's own
  // documented pattern for "sync editable state from a prop, once, when
  // it changes" (see react.dev, "You Might Not Need an Effect" →
  // "Adjusting some state when a prop changes") — calling a state setter
  // conditionally mid-render is allowed and causes an immediate re-render
  // before anything commits, unlike calling setState from inside an
  // effect body (react-hooks/set-state-in-effect flags exactly that shape
  // — see NK-01's useComposerDraft.ts for the same rule caught earlier).
  // A ref can't substitute here either — refs can't be written during
  // render (react-hooks/refs) — so the "already applied" marker has to be
  // a real state value too.
  const [appliedAppendTargetId, setAppliedAppendTargetId] = useState<string | null>(null);
  if (appendTarget && !showRestoredBanner && appliedAppendTargetId !== appendTarget.id) {
    setAppliedAppendTargetId(appendTarget.id);
    setMood(appendTarget.mood_score);
    setTags(appendTarget.tags);
  }

  // Debounced autosave — see src/lib/hooks/useComposerDraft.ts. Only while
  // actively composing text; the "voice" and "saved" stages don't touch
  // these fields, and clearDraft() already runs on a successful save.
  useEffect(() => {
    if (stage !== "text") return;
    saveDraft({ title, text, mood, tags });
  }, [title, text, mood, tags, stage, saveDraft]);

  // A mobile OS can kill a backgrounded tab well inside the debounce
  // window above — flush immediately when the tab is hidden, not just on
  // the debounce timer. The ref holds the live values (kept fresh every
  // render, via its own effect — refs can't be written during render) so
  // the listener itself only needs registering once.
  const latestDraft = useRef({ title, text, mood, tags, stage });
  useEffect(() => {
    latestDraft.current = { title, text, mood, tags, stage };
  });

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      const current = latestDraft.current;
      if (current.stage !== "text") return;
      flushDraft({ title: current.title, text: current.text, mood: current.mood, tags: current.tags });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [flushDraft]);

  async function handleSave() {
    if (!dek || !text.trim()) return;

    if (isAppendMode && appendTarget && existingText !== undefined) {
      const combined = `${existingText}\n\n${text.trim()}`;
      const mergedTags = [...new Set([...appendTarget.tags, ...tags])];
      await appendToEntry.mutateAsync({
        entryId: appendTarget.id,
        plaintext: combined,
        moodScore: mood,
        tags: mergedTags,
        dek,
      });
      clearDraft();
      setSavedId(appendTarget.id);
      setStage("saved");
      // Fire-and-forget, same as below — replaces this entry's prior
      // signals (see the manifestation-signals route) rather than adding
      // to them, since detection re-runs against the full updated text.
      void detectSignals(appendTarget.id, combined, dek);
      return;
    }

    const plaintext = title.trim() ? `${title.trim()}\n\n${text.trim()}` : text.trim();
    const result = await saveEntry.mutateAsync({
      plaintext,
      moodScore: mood,
      tags,
      dek,
    });
    clearDraft();
    setSavedId(result.id);
    setStage("saved");
    // Fire-and-forget: the entry is already saved and shown to the user;
    // this shouldn't block or fail the save if it errors.
    void detectSignals(result.id, plaintext, dek);
  }

  function handleDiscardDraft() {
    setTitle("");
    setText("");
    setMood(null);
    setTags([]);
    clearDraft();
    setShowRestoredBanner(false);
  }

  if (stage === "voice") {
    if (!aiEnabled) {
      return (
        <div className="font-editorial-sans bg-surface text-on-surface h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center antialiased">
          <MaterialIcon name="mic_off" size={32} className="text-outline" />
          <p className="text-body-lg text-on-surface-variant max-w-xs">
            Voice notes are transcribed by an AI service, and you&rsquo;ve
            turned AI features off.
          </p>
          <Link href="/settings" className="text-label-sm text-primary underline underline-offset-2">
            Manage in Settings
          </Link>
          <button
            type="button"
            onClick={() => setStage("text")}
            className="text-label-sm text-outline underline underline-offset-2"
          >
            Back to writing
          </button>
        </div>
      );
    }

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
        {showRestoredBanner && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-primary-container/40 px-4 py-2.5 text-label-sm text-on-primary-container">
            <span className="flex items-center gap-2">
              <MaterialIcon name="history" size={16} />
              Restored your unsaved draft
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Discard
            </button>
          </div>
        )}

        {isAppendMode && (
          <div className="mb-4 rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant/70 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {existingText ?? "Loading today's entry…"}
          </div>
        )}

        {!isAppendMode && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full bg-transparent border-0 border-b border-transparent focus:border-outline-variant focus:ring-0 px-0 py-2 font-editorial-display text-title-md text-on-surface placeholder:text-outline/50 transition-colors mb-4"
          />
        )}

        <div className="flex-1 flex flex-col min-h-[300px] relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isAppendMode ? "Add another thought…" : "Start writing…"}
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

        {(saveEntry.isError || appendToEntry.isError) && (
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
            disabled={!text.trim() || saveEntry.isPending || appendToEntry.isPending || !dek}
            className="w-full bg-primary hover:bg-surface-tint text-on-primary py-4 rounded-xl text-label-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_-2px_rgba(74,101,78,0.08)] disabled:opacity-40"
          >
            <MaterialIcon name="lock" filled size={18} />
            {saveEntry.isPending || appendToEntry.isPending ? "Saving…" : "Save Entry"}
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
