"use client";

import { useState } from "react";

export function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const clean = draft.trim().toLowerCase();
    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full border-[1.2px] border-border px-2.5 py-1 text-[11px]"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="text-faint"
          >
            <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Backspace" && draft === "" && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder="Add tag"
        className="min-w-[70px] flex-1 border-none bg-transparent py-1 text-[11px] outline-none placeholder:text-faint"
      />
    </div>
  );
}
