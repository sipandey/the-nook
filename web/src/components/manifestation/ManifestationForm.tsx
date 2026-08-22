"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HillsHero } from "@/components/HillsHero";
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
  { key: "ai_decides", label: "Let AI decide the right moment" },
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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={52} sunSide="center" />

      <div className="flex flex-shrink-0 items-center justify-between px-3.5 pt-3 pb-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-7 w-7 items-center justify-center"
        >
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12.5 4.5L6.5 10l6 5.5" />
          </svg>
        </button>
        <span className="text-[13px] font-bold">
          {manifestationId ? "Edit manifestation" : "New manifestation"}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || save.isPending || !dek}
          aria-label="Save"
          className="flex h-7 w-7 items-center justify-center text-accent disabled:opacity-30"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-3">
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">
            What are you manifesting?
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="Feel confident presenting to leadership"
            autoFocus
            className="min-h-[90px] w-full resize-none rounded-[10px] border-[1.3px] border-border bg-surface p-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-1 text-right text-[9px] text-faint">{text.length} / 200</div>
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">Category</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setShowCustom(false);
                }}
                className={`rounded-full border-[1.2px] px-3 py-1.5 text-[11px] ${
                  category === c ? "border-accent bg-accent font-semibold text-white" : "border-border text-muted"
                }`}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex items-center gap-1 rounded-full border-[1.2px] border-dashed border-accent px-3 py-1.5 text-[11px] text-accent"
            >
              <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 4v12M4 10h12" />
              </svg>
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
              className="mt-2 w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2 text-xs outline-none focus:border-accent"
            />
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">
            How often should this resurface?
          </div>
          <div className="overflow-hidden rounded-[10px] border-[1.3px] border-border bg-surface">
            {CADENCE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCadence(opt.key)}
                className="flex w-full items-center gap-2.5 border-b border-divider px-3 py-2.5 text-left last:border-b-0"
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-[1.3px] ${
                    cadence === opt.key ? "border-accent" : "border-border"
                  }`}
                >
                  {cadence === opt.key && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className="text-[12.5px]">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAutoDetect((v) => !v)}
          className="flex items-center gap-2.5 rounded-[10px] border-[1.3px] border-border bg-surface p-3 text-left"
        >
          <div className="flex-1">
            <div className="text-xs font-semibold">Detect progress automatically</div>
            <div className="mt-0.5 text-[10px] text-muted">
              Scan new entries for signals this is happening
            </div>
          </div>
          <span className={`h-5 w-[34px] flex-shrink-0 rounded-full relative ${autoDetect ? "bg-accent" : "bg-border"}`}>
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                autoDetect ? "left-[16px]" : "left-0.5"
              }`}
            />
          </span>
        </button>

        {save.isError && (
          <p className="text-xs text-warn">Couldn&rsquo;t save that. Try again.</p>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-6 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim() || save.isPending || !dek}
          className="w-full rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save manifestation"}
        </button>

        {manifestationId && (
          <div className="mt-3 text-center">
            {confirmingDelete ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-[11px] text-warn">Delete this manifestation?</span>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="text-[11px] font-semibold text-muted">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} disabled={del.isPending} className="text-[11px] font-semibold text-warn">
                  {del.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="text-[11.5px] font-semibold text-warn">
                Delete manifestation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
