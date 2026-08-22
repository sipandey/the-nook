"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

const BAR_COUNT = 40;

/**
 * Real microphone-driven waveform via AnalyserNode — not an animated
 * placeholder. Note this is batch transcription (record, then send the
 * whole clip to Whisper on "Done"), not the live word-by-word streaming
 * transcript shown in the mockup's transcribing state — Whisper's REST API
 * doesn't support incremental results; true live transcription would need
 * OpenAI's Realtime (WebSocket) API, which is a bigger swap than this pass
 * covers. The blurred lines during transcription are purely decorative
 * texture, not a claim that partial results exist.
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
        analyser.fftSize = 128;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        const step = Math.max(1, Math.floor(data.length / BAR_COUNT));

        function tick() {
          analyser.getByteFrequencyData(data);
          const next: number[] = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            next.push(4 + ((data[i * step] ?? 0) / 255) * 92);
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

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-error">{error}</p>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-primary">
          Back to writing
        </button>
      </div>
    );
  }

  if (status === "transcribing") {
    return (
      <>
        <header className="bg-surface w-full top-0 sticky flex items-center justify-between px-container-padding h-16">
          <span className="w-10" />
          <h1 className="font-editorial-display text-headline-md text-primary text-center flex-1">New Entry</h1>
          <span className="w-10" />
        </header>

        <main className="flex-1 flex flex-col px-container-padding py-stack-gap">
          <div className="flex flex-col items-center justify-center mt-12 mb-16 gap-inline-gap">
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              <div className="absolute inset-0 bg-primary-fixed rounded-full animate-pulse opacity-50 blur-md" />
              <div className="absolute inset-2 bg-primary-container rounded-full animate-pulse" />
              <div className="relative w-6 h-6 bg-primary rounded-full shadow-sm" />
            </div>
            <h2 className="font-editorial-display text-headline-lg-mobile text-on-surface text-center">
              Transcribing…
            </h2>
            <p className="text-body-md text-on-surface-variant text-center opacity-80 animate-pulse">
              Stitching your thoughts together…
            </p>
          </div>

          <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col gap-2 overflow-hidden relative" aria-hidden="true">
            <div className="text-body-lg text-surface-tint blur-[4px] space-y-4 px-4 select-none">
              <p>The morning light caught the edges of the room in a way that felt entirely new.</p>
              <p className="w-10/12">A slight shift in perspective can reveal details previously ignored.</p>
              <p className="w-8/12">Silence often carries more weight than words.</p>
            </div>
          </div>
        </main>

        <footer className="w-full pb-8 pt-4 px-container-padding flex justify-center items-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full">
            <MaterialIcon name="lock" size={16} className="text-outline" />
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Processed securely, never stored
            </span>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <header className="bg-surface w-full top-0 sticky flex items-center justify-between px-container-padding h-16">
        <button
          type="button"
          onClick={cancel}
          aria-label="Close"
          className="text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors"
        >
          <MaterialIcon name="close" />
        </button>
        <h1 className="font-editorial-display text-headline-md text-primary">Voice Entry</h1>
        <span className="w-10" />
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-container-padding">
        <div className="mb-12">
          <h2 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary text-center tabular-nums">
            {mm}:{ss}
          </h2>
        </div>

        <div className="h-32 w-full max-w-md flex items-center justify-center gap-[3px] mb-16" aria-hidden="true">
          {levels.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={`w-1 rounded-full transition-[height] duration-100 ${
                paused ? "bg-outline-variant" : "bg-primary"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between w-full max-w-sm gap-inline-gap">
          <button
            type="button"
            onClick={cancel}
            className="text-label-sm text-on-surface-variant hover:text-on-surface transition-colors py-2 px-4"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={togglePause}
            className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
          >
            <MaterialIcon name={paused ? "play_arrow" : "pause"} filled size={30} />
          </button>

          <button
            type="button"
            onClick={finish}
            className="text-label-sm text-primary hover:text-primary-fixed transition-colors py-2 px-4 font-bold"
          >
            Done
          </button>
        </div>
      </main>

      <footer className="py-6 px-container-padding flex items-center justify-center w-full">
        <div className="flex items-center gap-2 text-on-surface-variant opacity-80">
          <MaterialIcon name="lock" size={16} />
          <span className="text-label-sm">Processed securely, never stored</span>
        </div>
      </footer>
    </>
  );
}
