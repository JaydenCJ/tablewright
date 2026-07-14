// Structural edits: cells, rows and columns. Two properties matter
// beyond the happy path: inputs are never mutated, and out-of-range
// addresses are hard errors rather than silent growth.
import test from "node:test";
import assert from "node:assert/strict";

import {
  appendColumn,
  appendRow,
  deleteColumn,
  deleteRow,
  getCell,
  getColumn,
  getRow,
  setCell,
} from "../dist/edit.js";
import { makeTable } from "./helpers.mjs";

const fixture = () =>
  makeTable(
    ["Name", "Qty"],
    [
      ["Widget", "2"],
      ["Gadget", "10"],
    ],
    ["left", "right"],
  );

test("getCell reads body cells and the header via row 0", () => {
  const t = fixture();
  assert.equal(getCell(t, { col: 0, row: 1 }), "Widget");
  assert.equal(getCell(t, { col: 1, row: 2 }), "10");
  assert.equal(getCell(t, { col: 1, row: 0 }), "Qty");
});

test("setCell writes a body cell without mutating the original", () => {
  const t = fixture();
  const next = setCell(t, { col: 1, row: 1 }, "3");
  assert.equal(next.rows[0][1], "3");
  assert.equal(t.rows[0][1], "2"); // original untouched
});

test("setCell on row 0 renames the header", () => {
  const next = setCell(fixture(), { col: 0, row: 0 }, "Product");
  assert.deepEqual(next.header, ["Product", "Qty"]);
});

test("out-of-range addresses are errors, not silent growth", () => {
  const t = fixture();
  assert.throws(() => getCell(t, { col: 5, row: 1 }), /columns A–B/);
  assert.throws(() => setCell(t, { col: 0, row: 9 }, "x"), /row 9 is out of range/);
});

test("getRow and getColumn return copies", () => {
  const t = fixture();
  assert.deepEqual(getRow(t, 0), ["Name", "Qty"]);
  assert.deepEqual(getRow(t, 2), ["Gadget", "10"]);
  const column = getColumn(t, 1);
  assert.deepEqual(column, ["2", "10"]);
  column[0] = "mutated";
  assert.equal(t.rows[0][1], "2");
});

test("appendRow pads short rows and rejects overlong ones", () => {
  const padded = appendRow(fixture(), ["Sprocket"]);
  assert.deepEqual(padded.rows[2], ["Sprocket", ""]);
  assert.throws(
    () => appendRow(fixture(), ["a", "b", "c"]),
    /3 cell\(s\) but the table has 2 column\(s\)/,
  );
});

test("deleteRow removes one body row; the header is protected", () => {
  const t = deleteRow(fixture(), 1);
  assert.deepEqual(t.rows, [["Gadget", "10"]]);
  assert.throws(() => deleteRow(fixture(), 0), /cannot delete the header row/);
  assert.throws(() => deleteRow(fixture(), 3), /out of range/);
});

test("appendColumn adds an empty cell to every row with the given alignment", () => {
  const t = appendColumn(fixture(), "Price", "right");
  assert.deepEqual(t.header, ["Name", "Qty", "Price"]);
  assert.deepEqual(t.alignments, ["left", "right", "right"]);
  assert.deepEqual(t.rows, [
    ["Widget", "2", ""],
    ["Gadget", "10", ""],
  ]);
});

test("deleteColumn removes cells and alignment; the last column is protected", () => {
  const t = deleteColumn(fixture(), 0);
  assert.deepEqual(t.header, ["Qty"]);
  assert.deepEqual(t.alignments, ["right"]);
  assert.deepEqual(t.rows, [["2"], ["10"]]);
  assert.throws(() => deleteColumn(t, 0), /only column/);
});
