// Cell addresses and column-reference resolution. The resolution order
// (header text > #N > letters > bare number) is a documented contract —
// these tests pin it down.
import test from "node:test";
import assert from "node:assert/strict";

import {
  columnLetterToIndex,
  indexToColumnLetter,
  parseAddress,
  parseRef,
  resolveColumn,
} from "../dist/address.js";
import { makeTable } from "./helpers.mjs";

test("column letters convert in both directions, including AA and beyond", () => {
  assert.equal(columnLetterToIndex("A"), 0);
  assert.equal(columnLetterToIndex("z"), 25); // case-insensitive
  assert.equal(columnLetterToIndex("AA"), 26);
  assert.equal(indexToColumnLetter(0), "A");
  assert.equal(indexToColumnLetter(25), "Z");
  assert.equal(indexToColumnLetter(26), "AA");
  assert.equal(indexToColumnLetter(27), "AB");
  for (let i = 0; i < 200; i++) {
    assert.equal(columnLetterToIndex(indexToColumnLetter(i)), i);
  }
});

test("parseAddress reads spreadsheet-style addresses; row 0 is the header", () => {
  assert.deepEqual(parseAddress("B2"), { col: 1, row: 2 });
  assert.deepEqual(parseAddress("a0"), { col: 0, row: 0 });
  assert.deepEqual(parseAddress("AA10"), { col: 26, row: 10 });
});

test("parseAddress rejects malformed input with a helpful message", () => {
  assert.throws(() => parseAddress("2B"), /invalid cell address/);
  assert.throws(() => parseAddress("B"), /invalid cell address/);
  assert.throws(() => parseAddress("B-1"), /invalid cell address/);
});

test("parseRef classifies cells, rows and columns", () => {
  assert.deepEqual(parseRef("B2"), { kind: "cell", address: { col: 1, row: 2 } });
  assert.deepEqual(parseRef("3"), { kind: "row", row: 3 });
  assert.deepEqual(parseRef("Price"), { kind: "column", ref: "Price" });
  assert.deepEqual(parseRef("B"), { kind: "column", ref: "B" });
});

test("resolveColumn prefers exact header text over everything", () => {
  // A column literally named "B" must win over the letter B (index 1).
  const table = makeTable(["B", "Other"], []);
  assert.equal(resolveColumn(table, "B"), 0);
});

test("resolveColumn falls back: case-insensitive header, #N, letter, number", () => {
  const table = makeTable(["Name", "Qty", "Price"], []);
  assert.equal(resolveColumn(table, "price"), 2); // case-insensitive header
  assert.equal(resolveColumn(table, "#2"), 1); // explicit 1-based index
  assert.equal(resolveColumn(table, "C"), 2); // letter
  assert.equal(resolveColumn(table, "3"), 2); // bare 1-based number
});

test("resolveColumn errors list the available columns", () => {
  const table = makeTable(["Name", "Qty"], []);
  assert.throws(() => resolveColumn(table, "Missing"), /A="Name", B="Qty"/);
  assert.throws(() => resolveColumn(table, "#9"), /out of range/);
});
