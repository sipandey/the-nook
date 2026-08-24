/// <reference lib="webworker" />

/**
 * Embedding worker — the only place the ML model runs. See
 * docs/ARCHITECTURE.md §10.3/§10.6.7.
 *
 * Deliberately never touches IndexedDB, the DEK, or any Supabase/network
 * call: its only job is "turn text into a vector," same scoping
 * discipline as src/lib/ai/openai.ts ("talk to OpenAI, return content").
 * Decryption of entries and encryption of resulting vectors happens on
 * the main thread, which is where the DEK lives.
 *
 * Model choice (Xenova/all-MiniLM-L12-v2, not the smaller/more commonly
 * defaulted-to L6 variant) is the validated result of the spike at
 * docs/spikes/embedding-quality/ — see RESULTS.md. transformers.js caches
 * the downloaded model in the browser's Cache API by default, so this
 * ~34MB download only happens once per browser, not once per session —
 * this file never triggers it on load; it only runs when the main thread
 * posts the first embed request, which only happens after the user
 * explicitly opts in (see src/app/(app)/search/page.tsx) — lazy-loaded
 * and opt-in, per §10.6.7.
 */

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L12-v2";

type Request =
  | { kind: "embed"; requestId: string; text: string };

type Response =
  | { kind: "progress"; progress: number }
  | { kind: "ready" }
  | { kind: "embedded"; requestId: string; vector: number[] }
  | { kind: "error"; requestId: string; message: string };

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL, {
      progress_callback: (event: { status: string; progress?: number }) => {
        if (event.status === "progress" && typeof event.progress === "number") {
          post({ kind: "progress", progress: event.progress });
        }
      },
    }) as Promise<FeatureExtractionPipeline>;
    extractorPromise.then(() => post({ kind: "ready" }));
  }
  return extractorPromise;
}

function post(message: Response) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  if (msg.kind !== "embed") return;

  try {
    const extractor = await getExtractor();
    const output = await extractor(msg.text, { pooling: "mean", normalize: true });
    const vector = Array.from(output.data as Float32Array);
    post({ kind: "embedded", requestId: msg.requestId, vector });
  } catch (err) {
    post({
      kind: "error",
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : "embedding failed",
    });
  }
};
