"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import {
  useSaveManifestation,
  useDeleteManifestation,
  type Cadence,
} from "@/lib/hooks/useManifestations";
import { useSessionStore } from "@/lib/store/session";

const CATEGORIES = ["Career", "Relationships", "Health", "Mindset", "Habits"];

const CADENCE_OPTIONS: { key: Cadence; label: string }[] = [
  { key: "weekly", label: "Weekly, in playback" },
  { key: "monthly", label: "Monthly, in playback" },
  { key: "ai_decides", label: "Let AI decide" },
];

export interface ManifestationFormProps {
  manifestationId?: string;
  initialText?: string;
  initialCategory?: string | null;
  initialCadence?: Cadence;
  initialAutoDetect?: boolean;
}

export function ManifestationForm({
  manifestationId,
  initialText = "",
  initialCategory = null,
  initialCadence = "ai_decides",
  initialAutoDetect = true,
}: ManifestationFormProps) {
  const router = useRouter();
  const dek = useSessionStore((s) => s.dek);
  const save = useSaveManifestation();
  const del = useDeleteManifestation();

  const [text, setText] = useState(initialText);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustom, setShowCustom] = useState(
    Boolean(initialCategory && !CATEGORIES.includes(initialCategory)),
  );
  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [autoDetect, setAutoDetect] = useState(initialAutoDetect);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave() {
    if (!dek || !text.trim()) return;
    await save.mutateAsync({
      id: manifestationId,
      plaintext: text.trim(),
      category,
      cadence,
      autoDetect,
      dek,
    });
    router.push("/manifestations");
  }

  async function handleDelete() {
    if (!manifestationId) return;
    await del.mutateAsync(manifestationId);
    router.push("/manifestations");
  }

  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-xl flex-col bg-background text-on-background">
      <header className="w-full top-0 sticky bg-background flex justify-between items-center px-container-padding h-16 z-40 border-b border-surface-container">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close"
          className="text-on-surface-variant hover:opacity-80 transition-opacity p-2 -ml-2"
        >
          <MaterialIcon name="close" />
        </button>
        <h1 className="text-headline-md font-editorial-display text-primary">The Nook</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || save.isPending || !dek}
          className="text-label-sm text-primary hover:opacity-80 transition-opacity uppercase tracking-wider p-2 -mr-2 disabled:opacity-30"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </header>

      <main className="flex-grow px-container-padding py-stack-gap flex flex-col gap-stack-gap">
        {confirmingDelete && manifestationId ? (
          <div className="bg-error-container rounded-xl p-6 relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error mb-4">
                <MaterialIcon name="auto_delete" filled />
              </div>
              <h3 className="text-headline-md font-editorial-display text-on-error-container mb-2">
                Release this intention?
              </h3>
              <p className="text-body-md text-on-error-container/80 mb-6 max-w-sm mx-auto">
                This will remove the manifestation and its linked signals. This action cannot be
                undone.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-6 py-3 rounded-full border border-outline text-on-surface text-label-sm hover:bg-surface-container transition-colors"
                >
                  Keep Intention
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="px-6 py-3 rounded-full bg-error text-on-error text-label-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
                >
                  {del.isPending ? "Releasing…" : "Release Permanently"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-inline-gap">
              <label htmlFor="goal-input" className="sr-only">
                What are you calling in?
              </label>
              <textarea
                id="goal-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder="What are you calling in?"
                autoFocus
                rows={4}
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 focus:outline-none text-display-lg-mobile font-editorial-display text-on-background placeholder:text-outline resize-none p-3 transition-colors"
              />
              <div className="text-right text-label-sm text-outline">{text.length} / 200</div>
            </section>

            <section className="flex flex-col gap-unit">
              <h2 className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Category</h2>
              <div className="flex flex-wrap gap-inline-gap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setShowCustom(false);
                    }}
                    className={`px-4 py-2 rounded-full text-label-sm transition-colors ${
                      category === c
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="px-4 py-2 rounded-full bg-transparent text-primary border border-dashed border-primary hover:bg-primary/5 text-label-sm flex items-center gap-1"
                >
                  <MaterialIcon name="add" size={16} />
                  Custom
                </button>
              </div>
              {showCustom && (
                <input
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value);
                    setCategory(e.target.value || null);
                  }}
                  placeholder="Type a category"
                  className="mt-2 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
              )}
            </section>

            <section className="flex flex-col gap-unit">
              <h2 className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-2">Cadence</h2>
              <div className="flex flex-col gap-3">
                {CADENCE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                    <span className="relative w-5 h-5 flex items-center justify-center">
                      <input
                        type="radio"
                        name="cadence"
                        value={opt.key}
                        checked={cadence === opt.key}
                        onChange={() => setCadence(opt.key)}
                        className="peer appearance-none w-5 h-5 border-2 border-outline-variant rounded-full checked:border-primary transition-colors cursor-pointer bg-transparent"
                      />
                      <span className="absolute w-2.5 h-2.5 rounded-full bg-primary opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </span>
                    <span className="text-body-md text-on-background group-hover:text-primary transition-colors">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <hr className="border-t border-surface-variant my-2 w-full max-w-[80%] mx-auto opacity-50" />

            <button
              type="button"
              onClick={() => setAutoDetect((v) => !v)}
              className="flex justify-between items-start gap-4 p-4 rounded-xl bg-surface-container-low border border-surface-variant/50 text-left"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="auto_awesome" className="text-primary" size={20} />
                  <h2 className="text-body-lg text-on-background">AI Auto-Detect</h2>
                </div>
                <p className="text-body-md text-on-surface-variant pr-4">
                  Sends each new entry&rsquo;s text to OpenAI to check whether it relates
                  to this intention. Off by default; only used for entries you write
                  after turning it on. Governed by the master AI switch in Settings.
                </p>
              </div>
              <span className={`h-6 w-11 flex-shrink-0 rounded-full relative mt-1 ${autoDetect ? "bg-primary" : "bg-surface-variant"}`}>
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                    autoDetect ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            {save.isError && <p className="text-sm text-error">Couldn&rsquo;t save that. Try again.</p>}

            {manifestationId && (
              <div className="text-center pt-2">
                <button type="button" onClick={() => setConfirmingDelete(true)} className="text-label-sm text-error">
                  Release this manifestation
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="w-full py-6 flex justify-center items-center gap-2 bg-background">
        <MaterialIcon name="lock" size={16} className="text-outline" />
        <span className="text-label-sm text-outline">End-to-End Encrypted</span>
      </footer>
    </div>
  );
}
