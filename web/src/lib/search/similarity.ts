/** Plain cosine similarity — deliberately no dependency on the embedding
 *  worker or any ML library. Runs on already-computed vectors, main
 *  thread; cheap enough at personal-journal scale (a few hundred–low
 *  thousand entries) that it doesn't need a worker of its own — see
 *  docs/ARCHITECTURE.md §10.3. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
