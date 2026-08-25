import { describe, expect, it } from "vitest";
import { resolveAiEnabled } from "./aiPrivacy";

describe("resolveAiEnabled", () => {
  it("defaults to true when metadata is undefined", () => {
    expect(resolveAiEnabled(undefined)).toBe(true);
  });

  it("defaults to true when metadata is null", () => {
    expect(resolveAiEnabled(null)).toBe(true);
  });

  it("defaults to true when the field is absent", () => {
    expect(resolveAiEnabled({})).toBe(true);
  });

  it("returns false when explicitly turned off", () => {
    expect(resolveAiEnabled({ aiEnabled: false })).toBe(false);
  });

  it("returns true when explicitly turned on", () => {
    expect(resolveAiEnabled({ aiEnabled: true })).toBe(true);
  });

  it("ignores a non-boolean value and defaults to true", () => {
    expect(resolveAiEnabled({ aiEnabled: "off" })).toBe(true);
  });
});
