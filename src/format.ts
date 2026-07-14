/**
 * Rendering a `Table` back to aligned Markdown.
 *
 * Output is canonical: leading and trailing pipes, one space of padding
 * inside each cell, delimiter dashes stretched to the column width, and
 * alignment colons preserved exactly as parsed. Rendering is idempotent —
 * formatting formatted output changes nothing (enforced by tests).
 */

import { displayWidth } from "./width.js";
import type { Alignment, Table } from "./types.js";

/** Minimum inner column width; `:-:` needs three characters. */
const MIN_WIDTH = 3;

/**
 * Encode a cell value for placement inside a pipe table: literal pipes
 * become `\|` and raw newlines become `<br>` so an edited cell can never
 * break the row structure.
 */
export function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function padCell(text: string, width: number, align: Alignment): string {
  const gap = width - displayWidth(text);
  if (gap <= 0) return text;
  switch (align) {
    case "right":
      return " ".repeat(gap) + text;
    case "center": {
      const left = Math.floor(gap / 2);
      return " ".repeat(left) + text + " ".repeat(gap - left);
    }
    default:
      return text + " ".repeat(gap);
  }
}

function delimiterCell(width: number, align: Alignment): string {
  switch (align) {
    case "left":
      return ":" + "-".repeat(width - 1);
    case "right":
      return "-".repeat(width - 1) + ":";
    case "center":
      return ":" + "-".repeat(width - 2) + ":";
    default:
      return "-".repeat(width);
  }
}

/** Per-column inner widths the renderer will use (useful for tooling). */
export function columnWidths(table: Table): number[] {
  return table.header.map((h, col) => {
    let width = Math.max(MIN_WIDTH, displayWidth(escapeCell(h)));
    for (const row of table.rows) {
      width = Math.max(width, displayWidth(escapeCell(row[col] ?? "")));
    }
    return width;
  });
}

/** Render a table to aligned Markdown lines (no trailing newline). */
export function renderTable(table: Table, indent = ""): string[] {
  if (table.header.length === 0) {
    throw new Error("cannot render a table with zero columns");
  }
  const widths = columnWidths(table);
  const line = (cells: string[]): string =>
    `${indent}| ${cells.join(" | ")} |`;
  const rendered = (cells: string[]): string[] =>
    cells.map((cell, col) =>
      padCell(escapeCell(cell), widths[col]!, table.alignments[col] ?? "none"),
    );

  const out: string[] = [];
  out.push(line(rendered(table.header)));
  out.push(
    line(
      widths.map((w, col) => delimiterCell(w, table.alignments[col] ?? "none")),
    ),
  );
  for (const row of table.rows) out.push(line(rendered(row)));
  return out;
}

/** Render a table to a single string ending in a newline. */
export function renderTableText(table: Table, indent = ""): string {
  return renderTable(table, indent).join("\n") + "\n";
}
