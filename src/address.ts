/**
 * Cell addresses and column references.
 *
 * Cells use spreadsheet-style addresses (`B2`): letters name the column
 * (`A` = first, `AA` = 27th), the number names the row, and **row 0 is
 * the header row** so headers are editable like any other cell.
 *
 * Wherever a command takes a *column* (sort `--by`, `--del-col`), the
 * reference is resolved in a fixed order so scripts stay predictable:
 * exact header text, case-insensitive header text, explicit `#N` index,
 * column letters, then a bare 1-based number. Header text wins over
 * letters, so a column literally named "B" is still reachable by name.
 */

import type { CellAddress, Table } from "./types.js";

/** Convert column letters to a 0-based index: A→0, Z→25, AA→26. */
export function columnLetterToIndex(letters: string): number {
  if (!/^[A-Za-z]+$/.test(letters)) {
    throw new Error(`invalid column letters "${letters}"`);
  }
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Convert a 0-based column index to letters: 0→A, 25→Z, 26→AA. */
export function indexToColumnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`invalid column index ${index}`);
  }
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Parse a strict cell address like `B2` (row 0 = header). */
export function parseAddress(text: string): CellAddress {
  const m = /^([A-Za-z]+)(\d+)$/.exec(text.trim());
  if (!m) {
    throw new Error(
      `invalid cell address "${text}" (expected column letters + row number, e.g. B2; row 0 is the header)`,
    );
  }
  return { col: columnLetterToIndex(m[1]!), row: parseInt(m[2]!, 10) };
}

/** What a loose reference points at: one cell, a whole row, or a column. */
export type Ref =
  | { kind: "cell"; address: CellAddress }
  | { kind: "row"; row: number }
  | { kind: "column"; ref: string };

/**
 * Classify a loose reference: `B2` is a cell, a bare number is a row,
 * anything else (letters, `#N`, header text) is a column reference to be
 * resolved against a concrete table.
 */
export function parseRef(text: string): Ref {
  const t = text.trim();
  if (/^[A-Za-z]+\d+$/.test(t)) {
    return { kind: "cell", address: parseAddress(t) };
  }
  if (/^\d+$/.test(t)) {
    return { kind: "row", row: parseInt(t, 10) };
  }
  return { kind: "column", ref: t };
}

/**
 * Resolve a column reference against a table (see module doc for the
 * resolution order). Throws with the available headers on failure.
 */
export function resolveColumn(table: Table, ref: string): number {
  const exact = table.header.indexOf(ref);
  if (exact !== -1) return exact;

  const lower = ref.toLowerCase();
  const insensitive = table.header.findIndex((h) => h.toLowerCase() === lower);
  if (insensitive !== -1) return insensitive;

  const cols = table.header.length;
  const hash = /^#(\d+)$/.exec(ref);
  if (hash) {
    const idx = parseInt(hash[1]!, 10) - 1;
    if (idx >= 0 && idx < cols) return idx;
    throw new Error(`column ${ref} is out of range (table has ${cols} column(s))`);
  }
  if (/^[A-Za-z]+$/.test(ref)) {
    const idx = columnLetterToIndex(ref);
    if (idx < cols) return idx;
  }
  if (/^\d+$/.test(ref)) {
    const idx = parseInt(ref, 10) - 1;
    if (idx >= 0 && idx < cols) return idx;
  }
  const names = table.header.map((h, i) => `${indexToColumnLetter(i)}="${h}"`);
  throw new Error(
    `cannot resolve column "${ref}"; available columns: ${names.join(", ")}`,
  );
}
