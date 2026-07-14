/**
 * Monospace display-width computation.
 *
 * Pipe tables only look aligned when the byte padding matches what a
 * monospace font actually renders. East Asian Wide and Fullwidth code
 * points occupy two columns; combining marks, variation selectors and
 * zero-width characters occupy none. This module is the single source of
 * truth for "how wide is this cell" — the formatter never calls
 * `String.length` directly.
 */

type Range = readonly [number, number];

/** Code points that render at zero width in a monospace terminal. */
const ZERO_WIDTH: readonly Range[] = [
  [0x0300, 0x036f], // combining diacritical marks
  [0x0483, 0x0489], // Cyrillic combining marks
  [0x0591, 0x05bd], // Hebrew points
  [0x0610, 0x061a], // Arabic marks
  [0x064b, 0x065f], // Arabic diacritics
  [0x0e31, 0x0e31], // Thai vowel above
  [0x0e34, 0x0e3a], // Thai vowels/tones
  [0x1ab0, 0x1aff], // combining extended
  [0x1dc0, 0x1dff], // combining supplement
  [0x200b, 0x200f], // zero-width space/joiners, directional marks
  [0x202a, 0x202e], // directional embedding
  [0x2060, 0x2064], // word joiner, invisible operators
  [0x20d0, 0x20f0], // combining marks for symbols
  [0x3099, 0x309a], // combining kana voicing marks
  [0xfe00, 0xfe0f], // variation selectors
  [0xfeff, 0xfeff], // zero-width no-break space / BOM
  [0xe0100, 0xe01ef], // variation selectors supplement
];

/** Code points that render at double width (East Asian Wide/Fullwidth). */
const WIDE: readonly Range[] = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2e80, 0x303e], // CJK radicals .. CJK symbols and punctuation
  [0x3041, 0x33ff], // Hiragana .. CJK compatibility
  [0x3400, 0x4dbf], // CJK extension A
  [0x4e00, 0x9fff], // CJK unified ideographs
  [0xa000, 0xa4cf], // Yi syllables
  [0xa960, 0xa97f], // Hangul Jamo extended-A
  [0xac00, 0xd7a3], // Hangul syllables
  [0xf900, 0xfaff], // CJK compatibility ideographs
  [0xfe10, 0xfe19], // vertical forms
  [0xfe30, 0xfe6f], // CJK compatibility forms, small form variants
  [0xff00, 0xff60], // fullwidth forms
  [0xffe0, 0xffe6], // fullwidth signs
  [0x1f300, 0x1f64f], // emoji: symbols and pictographs, emoticons
  [0x1f680, 0x1f6ff], // emoji: transport and map symbols
  [0x1f900, 0x1f9ff], // emoji: supplemental symbols
  [0x20000, 0x2fffd], // CJK extensions B..F
  [0x30000, 0x3fffd], // CJK extension G
];

function inRanges(cp: number, ranges: readonly Range[]): boolean {
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
    if (cp < lo) return false; // ranges are sorted ascending
  }
  return false;
}

/** Display width of a single code point: 0, 1 or 2 columns. */
export function charWidth(codePoint: number): number {
  // Control characters never reach the formatter, but width 0 keeps the
  // arithmetic sane if one slips through in cell text.
  if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  if (inRanges(codePoint, ZERO_WIDTH)) return 0;
  if (inRanges(codePoint, WIDE)) return 2;
  return 1;
}

/** Display width of a string in monospace columns. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch.codePointAt(0)!);
  return width;
}
