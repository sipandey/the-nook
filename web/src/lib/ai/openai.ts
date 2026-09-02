/**
 * Server-only OpenAI wrapper. Anything imported here must run inside a
 * Route Handler or Edge Function, never in client code — the API key is
 * server-side only.
 *
 * Callers pass already-decrypted plaintext in (see docs/ARCHITECTURE.md §6.4
 * and §6.5). This module must not log, cache, or persist that plaintext or
 * OpenAI's response — the caller owns re-encrypting anything worth keeping.
 */

import "server-only";
import OpenAI from "openai";
import type { AiUsage } from "./usage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const TEXT_MODEL = "gpt-4o-mini";
export const TRANSCRIBE_MODEL = "whisper-1";

/** Converts an OpenAI chat-completion usage object to our metadata-only
 *  shape (see src/lib/ai/usage.ts) — `import type` only, so this file
 *  never actually pulls in usage.ts's DB/auth code, just its type. */
function toAiUsage(usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }): AiUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

/**
 * Bump when TONE_SYSTEM_PROMPTS or the user-message template in
 * generateDailyPrompt changes in a way that should produce different
 * output — the daily-prompt cache (see /api/ai/prompt/route.ts and
 * docs/ARCHITECTURE.md §10.2) is keyed on this, so a prompt-engineering
 * change doesn't sit invisible behind up to 24h of stale cached output.
 */
export const DAILY_PROMPT_TEMPLATE_VERSION = 1;

export interface TonePrompt {
  tone: "coach" | "friend" | "mirror" | "minimal";
}

const TONE_SYSTEM_PROMPTS: Record<TonePrompt["tone"], string> = {
  coach:
    "You are a direct, motivating journaling coach. Be warm but not soft — " +
    "name progress plainly and nudge gently. Keep responses brief.",
  friend:
    "You are a warm, casual friend helping someone reflect. Write like " +
    "someone who knows them, not a therapist. Keep responses brief.",
  mirror:
    "You are a neutral observer reflecting patterns back to the user " +
    "without offering opinions or advice. Keep responses brief.",
  minimal:
    "State only facts and observed trends. No commentary, no encouragement, " +
    "no filler. Keep responses as short as possible.",
};

/** Generates a single reflective daily journaling prompt in the user's tone. */
export async function generateDailyPrompt(
  tone: TonePrompt["tone"],
  recentEntrySummaries: string[],
): Promise<{ prompt: string; usage?: AiUsage }> {
  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: TONE_SYSTEM_PROMPTS[tone] },
      {
        role: "user",
        content:
          "Recent entry themes (most recent first): " +
          (recentEntrySummaries.join("; ") || "no recent entries") +
          "\n\nWrite one open-ended journaling prompt for today.",
      },
    ],
    max_tokens: 100,
  });

  return {
    prompt: response.choices[0]?.message?.content?.trim() ?? "",
    usage: toAiUsage(response.usage),
  };
}

export interface PlaybackInput {
  tone: TonePrompt["tone"];
  period: "week" | "month" | "year";
  entryPlaintexts: { date: string; text: string; mood: number }[];
}

export interface PlaybackNarrative {
  /** Big headline for the mood-trend story card. */
  headline: string;
  /** Supporting subtext for the mood-trend card. */
  moodTrendSummary: string;
  /** A verbatim quote pulled from one of the entries — never paraphrased,
   *  since the highlight card presents it as the user's own words. */
  highlightQuote: string;
  /** Which entry date the quote came from, e.g. "Tuesday". */
  highlightDate: string;
  /** A short note in the "letter from your past self" card style —
   *  written as if addressed to today, in the user's chosen tone. */
  letter: string;
}

/** Generates the playback narrative from decrypted entries. Never persist
 *  the input; if the caller wants to cache the output, it must re-encrypt
 *  it client-side first (docs/ARCHITECTURE.md §5, point 2).
 *
 *  Only produces the two AI-authored cards content depends on (mood trend,
 *  highlight quote, letter) — the "then vs now" comparison card is computed
 *  separately from real mood_score/tag data (see src/lib/period.ts) rather
 *  than asked of the model, since that's a case where honest arithmetic on
 *  the user's own data beats an LLM guessing at a comparison. */
export async function generatePlaybackNarrative(
  input: PlaybackInput,
): Promise<{ narrative: PlaybackNarrative; usage?: AiUsage }> {
  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: TONE_SYSTEM_PROMPTS[input.tone] },
      {
        role: "user",
        content:
          `Summarize this ${input.period}'s journal entries as JSON with keys ` +
          `"headline" (short, punchy), "moodTrendSummary" (one supporting ` +
          `sentence), "highlightQuote" (verbatim, copied exactly from one ` +
          `entry's text — do not paraphrase), "highlightDate" (that entry's ` +
          `date as given), and "letter" (2-3 sentences, written as a short ` +
          `note from their past self to today, grounded in what they ` +
          `actually wrote). Entries:\n` +
          input.entryPlaintexts
            .map((e) => `[${e.date}, mood ${e.mood}/5] ${e.text}`)
            .join("\n"),
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const narrative = JSON.parse(
    response.choices[0]?.message?.content ?? "{}",
  ) as PlaybackNarrative;

  return { narrative, usage: toAiUsage(response.usage) };
}

export interface ManifestationForDetection {
  id: string;
  text: string;
}

export interface DetectedSignal {
  manifestationId: string;
  confidence: number;
}

/**
 * Classifies whether a freshly-written entry shows genuine progress toward
 * any of the user's active manifestations. Tone-agnostic — this is a
 * structured judgment task, not user-facing copy. Deliberately conservative
 * in the prompt: most entries relate to none of the list, and a false
 * positive here means a wrong "3 entries show this happening" claim on
 * something the user is trusting the app to notice honestly.
 */
export async function detectManifestationSignals(
  entryText: string,
  manifestations: ManifestationForDetection[],
): Promise<{ signals: DetectedSignal[]; usage?: AiUsage }> {
  if (manifestations.length === 0) return { signals: [] };

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You detect whether a journal entry shows genuine, concrete progress " +
          "toward something the user said they were working on. Be conservative " +
          "— most entries relate to none of the list. Only include a manifestation " +
          "if the entry describes something real and specific, not just a mood " +
          "or vague hope.",
      },
      {
        role: "user",
        content:
          "Manifestations (id: text):\n" +
          manifestations.map((m) => `${m.id}: ${m.text}`).join("\n") +
          `\n\nJournal entry:\n${entryText}\n\n` +
          'Return JSON {"signals": [{"manifestationId": "...", "confidence": 0-1}]} ' +
          "for any that genuinely apply. Empty array if none do.",
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
    signals?: DetectedSignal[];
  };
  return { signals: parsed.signals ?? [], usage: toAiUsage(response.usage) };
}

/** Transcribes recorded audio via Whisper. Raw audio is not persisted here
 *  or by the caller — see docs/ARCHITECTURE.md §6.5 and the open question
 *  on audio retention in §8. */
export async function transcribeAudio(
  audio: File,
): Promise<{ text: string; usage?: AiUsage }> {
  const response = await openai.audio.transcriptions.create({
    model: TRANSCRIBE_MODEL,
    file: audio,
  });

  // whisper-1 is billed by audio duration, not tokens — its usage object
  // (when present) carries `seconds`, not prompt/completion counts. NK-13
  // needs that duration to price the call for the aggregate spend
  // ceiling (see computeCallCostUsd in src/lib/ai/cost.ts), so the
  // duration variant now maps to AiUsage too, not just the token one.
  let usage: AiUsage | undefined;
  if (response.usage?.type === "tokens") {
    usage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.total_tokens,
    };
  } else if (response.usage?.type === "duration") {
    usage = { durationSeconds: response.usage.seconds };
  }

  return { text: response.text, usage };
}
