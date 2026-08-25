/**
 * Pure decision logic for src/lib/hooks/useAiEnabled.ts — kept separate
 * from the Clerk-dependent hook so it's unit-testable under this repo's
 * "node" vitest environment (no jsdom/@testing-library, see
 * vitest.config.mts's own comment on why: hooks that touch React/Clerk
 * get live-browser verification instead, same precedent as useTone.ts
 * and useComposerDraft.ts — neither has a unit test either).
 *
 * Default is `true` (AI on) when the field is absent or the value isn't
 * a boolean — see docs/plans/2026-08-25-ai-privacy-controls-design.md's
 * "Default for existing users" decision: existing users shouldn't wake up
 * to playback/voice silently disabled, this is a new choice being
 * offered, not a removal applied without asking.
 */
export function resolveAiEnabled(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): boolean {
  const value = unsafeMetadata?.aiEnabled;
  return typeof value === "boolean" ? value : true;
}
