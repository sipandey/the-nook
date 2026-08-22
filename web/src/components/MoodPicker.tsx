"use client";

export const MOOD_OPTIONS: { value: number; color: string; label: string }[] = [
  { value: 1, color: "bg-mood-rose", label: "Struggling" },
  { value: 2, color: "bg-mood-rose", label: "Low" },
  { value: 3, color: "bg-mood-ochre", label: "Steady" },
  { value: 4, color: "bg-mood-sage", label: "Good" },
  { value: 5, color: "bg-mood-sage", label: "Great" },
];

export function MoodPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-3">
      {MOOD_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-label={opt.label}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm flex items-center justify-center ${
              active ? "border-primary" : "border-transparent"
            }`}
          >
            <div className={`rounded-full ${opt.color} ${active ? "w-6 h-6" : "w-5 h-5 opacity-60"}`} />
          </button>
        );
      })}
    </div>
  );
}
