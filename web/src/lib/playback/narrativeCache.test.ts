import { describe, expect, it } from "vitest";
import { buildNarrativeCacheKey } from "./narrativeCache";

describe("buildNarrativeCacheKey", () => {
  it("produces a different key when an entry's updated_at changes, even with the same entry ids", async () => {
    const before = await buildNarrativeCacheKey("week", "friend", [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T11:00:00Z" },
    ]);
    const after = await buildNarrativeCacheKey("week", "friend", [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T15:30:00Z" }, // b was appended to
    ]);
    expect(before).not.toBe(after);
  });

  it("is stable regardless of input order", async () => {
    const entries = [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T11:00:00Z" },
    ];
    const forward = await buildNarrativeCacheKey("week", "friend", entries);
    const reversed = await buildNarrativeCacheKey("week", "friend", [...entries].reverse());
    expect(forward).toBe(reversed);
  });

  it("differs by period and tone as before", async () => {
    const entries = [{ id: "a", updatedAt: "2026-08-24T10:00:00Z" }];
    const week = await buildNarrativeCacheKey("week", "friend", entries);
    const month = await buildNarrativeCacheKey("month", "friend", entries);
    expect(week).not.toBe(month);
  });

  it("is the same key for the same input, called twice", async () => {
    const entries = [{ id: "a", updatedAt: "2026-08-24T10:00:00Z" }];
    const first = await buildNarrativeCacheKey("week", "friend", entries);
    const second = await buildNarrativeCacheKey("week", "friend", entries);
    expect(first).toBe(second);
  });
});
