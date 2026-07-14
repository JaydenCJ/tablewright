// Pipe-table parsing: cell splitting, escapes, delimiter recognition and
// ragged-row repair. These rules are what make every other command safe
// to run on hand-written tables.
import test from "node:test";
import assert from "node:assert/strict";

import {
  alignmentOf,
  isDelimiterLine,
  parseTable,
  splitRow,
} from "../dist/parse.js";

test("splitRow strips optional outer pipes but keeps interior empty cells", () => {
  assert.deepEqual(splitRow("| a | b |"), ["a", "b"]);
  assert.deepEqual(splitRow("a | b"), ["a", "b"]);
  assert.deepEqual(splitRow("| a | b"), ["a", "b"]);
  assert.deepEqual(splitRow("|a||b|"), ["a", "", "b"]);
  assert.deepEqual(splitRow("|a||"), ["a", ""]);
});

test("splitRow decodes escaped pipes into literal cell text", () => {
  // GFM: \| is a literal pipe even inside code spans.
  assert.deepEqual(splitRow("| a \\| b | c |"), ["a | b", "c"]);
  assert.deepEqual(splitRow("| `a \\| b` |"), ["`a | b`"]);
});

test("isDelimiterLine accepts every alignment marker shape", () => {
  assert.ok(isDelimiterLine("|---|---|"));
  assert.ok(isDelimiterLine("| :--- | :--: | ---: |"));
  assert.ok(isDelimiterLine(":--|--:"));
});

test("isDelimiterLine rejects prose, rules with other characters, and empty lines", () => {
  assert.ok(!isDelimiterLine("| a | b |"));
  assert.ok(!isDelimiterLine("| -x- |"));
  assert.ok(!isDelimiterLine("| ::: |"));
  assert.ok(!isDelimiterLine(""));
});

test("alignmentOf maps the four delimiter shapes", () => {
  assert.equal(alignmentOf(":---"), "left");
  assert.equal(alignmentOf("---:"), "right");
  assert.equal(alignmentOf(":--:"), "center");
  assert.equal(alignmentOf("---"), "none");
});

test("parseTable produces header, alignments and body rows", () => {
  const table = parseTable(["| A | B |", "| :-- | --: |", "| 1 | 2 |"]);
  assert.deepEqual(table.header, ["A", "B"]);
  assert.deepEqual(table.alignments, ["left", "right"]);
  assert.deepEqual(table.rows, [["1", "2"]]);
});

test("parseTable pads ragged rows instead of truncating", () => {
  // A row wider than the header must widen the table — dropping the
  // extra cell (what GFM renderers do) would lose data in an editor.
  const table = parseTable(["| A |", "| - |", "| 1 | 2 | 3 |", "| x |"]);
  assert.equal(table.header.length, 3);
  assert.deepEqual(table.rows, [
    ["1", "2", "3"],
    ["x", "", ""],
  ]);
  assert.deepEqual(table.alignments, ["none", "none", "none"]);
});

test("parseTable rejects input without a delimiter row", () => {
  assert.throws(() => parseTable(["| A |"]), /header row and a delimiter row/);
  assert.throws(() => parseTable(["| A |", "| B |"]), /not a delimiter row/);
});
