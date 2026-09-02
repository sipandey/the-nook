import { describe, expect, it } from "vitest";
import { ENTRY_MAX_LENGTH, truncateToEntryLimit } from "./entryLimits";

describe("truncateToEntryLimit", () => {
  it("leaves text at or under the limit unchanged", () => {
    const short = "a".repeat(ENTRY_MAX_LENGTH);
    expect(truncateToEntryLimit(short)).toBe(short);
  });

  it("truncates text over the limit to exactly the limit", () => {
    const long = "a".repeat(ENTRY_MAX_LENGTH + 500);
    const result = truncateToEntryLimit(long);
    expect(result.length).toBe(ENTRY_MAX_LENGTH);
    expect(result).toBe("a".repeat(ENTRY_MAX_LENGTH));
  });

  it("handles empty text", () => {
    expect(truncateToEntryLimit("")).toBe("");
  });

  it("truncates from the end, keeping the beginning of the text", () => {
    const long = "start" + "x".repeat(ENTRY_MAX_LENGTH);
    const result = truncateToEntryLimit(long);
    expect(result.startsWith("start")).toBe(true);
    expect(result.length).toBe(ENTRY_MAX_LENGTH);
  });
});
