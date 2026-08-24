// Embedding-quality spike for The Nook's proposed semantic search feature.
// See docs/ARCHITECTURE.md §10.5 step 3 / §10.6.10. Throwaway tooling, not
// part of the app — validates whether a small in-browser-capable model is
// good enough before any storage schema or search UI gets built.
import { pipeline, cos_sim } from "@huggingface/transformers";
import { ENTRIES, QUERIES } from "./entries.mjs";

// Candidate models: sizes are the quantized (q8) ONNX weights actually
// shipped to the browser by transformers.js, not the full fp32 checkpoint.
const MODELS = [
  { name: "Xenova/all-MiniLM-L6-v2", approxSizeMB: 23 },
  { name: "Xenova/all-MiniLM-L12-v2", approxSizeMB: 34 },
];

async function embedAll(extractor, texts) {
  const out = [];
  for (const text of texts) {
    const result = await extractor(text, { pooling: "mean", normalize: true });
    out.push(Array.from(result.data));
  }
  return out;
}

async function runModel(modelName) {
  console.log(`\n${"=".repeat(70)}\nModel: ${modelName}\n${"=".repeat(70)}`);
  const t0 = Date.now();
  const extractor = await pipeline("feature-extraction", modelName);
  const loadMs = Date.now() - t0;

  const t1 = Date.now();
  const entryVectors = await embedAll(
    extractor,
    ENTRIES.map((e) => e.text),
  );
  const embedMs = Date.now() - t1;
  console.log(
    `Loaded in ${loadMs}ms. Embedded ${ENTRIES.length} entries in ${embedMs}ms (${(embedMs / ENTRIES.length).toFixed(1)}ms/entry avg).`,
  );

  let top1Hits = 0;
  let top3Hits = 0;

  for (const { query, expected } of QUERIES) {
    const [queryVec] = await embedAll(extractor, [query]);
    const scored = ENTRIES.map((e, i) => ({
      id: e.id,
      score: cos_sim(queryVec, entryVectors[i]),
    })).sort((a, b) => b.score - a.score);

    const rank = scored.findIndex((s) => s.id === expected) + 1;
    if (rank === 1) top1Hits++;
    if (rank <= 3) top3Hits++;

    const top3 = scored
      .slice(0, 3)
      .map((s) => `${s.id}${s.id === expected ? "*" : " "} (${s.score.toFixed(3)})`)
      .join("  ");
    console.log(
      `[${rank <= 3 ? "OK " : "MISS"}] "${query}" → expected ${expected}, rank ${rank}\n        top3: ${top3}`,
    );
  }

  console.log(
    `\n${modelName}: top-1 ${top1Hits}/${QUERIES.length}, top-3 ${top3Hits}/${QUERIES.length}`,
  );
}

for (const { name } of MODELS) {
  await runModel(name);
}
