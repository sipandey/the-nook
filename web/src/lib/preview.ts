/**
 * Dev-only visual QA mode — lets every screen under src/app/(app)/ be
 * reached and populated with fixture data WITHOUT a real Clerk session or
 * journal passphrase. Exists so screens can be checked visually without
 * creating a real account (Claude's own operating rules prohibit that,
 * regardless of who asks) or touching the real Supabase/Clerk backends.
 *
 * Off by default. Turned on only by setting NEXT_PUBLIC_PREVIEW_MODE=1 in
 * .env.local (never commit it as "1"), and every call site also checks
 * that this isn't a real Vercel deployment (VERCEL_ENV unset locally, set
 * to "production"/"preview"/"development" on Vercel) — NODE_ENV isn't a
 * usable guard here since `next start` sets it to "production" too, which
 * would block this even for local verification.
 *
 * What this does NOT do: touch the real database, call OpenAI, or fake a
 * Clerk identity server-side. It short-circuits the client-side data hooks
 * to return fixture data instead of fetching, and unlocks the DEK gate
 * with a fixed local key that only ever encrypts/decrypts the fixture text
 * below, in memory, in this browser.
 */

import { encryptText, importKeyFromBase64 } from "@/lib/crypto";
import type { EntryMetadata } from "@/lib/hooks/useEntries";
import type { ManifestationRow } from "@/lib/hooks/useManifestations";
import type { KeyMaterialRow } from "@/lib/hooks/useKeyMaterial";
import type { NotificationPrefs } from "@/lib/hooks/useNotificationPrefs";
import type { PlaybackNarrative } from "@/lib/ai/openai";

export const PREVIEW_MODE =
  !process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_PREVIEW_MODE === "1";

// A fixed 256-bit key, base64-encoded — not a secret (there's nothing real
// behind it), just stable across dev-server restarts so fixture ciphertext
// stays decryptable within one browser session's re-renders.
const PREVIEW_DEK_BASE64 = "3NMadRWYQZmmcoElZbocfIo66xYhWGSEynwFAnulpqA=";

let dekPromise: Promise<CryptoKey> | null = null;

export function getPreviewDek(): Promise<CryptoKey> {
  if (!dekPromise) dekPromise = importKeyFromBase64(PREVIEW_DEK_BASE64);
  return dekPromise;
}

const ENTRY_FIXTURES: { id: string; daysAgo: number; mood: number; tags: string[]; text: string }[] = [
  {
    id: "preview-entry-1",
    daysAgo: 0,
    mood: 4,
    tags: ["gratitude", "morning"],
    text: "The morning light hit the kitchen table just right today. Sat with coffee and watched the dust motes dance for a few minutes before the day pulled me in. Small, private victory to just sit and observe without reaching for my phone.",
  },
  {
    id: "preview-entry-2",
    daysAgo: 2,
    mood: 2,
    tags: ["work"],
    text: "Overwhelmed by the project deadline. Trying to break it down into smaller, manageable pieces, but the overarching weight is still there. Need to remember to breathe and that preparation is the antidote to this specific flavor of dread.",
  },
  {
    id: "preview-entry-3",
    daysAgo: 5,
    mood: 5,
    tags: ["connection"],
    text: "An unexpected rainstorm caught us on the way back from dinner. Instead of rushing, we just walked in it. Sometimes the best moments are the ones you can't plan for.",
  },
  {
    id: "preview-entry-4",
    daysAgo: 9,
    mood: 3,
    tags: ["growth"],
    text: "The hardest part of starting over isn't the blank page, it's letting go of the draft you thought you were supposed to write. Today feels heavy, but necessary.",
  },
  {
    id: "preview-entry-5",
    daysAgo: 40,
    mood: 2,
    tags: ["growth"],
    text: "Everything feels so overwhelming lately, like I can't catch my breath or figure out what matters most right now.",
  },
];

let entriesPromise: Promise<EntryMetadata[]> | null = null;

export function getPreviewEntries(): Promise<EntryMetadata[]> {
  if (!entriesPromise) {
    entriesPromise = (async () => {
      const dek = await getPreviewDek();
      const now = Date.now();
      const rows = await Promise.all(
        ENTRY_FIXTURES.map(async (f) => {
          const { ciphertext, iv } = await encryptText(f.text, dek);
          const createdAt = new Date(now - f.daysAgo * 86400000).toISOString();
          return {
            id: f.id,
            created_at: createdAt,
            updated_at: createdAt,
            mood_score: f.mood,
            tags: f.tags,
            encrypted_content: ciphertext,
            iv,
          } satisfies EntryMetadata;
        }),
      );
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    })();
  }
  return entriesPromise;
}

const MANIFESTATION_FIXTURES: {
  id: string;
  category: string;
  cadence: ManifestationRow["cadence"];
  signalCount: number;
  text: string;
}[] = [
  { id: "preview-manifestation-1", category: "Health", cadence: "weekly", signalCount: 3, text: "Cultivate a daily practice of mindful movement and deep restorative rest." },
  { id: "preview-manifestation-2", category: "Career", cadence: "ai_decides", signalCount: 0, text: "Transition into a leadership role focused on empathetic team building." },
  { id: "preview-manifestation-3", category: "Mindset", cadence: "monthly", signalCount: 12, text: "Rebuild my relationship with creative writing, without the pressure to publish." },
];

let manifestationsPromise: Promise<ManifestationRow[]> | null = null;

export function getPreviewManifestations(): Promise<ManifestationRow[]> {
  if (!manifestationsPromise) {
    manifestationsPromise = (async () => {
      const dek = await getPreviewDek();
      return Promise.all(
        MANIFESTATION_FIXTURES.map(async (f, i) => {
          const { ciphertext, iv } = await encryptText(f.text, dek);
          return {
            id: f.id,
            created_at: new Date(Date.now() - i * 86400000).toISOString(),
            category: f.category,
            cadence: f.cadence,
            auto_detect: true,
            status: "active",
            encrypted_text: ciphertext,
            iv,
            manifestation_signals: [{ count: f.signalCount }],
          } satisfies ManifestationRow;
        }),
      );
    })();
  }
  return manifestationsPromise;
}

export function getPreviewKeyMaterial(): KeyMaterialRow {
  const fake = "preview";
  return {
    user_id: "preview-user",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    wrapped_dek: fake,
    wrapped_dek_iv: fake,
    wrapped_dek_salt: fake,
    wrapped_dek_recovery: fake,
    wrapped_dek_recovery_iv: fake,
    wrapped_dek_recovery_salt: fake,
  };
}

export function getPreviewNotificationPrefs(): NotificationPrefs {
  return {
    daily_prompt_enabled: true,
    daily_prompt_time: "20:30:00",
    playback_ready_enabled: true,
    manifestation_enabled: false,
  };
}

export function getPreviewDailyPrompt(): { prompt: string; tone: string } {
  return { prompt: "What made you feel capable today?", tone: "friend" };
}

export function getPreviewPlaybackNarrative(): PlaybackNarrative {
  return {
    headline: "The shape of your week.",
    moodTrendSummary: "A subtle shift towards tranquility.",
    highlightQuote: ENTRY_FIXTURES[0].text.slice(0, 120),
    highlightDate: "Today",
    letter: "The hardest part of starting over isn't the blank page, it's letting go of the draft you thought you were supposed to write. Today feels heavy, but necessary.",
  };
}
