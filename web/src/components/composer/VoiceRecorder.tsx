"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 15;

/**
 * Real microphone-driven waveform via AnalyserNode — not an animated
 * placeholder. Note this is batch transcription (record, then send the
 * whole clip to Whisper on "Done"), not the live word-by-word streaming
 * transcript shown in the EntryComposerVoice.dc.html mockup — Whisper's
 * REST API doesn't support incremental results; true live transcription
 * would need OpenAI's Realtime (WebSocket) API, which is a bigger swap
 * than this pass covers.
 */
export function VoiceRecorder({
  onTranscribed,
  onCancel,
}: {
  onTranscribed: (text: string) => void;
  onCancel: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(4));
  const [status, setStatus] = useState<"recording" | "transcribing" | "error">("recording");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const step = Math.max(1, Math.floor(data.length / BAR_COUNT));

        function tick() {
          analyser.getByteFrequencyData(data);
          const next: number[] = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            next.push(4 + ((data[i * step] ?? 0) / 255) * 48);
          }
          setLevels(next);
          rafRef.current = requestAnimationFrame(tick);
        }
        tick();

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();

        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch {
        setStatus("error");
        setError("Couldn't access your microphone.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      audioCtxRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopMedia() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (paused) {
      recorder.resume();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      recorder.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setPaused((p) => !p);
  }

  function cancel() {
    stopMedia();
    recorderRef.current?.stop();
    onCancel();
  }

  async function finish() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopMedia();

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    setStatus("transcribing");
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "entry.webm");
      const res = await fetch("/api/ai/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error("transcribe failed");
      const { text } = await res.json();
      onTranscribed(text);
    } catch {
      setStatus("error");
      setError("Couldn't transcribe that recording. Try again.");
    }
  }

  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, "0");

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-warn">{error}</p>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-accent">
          Back to writing
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-center gap-1.5 pt-3">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "transcribing" ? "bg-accent" : paused ? "bg-faint" : "bg-warn"
          }`}
        />
        <span className="text-[11px] font-semibold tracking-wide text-muted">
          {status === "transcribing" ? "TRANSCRIBING" : paused ? "PAUSED" : "RECORDING"}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="flex h-14 items-end gap-[3px]" aria-hidden="true">
          {levels.map((h, i) => (
            <div key={i} style={{ height: h }} className="w-1 rounded-full bg-accent" />
          ))}
        </div>
        <div className="font-mono text-2xl font-semibold tabular-nums">
          {mm}:{ss}
        </div>
      </div>

      <div className="flex items-center justify-center gap-7 pb-8 pt-3">
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel"
          className="flex h-11 w-11 items-center justify-center rounded-full border-[1.3px] border-border bg-surface text-foreground"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
          </svg>
        </button>
        <button
          type="button"
          onClick={finish}
          disabled={status === "transcribing"}
          aria-label="Done"
          className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-accent text-white disabled:opacity-60"
        >
          {status === "transcribing" ? (
            <svg
              viewBox="0 0 20 20"
              width="20"
              height="20"
              className="animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 3a7 7 0 1 0 7 7" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <rect x="6" y="6" width="8" height="8" rx="1.5" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={togglePause}
          aria-label={paused ? "Resume" : "Pause"}
          className="flex h-11 w-11 items-center justify-center rounded-full border-[1.3px] border-border bg-surface text-foreground"
        >
          {paused ? (
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="6" y="4.5" width="2.6" height="11" rx="1" />
              <rect x="11.4" y="4.5" width="2.6" height="11" rx="1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
