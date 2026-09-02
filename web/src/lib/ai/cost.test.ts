import { describe, expect, it } from "vitest";
import { computeCallCostUsd } from "./cost";

describe("computeCallCostUsd", () => {
  it("prices a gpt-4o-mini call from prompt + completion tokens", () => {
    // 1M input tokens = $0.15, 1M output tokens = $0.60
    const cost = computeCallCostUsd("gpt-4o-mini", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.75, 5);
  });

  it("prices a whisper-1 call from duration", () => {
    // $0.006 / minute
    const cost = computeCallCostUsd("whisper-1", { durationSeconds: 120 });
    expect(cost).toBeCloseTo(0.012, 5);
  });

  it("returns 0 for a gpt-4o-mini call with no token counts logged", () => {
    expect(computeCallCostUsd("gpt-4o-mini", {})).toBe(0);
  });

  it("returns 0 for a whisper-1 call with no duration logged", () => {
    expect(computeCallCostUsd("whisper-1", {})).toBe(0);
  });

  it("returns 0 for an unrecognized model rather than throwing", () => {
    expect(computeCallCostUsd("some-future-model", { promptTokens: 1000 })).toBe(0);
  });

  it("treats only completionTokens present as a partial gpt-4o-mini cost", () => {
    const cost = computeCallCostUsd("gpt-4o-mini", { completionTokens: 1_000_000 });
    expect(cost).toBeCloseTo(0.6, 5);
  });
});
