import { MATERIAL_SYMBOL_CODEPOINTS } from "@/lib/materialSymbolsCodepoints";

/**
 * Thin wrapper over a self-hosted, subsetted Material Symbols font — see
 * src/lib/materialSymbolsCodepoints.ts for why this renders a looked-up
 * PUA character instead of the icon's literal name (the usual way to use
 * this font): the subsetted font only carries glyphs for the codepoints
 * actually used, not the ligature-substitution tables that would be
 * needed to turn literal text like "arrow_back" into a glyph.
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
  const glyph = MATERIAL_SYMBOL_CODEPOINTS[name];
  if (!glyph && process.env.NODE_ENV !== "production") {
    console.warn(
      `MaterialIcon: "${name}" has no entry in materialSymbolsCodepoints.ts — add it and re-subset the font.`,
    );
  }

  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
        fontSize: size ? `${size}px` : undefined,
      }}
      aria-hidden="true"
    >
      {glyph ?? name}
    </span>
  );
}
