// Rendering: canonical shape, alignment padding, CJK-aware widths and
// idempotency. The formatter's contract is "format(format(x)) == format(x)".
import test from "node:test";
import assert from "node:assert/strict";

import { columnWidths, escapeCell, renderTable, renderTableText } from "../dist/format.js";
import { parseTable } from "../dist/parse.js";
import { displayWidth } from "../dist/width.js";
import { makeTable } from "./helpers.mjs";

test("renders canonical pipes with one space of padding", () => {
  const table = makeTable(["A", "B"], [["1", "2"]]);
  assert.deepEqual(renderTable(table), [
    "| A   | B   |",
    "| --- | --- |",
    "| 1   | 2   |",
  ]);
  const text = renderTableText(table);
  assert.ok(text.endsWith("|\n") && !text.endsWith("\n\n"));
});

test("delimiter dashes stretch to the column width and keep colons", () => {
  const table = makeTable(
    ["Name", "Amount", "Note"],
    [["Widget", "9.50", "ok"]],
    ["left", "right", "center"],
  );
  const lines = renderTable(table);
  assert.equal(lines[1], "| :----- | -----: | :--: |");
});

test("right and center alignment pad on the correct side", () => {
  const table = makeTable(["N", "C"], [["1", "x"]], ["right", "center"]);
  const lines = renderTable(table);
  assert.equal(lines[2], "|   1 |  x  |");
});

test("CJK cells pad by display width, not code units", () => {
  const table = makeTable(["Name"], [["部品"], ["Widget"]]);
  const lines = renderTable(table);
  // "部品" is 4 columns wide; both rows must end at the same column.
  assert.equal(lines[2], "| 部品   |");
  assert.equal(lines[3], "| Widget |");
  assert.equal(new Set(lines.map(displayWidth)).size, 1);
});

test("literal pipes are re-escaped and newlines become <br>", () => {
  assert.equal(escapeCell("a|b"), "a\\|b");
  assert.equal(escapeCell("two\nlines"), "two<br>lines");
  const table = makeTable(["A"], [["x|y"]]);
  assert.equal(renderTable(table)[2], "| x\\|y |");
});

test("formatting is idempotent, including escapes and alignment", () => {
  const source = ["| A \\| B | 值 |", "|:--|--:|", "|x|长长长|", "| `a\\|b` | 1 |"];
  const once = renderTable(parseTable(source));
  const twice = renderTable(parseTable(once));
  assert.deepEqual(twice, once);
});

test("indent is preserved on every rendered line", () => {
  const table = makeTable(["A"], [["1"]]);
  for (const line of renderTable(table, "  ")) {
    assert.ok(line.startsWith("  |"));
  }
});

test("columnWidths enforces the three-character minimum", () => {
  assert.deepEqual(columnWidths(makeTable(["A", "Long header"], [])), [3, 11]);
});
