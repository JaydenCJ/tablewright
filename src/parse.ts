/**
 * Pipe-table parsing (GFM rules).
 *
 * The one rule everything hinges on: an *unescaped* `|` splits cells, and
 * `\|` is a literal pipe — GFM applies this even inside code spans, so no
 * backtick tracking is needed here. Leading and trailing pipes are
 * optional on input; the formatter always emits them.
 */

import type { Alignment, Table } from "./types.js";

/** True if the line contains at least one unescaped `|`. */
export function hasUnescapedPipe(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\") {
      i++; // skip the escaped character
    } else if (line[i] === "|") {
      return true;
    }
  }
  return false;
}

/**
 * Split one table row into trimmed cell texts.
 *
 * Strips one optional leading and one optional trailing (unescaped) pipe,
 * splits on unescaped pipes, and decodes `\|` to a literal `|` so the rest
 * of the toolkit works on real cell values.
 */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  const cells: string[] = [];
  let current = "";
  let endedWithPipe = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
      endedWithPipe = false;
    } else if (ch === "|") {
      cells.push(current);
      current = "";
      endedWithPipe = i === s.length - 1;
    } else {
      current += ch;
      endedWithPipe = false;
    }
  }
  if (!endedWithPipe) cells.push(current);
  return cells.map((c) => c.trim());
}

/**
 * True if the line has the shape of a delimiter row: only pipes, colons,
 * dashes and spaces, with every cell matching `:?-+:?`.
 */
export function isDelimiterLine(line: string): boolean {
  const t = line.trim();
  if (!t.includes("-")) return false;
  if (!/^[|:\-\s]+$/.test(t)) return false;
  const cells = splitRow(t);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Alignment declared by one delimiter cell (`:--`, `--:`, `:-:`, `--`). */
export function alignmentOf(delimiterCell: string): Alignment {
  const left = delimiterCell.startsWith(":");
  const right = delimiterCell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

/**
 * Parse the lines of one pipe table (header, delimiter, body rows) into a
 * `Table`.
 *
 * Ragged input is repaired, never truncated: the column count is the
 * widest row seen, and shorter rows (including the header) are padded
 * with empty cells. GFM renderers drop overlong cells silently — an
 * editing tool must not.
 */
export function parseTable(lines: string[]): Table {
  if (lines.length < 2) {
    throw new Error("a pipe table needs a header row and a delimiter row");
  }
  const header = splitRow(lines[0]!);
  const delimiter = splitRow(lines[1]!);
  if (!isDelimiterLine(lines[1]!)) {
    throw new Error(`line 2 is not a delimiter row: "${lines[1]!.trim()}"`);
  }
  const alignments = delimiter.map(alignmentOf);
  const rows = lines.slice(2).map(splitRow);

  let width = Math.max(header.length, alignments.length);
  for (const row of rows) width = Math.max(width, row.length);

  const pad = <T>(arr: T[], fill: T): T[] => {
    while (arr.length < width) arr.push(fill);
    return arr;
  };
  return {
    header: pad(header, ""),
    alignments: pad(alignments as Alignment[], "none"),
    rows: rows.map((r) => pad(r, "")),
  };
}
