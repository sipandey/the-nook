"use client";

export function MoodDots({
  value,
  onChange,
  size = 22,
}: {
  value: number | null;
  onChange: (value: number) => void;
  size?: number;
}) {
  return (
    <div className="flex gap-2.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          aria-label={`Mood ${v} of 5`}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          style={{ width: size, height: size }}
          className={`rounded-full border-[1.3px] transition-colors ${
            value === v ? "border-accent bg-accent" : "border-border bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
