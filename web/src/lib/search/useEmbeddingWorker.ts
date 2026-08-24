"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WorkerResponse =
  | { kind: "progress"; progress: number }
  | { kind: "ready" }
  | { kind: "embedded"; requestId: string; vector: number[] }
  | { kind: "error"; requestId: string; message: string };

/**
 * Main-thread handle to the embedding worker (src/lib/search/embed.worker.ts).
 * Creates the worker lazily — not on mount, only on the first call to
 * `embed()` — so simply visiting the search screen never triggers the
 * ~34MB model download; only actually using search does (§10.6.7).
 */
export function useEmbeddingWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (v: number[]) => void; reject: (e: Error) => void }>>(
    new Map(),
  );
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      const worker = new Worker(new URL("./embed.worker.ts", import.meta.url));
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.kind === "progress") {
          setModelProgress(msg.progress);
        } else if (msg.kind === "ready") {
          setModelReady(true);
          setModelProgress(1);
        } else if (msg.kind === "embedded") {
          pendingRef.current.get(msg.requestId)?.resolve(msg.vector);
          pendingRef.current.delete(msg.requestId);
        } else if (msg.kind === "error") {
          pendingRef.current.get(msg.requestId)?.reject(new Error(msg.message));
          pendingRef.current.delete(msg.requestId);
        }
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  const embed = useCallback(
    (text: string): Promise<number[]> => {
      const worker = getWorker();
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        pendingRef.current.set(requestId, { resolve, reject });
        worker.postMessage({ kind: "embed", requestId, text });
      });
    },
    [getWorker],
  );

  return { embed, modelProgress, modelReady };
}
