/**
 * Locating and rewriting pipe tables inside a whole Markdown document.
 *
 * Everything that is not a table is passed through byte-for-byte; only
 * the table lines are replaced. The scanner is fence-aware (``` and ~~~
 * blocks are never scanned for tables) and skips indented code blocks,
 * so a table shown *inside* an example is left alone.
 */

import { hasUnescapedPipe, isDelimiterLine, parseTable, splitRow } from "./parse.js";
import { renderTable } from "./format.js";
import type { Table, TableBlock } from "./types.js";

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Split a document into lines, accepting LF or CRLF input. */
function toLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * Find every pipe table in a Markdown document.
 *
 * A table starts at a line with an unescaped pipe (indented at most three
 * spaces) whose next line is a delimiter row with the *same* cell count —
 * the GFM rule that keeps `Total --- 42` prose from being eaten. A bare
 * one-cell `---` delimiter is additionally required to contain a pipe or
 * colon, so setext-style dashes under a one-column line stay a heading.
 */
export function findTables(text: string): TableBlock[] {
  const lines = toLines(text);
  const blocks: TableBlock[] = [];
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) {
        fence = marker;
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;

    if (!hasUnescapedPipe(line)) continue;
    const indentMatch = /^( {0,3})\S/.exec(line);
    if (!indentMatch) continue; // 4+ spaces or a tab: indented code block

    const next = lines[i + 1];
    if (next === undefined || !isDelimiterLine(next)) continue;
    const headerCells = splitRow(line);
    const delimiterCells = splitRow(next);
    if (delimiterCells.length !== headerCells.length) continue;
    if (!next.includes("|") && !next.includes(":")) continue;

    let end = i + 2;
    while (
      end < lines.length &&
      lines[end]!.trim() !== "" &&
      hasUnescapedPipe(lines[end]!) &&
      !FENCE.test(lines[end]!)
    ) {
      end++;
    }

    blocks.push({
      start: i,
      end,
      indent: indentMatch[1]!,
      table: parseTable(lines.slice(i, end)),
    });
    i = end - 1;
  }
  return blocks;
}

/**
 * Return the `n`-th table (1-based) of a document, with a message that
 * names what was actually found when the request cannot be satisfied.
 */
export function getTable(text: string, n = 1): TableBlock {
  const blocks = findTables(text);
  if (blocks.length === 0) {
    throw new Error("no pipe tables found in the input");
  }
  if (!Number.isInteger(n) || n < 1 || n > blocks.length) {
    throw new Error(
      `table ${n} does not exist: the document has ${blocks.length} table(s)`,
    );
  }
  return blocks[n - 1]!;
}

/** Replace the lines of `block` with a re-rendered `table`. */
export function replaceBlock(
  text: string,
  block: TableBlock,
  table: Table,
): string {
  const lines = toLines(text);
  const out = [
    ...lines.slice(0, block.start),
    ...renderTable(table, block.indent),
    ...lines.slice(block.end),
  ];
  return out.join("\n");
}

/** Re-render every table in a document; all other lines pass through. */
export function formatDocument(text: string): string {
  const blocks = findTables(text);
  if (blocks.length === 0) return text;
  const lines = toLines(text);
  const out: string[] = [];
  let cursor = 0;
  for (const block of blocks) {
    out.push(...lines.slice(cursor, block.start));
    out.push(...renderTable(block.table, block.indent));
    cursor = block.end;
  }
  out.push(...lines.slice(cursor));
  return out.join("\n");
}
