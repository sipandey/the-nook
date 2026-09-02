# Real-browser embedding performance spike — results

Ran 2026-08-25. See `docs/ROADMAP.md` NK-14, and the embedding-quality
spike's own stated gap (`docs/spikes/embedding-quality/RESULTS.md`,
"What this spike does *not* answer"): that spike measured `Xenova/all-MiniLM-L12-v2`
via Node's `onnxruntime-node` backend on 20 entries — real embedding
*quality*, but neither real-browser inference *speed* (WASM, not Node)
nor retrieval behavior at a realistic entry count (1,000+). This spike
answers those two, in a real browser, against the app's actual shipped
code path — not a synthetic reproduction of it.

## What this is, and isn't

**Is:** the real `/search` page, the real `useSemanticSearch` hook, the
real `embed.worker.ts` (browser WASM via `@huggingface/transformers`,
not Node), the real `vectorStore.ts` (real IndexedDB, real AES-GCM
encrypt/decrypt with a real DEK), driven end-to-end through the actual
UI in a real browser (this session's Browser pane) against 1,005 real
entries (5 the app's existing preview fixtures already ship, ~1,000
synthetic ones added *temporarily* to `src/lib/preview.ts` for this
measurement and reverted immediately after — confirmed via `git diff`
showing no residual change).

**Isn't:** a measurement on an actual low-end phone. This session's
tools don't provide access to a physical device, and no CPU-throttling
capability was available to approximate one. This spike measures real
browser WASM performance on this sandbox's own hardware — a real,
meaningful upgrade over the prior Node-only number, but device-tier
extrapolation (what this looks like on the actual low-end Android
phones and older iPhones real users carry) remains genuinely
unmeasured. Stated plainly rather than glossed over, matching this
project's own established pattern for exactly this kind of gap (e.g.
NK-09's "needs a human," several Sentry-verification caveats).

## Method

1,005 entries indexed via the real "Enable Smart Search" flow (model
download → sequential decrypt → embed → encrypt → IndexedDB write, per
entry, exactly as `useSemanticSearch.ts`'s `indexEntries` does it for a
real user). Progress polled via the UI's own "Indexing your entries — N
of 1005" text at spaced intervals, timestamped with `Date.now()`.

Once indexed, three realistic queries were run — each deliberately
avoiding its target entry's vocabulary, the same "test genuine semantic
matching, not keyword overlap" principle the original quality spike
used — timed *within a single script execution* via `performance.now()`
bracketing an in-page poll loop, not across separate tool calls: this
session had already hit, and documented, the fact that separate
browser-automation tool calls in this sandbox carry several seconds of
their own round-trip overhead (see `.agent-room/decisions.md`'s
2026-08-25 auto-lock entry) — measuring search latency as "time between
two separate tool calls" would have silently included that overhead as
if it were app latency. Bracketing the whole operation inside one
`javascript_exec` call avoids that contamination entirely.

## Results

**Model download + init (one-time, cached after — not a per-entry
cost):** ~35 seconds cold, on this environment's network/hardware.

**Indexing throughput (decrypt + embed + encrypt + IndexedDB write,
per entry, browser WASM):** averaged **~590ms/entry** across 889 real
entries post-model-load (baseline entry 3 → entry 892). Not flat: the
first several entries ran markedly slower (~2,085ms for the earliest
window measured, entries 3→12) before settling into a ~450–620ms/entry
steady state by roughly entry 100 onward — consistent with WASM
JIT/runtime warmup, not a sign of degrading performance at scale (the
rate did not trend upward as the run progressed).

**Total wall-clock time to index all 1,005 entries, end-to-end,
including the one-time model download:** ~11 minutes.

**Important scope note:** this ~590ms/entry figure is the *whole
per-entry pipeline* — decrypt, embed, encrypt, and an IndexedDB write —
not raw model inference alone. It is not directly comparable to the
quality spike's Node figure (7.4ms/entry, embed-only, no
encrypt/decrypt/storage). This spike did not isolate the worker's own
`embed()` call time from the rest of the pipeline; that specific
narrower number remains unmeasured. The ~590ms figure is arguably the
more directly useful one regardless, since it's what a real user
actually experiences during indexing — but it should not be read as "the
model is 590ms/entry" on its own.

**Retrieval/query latency at 1,005 indexed entries:** three real
queries, each timed end-to-end (query embed + full IndexedDB read +
per-vector decrypt + cosine similarity + sort over all 1,005 stored
vectors, plus the UI's own debounce margin):

| Query | Total latency | Correct match found |
|---|---|---|
| "a moment I couldn't have planned for" | 2,156ms | Yes — the rainstorm entry |
| "worried about money and the future" | 1,611ms | Yes — the overwhelm entry |
| "reconnecting with an old friend" | 2,036ms | Yes — the "called an old friend" entry |

Average: **~1.9 seconds per query** at this scale. All three retrievals
were semantically correct despite the same deliberate vocabulary
mismatch the quality spike tested for — relevance held up at 1,005
entries, on this admittedly small (n=3) sample.

**A real, previously-unstated claim this surfaces:** the app's own
Smart Search onboarding copy (`src/app/(app)/search/page.tsx`) currently
says *"After that, search is instant."* At 1,005 entries, it measurably
isn't — ~1.9s is perceptible, not instant. This is a genuine finding
worth acting on, separate from the device-tier question: the copy is a
factual claim that stops being true well before 1,000 entries, on
hardware better than what most users will actually have.

## Verdict

**Real-browser WASM embedding works correctly and produces relevant
results at 1,000+ entries — go, with two real follow-ups, not
blockers.** The core mechanism (client-side, worker-isolated, browser
WASM) functions as designed at scale; nothing here suggests it's broken
or unusable. Two things are worth doing, separately from this spike:

1. **Fix the "instant" claim** in `search/page.tsx`'s onboarding copy —
   a small, concrete, low-risk fix (soften the wording, or state a more
   honest expectation) that this spike directly surfaced.
2. **Real low-end-device validation remains a genuinely open gap.**
   This spike closes the "Node vs. browser" and "20 entries vs. 1,000+"
   parts of NK-14's original concern with real measurements; it cannot
   close the "actual low-end phone" part without access to one. A
   sensible next step, if this matters enough to prioritize, is testing
   on a real budget Android device or an older iPhone before treating
   Smart Search's performance at scale as fully validated.
