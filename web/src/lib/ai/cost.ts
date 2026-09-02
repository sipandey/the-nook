/**
 * Prices one logged ai_usage_log row in USD — the pure core NK-13's
 * aggregate spend ceiling (see src/lib/ai/usage.ts) sums over a day's
 * rows to decide whether to keep calling OpenAI. Pricing verified
 * directly against OpenAI's current published rates (developers.openai.com/api/docs/pricing)
 * at the time this was written, 2026-08-25 — not recalled from training
 * data, which can go stale the moment OpenAI changes a price. If this
 * ever drifts from OpenAI's real pricing, the ceiling either trips too
 * early (harmless — a false-positive throttle) or too late (a real cost
 * exposure) depending on which direction it drifted; check this table
 * again if either happens.
 */
const MODEL_PRICING: Record<string, { inputPer1M?: number; outputPer1M?: number; perMinute?: number }> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "whisper-1": { perMinute: 0.006 },
};

export function computeCallCostUsd(
  model: string,
  usage: { promptTokens?: number; completionTokens?: number; durationSeconds?: number },
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  let cost = 0;
  if (pricing.inputPer1M && usage.promptTokens) {
    cost += (usage.promptTokens / 1_000_000) * pricing.inputPer1M;
  }
  if (pricing.outputPer1M && usage.completionTokens) {
    cost += (usage.completionTokens / 1_000_000) * pricing.outputPer1M;
  }
  if (pricing.perMinute && usage.durationSeconds) {
    cost += (usage.durationSeconds / 60) * pricing.perMinute;
  }
  return cost;
}
