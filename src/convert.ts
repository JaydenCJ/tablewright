/**
 * Converting between the `Table` model and plain row data (CSV/TSV).
 *
 * Markdown cells cannot contain raw newlines, so the round-trip contract
 * is explicit: going *to* Markdown, newlines become `<br>`; going *from*
 * Markdown, `<br>` (and its `<br/>`, `<br />` variants) becomes `\n`.
 * A CSV field with an embedded newline therefore survives
 * csv → md → csv byte-for-byte.
 */

import type { Alignment, Table } from "./types.js";

/** Decode `<br>` variants to real newlines (Markdown → data direction). */
export function brToNewlines(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "\n");
}

/** Encode real newlines as `<br>` (data → Markdown direction). */
export function newlinesToBr(text: string): string {
  return text.replace(/\r\n|\r|\n/g, "<br>");
}

/** Flatten a table to rows (header first), decoding `<br>` to newlines. */
export function tableToRows(table: Table): string[][] {
  return [table.header, ...table.rows].map((row) => row.map(brToNewlines));
}

/**
 * Build a table from raw rows: the first row becomes the header, ragged
 * rows are padded, and newlines inside fields become `<br>`.
 */
export function rowsToTable(
  rows: string[][],
  alignments: Alignment[] = [],
): Table {
  if (rows.length === 0) {
    throw new Error("cannot build a table from zero rows");
  }
  let width = 1;
  for (const row of rows) width = Math.max(width, row.length);

  const normalized = rows.map((row) => {
    const cells = row.map(newlinesToBr);
    while (cells.length < width) cells.push("");
    return cells;
  });
  const aligns: Alignment[] = [];
  for (let i = 0; i < width; i++) aligns.push(alignments[i] ?? "none");
  return {
    header: normalized[0]!,
    alignments: aligns,
    rows: normalized.slice(1),
  };
}

const ALIGN_LETTERS: Record<string, Alignment> = {
  l: "left",
  c: "center",
  r: "right",
  n: "none",
  "-": "none",
};

/**
 * Parse an alignment spec for csv→md conversion: either compact letters
 * (`lrc`) or comma-separated (`left,right,center`). Letters are l/c/r
 * plus n or `-` for "no marker".
 */
export function parseAlignSpec(spec: string): Alignment[] {
  const parts = spec.includes(",")
    ? spec.split(",").map((p) => p.trim())
    : [...spec];
  return parts.map((part) => {
    const key = part.toLowerCase();
    if (key === "left" || key === "center" || key === "right" || key === "none") {
      return key;
    }
    const letter = ALIGN_LETTERS[key];
    if (letter === undefined) {
      throw new Error(
        `invalid alignment "${part}" (use l/c/r/n, e.g. --align lrc or --align left,right,center)`,
      );
    }
    return letter;
  });
}
