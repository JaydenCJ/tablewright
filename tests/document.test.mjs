// Document scanning and rewriting: fence awareness, GFM table detection
// rules, indentation, and the byte-for-byte pass-through of everything
// that is not a table.
import test from "node:test";
import assert from "node:assert/strict";

import { findTables, formatDocument, getTable, replaceBlock } from "../dist/document.js";
import { MESSY_DOC } from "./helpers.mjs";

test("finds every table in a document, in order", () => {
  const blocks = findTables(MESSY_DOC);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].table.header, ["Name", "Qty", "Price"]);
  assert.deepEqual(blocks[1].table.header, ["Host", "Port"]);
});

test("tables inside code fences are never touched", () => {
  const doc = [
    "```",
    "| a | b |",
    "|---|---|",
    "| 1 | 2 |",
    "```",
    "",
    "~~~markdown",
    "| c | d |",
    "|---|---|",
    "~~~",
    "",
    "| real | table |",
    "|---|---|",
  ].join("\n");
  const blocks = findTables(doc);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].table.header, ["real", "table"]);
  // Formatting must leave the fenced (deliberately ugly) tables alone.
  assert.ok(formatDocument(doc).includes("| a | b |\n|---|---|"));
});

test("indented code blocks (4+ spaces) are not tables", () => {
  const doc = "    | a | b |\n    |---|---|\n";
  assert.equal(findTables(doc).length, 0);
});

test("a delimiter row with a different cell count is not a table (GFM rule)", () => {
  // Two header cells over a one-cell delimiter: setext-heading territory.
  const doc = "a | b\n---\n";
  assert.equal(findTables(doc).length, 0);
});

test("a one-column bare-dash delimiter needs a pipe or colon", () => {
  assert.equal(findTables("| a\n---\n").length, 0); // heading, not table
  assert.equal(findTables("| a |\n| --- |\n| 1 |\n").length, 1);
});

test("tables end at the first blank or pipe-less line", () => {
  const doc = "| a |\n|---|\n| 1 |\nplain prose line\n| not a row |\n";
  const blocks = findTables(doc);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].end, 3);
});

test("formatDocument rewrites only table lines and is idempotent", () => {
  const formatted = formatDocument(MESSY_DOC);
  assert.ok(formatted.startsWith("# Inventory\n\nIntro paragraph.\n"));
  assert.ok(formatted.includes("Some prose between tables."));
  assert.ok(formatted.includes("| Widget |   2 | $9.50  |")); // Qty is right-aligned
  assert.equal(formatDocument(formatted), formatted);
  // Trailing newline is preserved.
  assert.ok(formatted.endsWith("|\n"));
});

test("getTable selects 1-based and reports what exists on a miss", () => {
  assert.deepEqual(getTable(MESSY_DOC, 2).table.header, ["Host", "Port"]);
  assert.throws(() => getTable(MESSY_DOC, 3), /has 2 table\(s\)/);
  assert.throws(() => getTable("no tables here\n"), /no pipe tables found/);
});

test("replaceBlock swaps one table and leaves the rest byte-identical", () => {
  const block = getTable(MESSY_DOC, 2);
  const edited = { ...block.table, rows: [["127.0.0.1", "9090"]] };
  const result = replaceBlock(MESSY_DOC, block, edited);
  assert.ok(result.includes("9090"));
  assert.ok(!result.includes("example.test"));
  // The first table's original (unformatted) lines are untouched.
  assert.ok(result.includes("| Widget | 2 | $9.50 |"));
});
