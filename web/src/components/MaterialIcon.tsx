/**
 * Thin wrapper over Google's Material Symbols icon font — used only in the
 * "editorial" screens (see layout.tsx's font-loading comment). Everywhere
 * else in the app still uses hand-drawn inline SVG icons; this isn't a
 * site-wide icon-system migration.
 */
export function MaterialIcon({
  name,
  className = "",
  filled = false,
  size,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
        fontSize: size ? `${size}px` : undefined,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
