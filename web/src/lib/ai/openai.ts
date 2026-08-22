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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEXT_MODEL = "gpt-4o-mini";

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
): Promise<string> {
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

  return response.choices[0]?.message?.content?.trim() ?? "";
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
): Promise<PlaybackNarrative> {
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

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}",
  ) as PlaybackNarrative;
}

/** Transcribes recorded audio via Whisper. Raw audio is not persisted here
 *  or by the caller — see docs/ARCHITECTURE.md §6.5 and the open question
 *  on audio retention in §8. */
export async function transcribeAudio(audio: File): Promise<string> {
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audio,
  });

  return response.text;
}
