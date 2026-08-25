/**
 * Icon-name → PUA-codepoint map for src/components/MaterialIcon.tsx.
 *
 * Google's Material Symbols font is normally used by rendering the
 * literal icon name as text (e.g. "arrow_back") and letting an OpenType
 * ligature substitution (the `rlig`/`rclt` features) turn that text into
 * the glyph. That only works against the *full* font — subsetting by
 * ligature-closure was tried first and barely shrank the file (6597 →
 * 5851 glyphs out of a 3.96MB variable font), because the contextual
 * substitution graph pyftsubset has to conservatively close over is
 * shared across virtually the entire icon set, not just the icons
 * actually referenced.
 *
 * Codepoint-based subsetting doesn't have that problem: Material Symbols
 * also maps every icon to a stable Private-Use-Area codepoint (source:
 * https://github.com/google/material-design-icons, the .codepoints file
 * for this font), and subsetting by exact `--unicodes=` is precise — no
 * GSUB closure involved. That's what src/app/fonts/material-symbols-outlined-subset.woff2
 * actually is: exactly the ~77 codepoints this app uses, subsetted from
 * the same variable font (FILL/GRAD/opsz/wght axes intact — MaterialIcon
 * still drives FILL via inline `font-variation-settings`), 3.96MB → 66KB.
 *
 * The trade-off this buys: MaterialIcon renders the PUA character looked
 * up here instead of the literal name text, and this map — plus the
 * subsetted font file — has to be regenerated if a new icon name is ever
 * introduced. To add one: look up its codepoint in Google's .codepoints
 * file above, add it below, then re-run the subsetting step recorded in
 * `.agent-room/decisions.md`'s 2026-08-25 "self-host and subset Material
 * Symbols" entry.
 */
export const MATERIAL_SYMBOL_CODEPOINTS: Record<string, string> = {
  account_circle: "\u{f20b}",
  add: "\u{e145}",
  arrow_back: "\u{e5c4}",
  arrow_forward: "\u{e5c8}",
  auto_awesome: "\u{e65f}",
  auto_delete: "\u{ea4c}",
  auto_stories: "\u{e666}",
  autorenew: "\u{e863}",
  book_5: "\u{f53b}",
  check: "\u{e668}",
  chevron_right: "\u{e5cc}",
  close: "\u{e5cd}",
  cloud_off: "\u{e2c1}",
  content_copy: "\u{e14d}",
  data_object: "\u{ead3}",
  database: "\u{f20e}",
  delete_forever: "\u{e92b}",
  download: "\u{f090}",
  eco: "\u{ea35}",
  edit: "\u{f097}",
  edit_document: "\u{f88c}",
  edit_note: "\u{e745}",
  enhanced_encryption: "\u{e63f}",
  error: "\u{f8b6}",
  expand_less: "\u{e5ce}",
  expand_more: "\u{e5cf}",
  favorite: "\u{e87e}",
  history: "\u{e8b3}",
  history_edu: "\u{ea3e}",
  home: "\u{e9b2}",
  hourglass_empty: "\u{e88b}",
  info: "\u{e88e}",
  insights: "\u{f092}",
  ios_share: "\u{e6b8}",
  key: "\u{e73c}",
  local_fire_department: "\u{ef55}",
  lock: "\u{e899}",
  lock_outline: "\u{e899}",
  lock_reset: "\u{eade}",
  logout: "\u{e9ba}",
  mail: "\u{e159}",
  menu_book: "\u{ea19}",
  mic: "\u{e31d}",
  mic_off: "\u{e02b}",
  more_vert: "\u{e5d4}",
  notifications: "\u{e7f5}",
  notifications_active: "\u{e7f7}",
  pause: "\u{e034}",
  phonelink_setup: "\u{f2d9}",
  play_arrow: "\u{e037}",
  play_circle: "\u{e1c4}",
  privacy_tip: "\u{f0dc}",
  progress_activity: "\u{e9d0}",
  psychiatry: "\u{e123}",
  psychology: "\u{ea4a}",
  refresh: "\u{e5d5}",
  schedule: "\u{efd6}",
  search: "\u{ef7a}",
  search_off: "\u{ea76}",
  security: "\u{e32a}",
  self_improvement: "\u{ea78}",
  sell: "\u{f05b}",
  send: "\u{e163}",
  settings: "\u{e8b8}",
  shield: "\u{e9e0}",
  shield_lock: "\u{f686}",
  smart_toy: "\u{f06c}",
  spa: "\u{eb4c}",
  sync: "\u{e627}",
  sync_problem: "\u{e629}",
  travel_explore: "\u{e2db}",
  trending_up: "\u{e8e5}",
  visibility: "\u{e8f4}",
  visibility_off: "\u{e8f5}",
  vpn_key: "\u{e0da}",
  warning: "\u{f083}",
  water_drop: "\u{e798}",
};
