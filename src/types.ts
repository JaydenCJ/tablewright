/**
 * Core data model shared by every tablewright module.
 *
 * A `Table` is deliberately plain: three parallel structures with no
 * methods, so parsing, formatting, sorting, editing and conversion can all
 * be pure functions over the same value.
 */

/** Column alignment as declared in a pipe table's delimiter row. */
export type Alignment = "left" | "center" | "right" | "none";

/** A parsed pipe table: one header row, per-column alignment, body rows. */
export interface Table {
  /** Header cell texts. Escaped pipes (`\|`) are decoded to literal `|`. */
  header: string[];
  /** Per-column alignment; always the same length as `header`. */
  alignments: Alignment[];
  /** Body rows; every row is padded to the same length as `header`. */
  rows: string[][];
}

/** A table located inside a Markdown document. */
export interface TableBlock {
  /** Index of the first table line (the header row), 0-based. */
  start: number;
  /** Index one past the last table line (exclusive). */
  end: number;
  /** Leading whitespace shared by the table (at most three spaces). */
  indent: string;
  /** The parsed table. */
  table: Table;
}

/** A cell address: `row` 0 is the header row, 1..n are body rows. */
export interface CellAddress {
  /** Column index, 0-based (`A` = 0). */
  col: number;
  /** Row number: 0 = header, 1 = first body row. */
  row: number;
}

/** Sort comparators supported by `sortTable`. */
export type SortMode = "auto" | "numeric" | "natural" | "string";

/** Options for `sortTable`. */
export interface SortOptions {
  /** Comparator; `auto` picks numeric when the whole column is numeric. */
  mode?: SortMode;
  /** Sort descending. Empty cells sort last in both directions. */
  descending?: boolean;
}
