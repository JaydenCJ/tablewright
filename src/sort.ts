/**
 * Sorting table body rows by a column.
 *
 * Four comparators: `numeric` (locale-independent number parsing that
 * tolerates thousands separators, a leading currency sign and a trailing
 * `%`), `natural` (digit runs compare as numbers, so `v10` follows `v9`),
 * `string` (raw code-unit order), and the default `auto`, which picks
 * `numeric` when every non-empty cell in the column parses as a number
 * and `natural` otherwise.
 *
 * Two invariants hold in every mode: the sort is stable (ties keep their
 * original order), and empty cells sink to the bottom regardless of
 * direction — nobody sorts a price column to see the blanks first.
 */

import type { SortMode, SortOptions, Table } from "./types.js";

/**
 * Parse a cell as a number, or return `null` if it is not one.
 * Accepts `-1,234.5`, `$99`, `1_000_000`, `42%`, `1.5e3`.
 */
export function parseNumeric(text: string): number | null {
  let s = text.trim();
  if (s === "") return null;
  s = s.replace(/^[$€£¥]\s?/, ""); // $ € £ ¥
  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1).trim();
  }
  s = s.replace(/[,_](?=\d)/g, ""); // thousands separators
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return percent ? n / 100 : n;
}

/** Compare two digit runs numerically without overflowing on long runs. */
function compareDigits(a: string, b: string): number {
  const as = a.replace(/^0+(?=\d)/, "");
  const bs = b.replace(/^0+(?=\d)/, "");
  if (as.length !== bs.length) return as.length - bs.length;
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * Natural, case-insensitive comparison: digit runs compare as numbers,
 * everything else by code units. Fully tie-broken by the raw strings so
 * results never depend on the host locale.
 */
export function naturalCompare(a: string, b: string): number {
  const ax = a.toLowerCase().split(/(\d+)/);
  const bx = b.toLowerCase().split(/(\d+)/);
  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const ac = ax[i]!;
    const bc = bx[i]!;
    if (ac === bc) continue;
    // Odd indices are the captured digit runs.
    if (i % 2 === 1) {
      const d = compareDigits(ac, bc);
      if (d !== 0) return d;
    }
    return ac < bc ? -1 : 1;
  }
  if (ax.length !== bx.length) return ax.length - bx.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Compare two non-empty cell values under a concrete (non-auto) mode. */
export function compareCells(a: string, b: string, mode: SortMode): number {
  if (mode === "numeric") {
    const na = parseNumeric(a);
    const nb = parseNumeric(b);
    if (na !== null && nb !== null) return na < nb ? -1 : na > nb ? 1 : 0;
    if (na !== null) return -1; // numbers before stray text
    if (nb !== null) return 1;
    return naturalCompare(a, b);
  }
  if (mode === "string") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return naturalCompare(a, b);
}

/**
 * The comparator `auto` resolves to for a column: `numeric` iff the
 * column has at least one non-empty cell and all of them parse as
 * numbers, else `natural`.
 */
export function detectMode(table: Table, col: number): SortMode {
  let sawValue = false;
  for (const row of table.rows) {
    const cell = (row[col] ?? "").trim();
    if (cell === "") continue;
    sawValue = true;
    if (parseNumeric(cell) === null) return "natural";
  }
  return sawValue ? "numeric" : "natural";
}

/** Sort a table's body rows by column `col`; returns a new table. */
export function sortTable(
  table: Table,
  col: number,
  options: SortOptions = {},
): Table {
  if (col < 0 || col >= table.header.length) {
    throw new Error(`column index ${col} is out of range`);
  }
  const requested = options.mode ?? "auto";
  const mode = requested === "auto" ? detectMode(table, col) : requested;
  const desc = options.descending ?? false;

  const decorated = table.rows.map((row, index) => ({
    row,
    index,
    key: (row[col] ?? "").trim(),
  }));
  decorated.sort((x, y) => {
    const xEmpty = x.key === "";
    const yEmpty = y.key === "";
    if (xEmpty || yEmpty) {
      if (xEmpty && yEmpty) return x.index - y.index;
      return xEmpty ? 1 : -1; // empties last, even descending
    }
    const c = compareCells(x.key, y.key, mode);
    const d = desc ? -c : c;
    return d !== 0 ? d : x.index - y.index; // stable
  });
  return { ...table, rows: decorated.map((d) => d.row) };
}
