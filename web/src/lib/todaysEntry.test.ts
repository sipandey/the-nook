import { describe, expect, it } from "vitest";
import { getTodaysEntry } from "./todaysEntry";
import type { EntryMetadata } from "@/lib/hooks/useEntries";

function entry(overrides: Partial<EntryMetadata>): EntryMetadata {
  return {
    id: "id",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mood_score: null,
    tags: [],
    encrypted_content: "",
    iv: "",
    ...overrides,
  };
}

describe("getTodaysEntry", () => {
  it("returns undefined when there are no entries", () => {
    expect(getTodaysEntry([])).toBeUndefined();
  });

  it("returns undefined when no entry is from today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getTodaysEntry([entry({ created_at: yesterday.toISOString() })])).toBeUndefined();
  });

  it("returns the entry created today", () => {
    const today = entry({ id: "today-entry" });
    const yesterday = entry({
      id: "yesterday-entry",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(getTodaysEntry([yesterday, today])?.id).toBe("today-entry");
  });

  it("returns the most recently created of several same-day entries", () => {
    const earlier = entry({ id: "earlier", created_at: new Date(Date.now() - 3600_000).toISOString() });
    const later = entry({ id: "later", created_at: new Date().toISOString() });
    expect(getTodaysEntry([earlier, later])?.id).toBe("later");
  });
});
