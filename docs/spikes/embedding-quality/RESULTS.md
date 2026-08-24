# Embedding quality spike — results

Ran 2026-08-24. See docs/ARCHITECTURE.md §10.5 step 3 and §10.6.10 — this
spike exists to answer one question before any storage schema or search UI
gets built: **is a small, in-browser-capable embedding model good enough
for journal search, or does the feature need OpenAI's embeddings API
(§10.3 option B) instead?**

## Method

20 realistic journal-style entries (`entries.mjs`) — 5 reused verbatim from
`web/src/lib/preview.ts`'s fixtures, 15 written to cover a wider spread of
topics and moods (grief, money anxiety, small joys, self-doubt, quitting a
job, parenting, insomnia, ...). 12 search queries, each written to
deliberately avoid the target entry's vocabulary (e.g. query "quitting a
job" against an entry that says "handed in my notice") — the point is
testing genuine semantic matching, not keyword overlap, since keyword
overlap doesn't need an embedding model at all.

Two quantized (q8 ONNX, the weight format transformers.js actually ships
to a browser) candidate models, run via `@huggingface/transformers` in
Node — same model weights and tokenizer a browser would use via
`onnxruntime-web`, so the *quality* result transfers directly even though
raw inference speed in a real browser (WASM/WebGL) wasn't measured here.

```bash
cd docs/spikes/embedding-quality
npm install
npm run spike
```

## Results

| Model | Quantized size | Load time (cold) | Embed speed | Top-1 accuracy | Top-3 accuracy |
|---|---|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2` | ~23 MB | 6.1s | 4.5ms/entry | 7/12 (58%) | 10/12 (83%) |
| `Xenova/all-MiniLM-L12-v2` | ~34 MB | 7.9s | 7.4ms/entry | 9/12 (75%) | **12/12 (100%)** |

L6 missed badly on "quitting a job" (expected entry ranked 12th of 20 —
essentially uncorrelated) and ranked "a small act of kindness from a
stranger" 4th. L12 fixed both — every one of the 12 queries retrieved its
intended entry within the top 3, most at rank 1, despite none of the
queries sharing vocabulary with their target entry.

## Verdict

**Go, with L12 over L6.** 100% top-3 retrieval on deliberately
vocabulary-disjoint queries is a strong result for a personal-journal
search feature, where a user browsing 2-3 results is the realistic
interaction, not expecting a single perfect top hit. The size/speed cost
of L12 over L6 (34MB vs 23MB, ~7.4ms vs ~4.5ms per entry) is small next to
the quality gap, and both are well within what a lazy-loaded, cached
(§10.6.7) model can absorb.

This validates §10.4's recommendation (client-side embeddings, option A) —
proceed to building the real feature rather than falling back to
OpenAI-embeddings (option B).

## What this spike does *not* answer

- **Real-browser performance.** Node's `onnxruntime-node` backend isn't
  the same runtime as a browser's WASM/WebGL backend — embedding quality
  transfers (same weights/tokenizer), inference *speed* on a real device,
  especially a lower-end phone, doesn't. §10.6.7's Web Worker + lazy-load
  recommendations still apply and should be validated against an actual
  mobile device before shipping, not assumed from this number.
- **Larger-scale retrieval.** 20 entries is enough to test relevance
  ranking, not enough to say anything about accuracy or perceived latency
  at hundreds–thousands of entries. The linear cosine-similarity scan
  described in §10.3 should still be fine at that scale (it's simple
  arithmetic over already-computed vectors, not re-embedding), but wasn't
  load-tested here.
- **Non-English or heavily colloquial/abbreviated text.** All 20 entries
  here are standard written English. §10.6.10's caution about MiniLM-class
  models being weaker outside their benchmark domain is only partially
  addressed — this result is a green light for English journaling text
  specifically, not a general guarantee.
