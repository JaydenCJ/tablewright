// Sorting: comparators, auto-detection, stability and the empties-last
// invariant. All comparisons are locale-independent — a sort must not
// change with the host's LANG.
import test from "node:test";
import assert from "node:assert/strict";

import {
  compareCells,
  detectMode,
  naturalCompare,
  parseNumeric,
  sortTable,
} from "../dist/sort.js";
import { makeTable } from "./helpers.mjs";

const col = (rows) => makeTable(["V", "Tag"], rows);
const values = (table) => table.rows.map((r) => r[0]);

test("parseNumeric handles plain, signed, decimal and scientific numbers", () => {
  assert.equal(parseNumeric("42"), 42);
  assert.equal(parseNumeric("-3.5"), -3.5);
  assert.equal(parseNumeric("+.5"), 0.5);
  assert.equal(parseNumeric("1.5e3"), 1500);
});

test("parseNumeric tolerates separators, currency signs and percent", () => {
  assert.equal(parseNumeric("1,234.5"), 1234.5);
  assert.equal(parseNumeric("1_000_000"), 1000000);
  assert.equal(parseNumeric("$99"), 99);
  assert.equal(parseNumeric("¥1,200"), 1200);
  assert.equal(parseNumeric("42%"), 0.42);
});

test("parseNumeric rejects non-numbers", () => {
  for (const bad of ["", "abc", "1.2.3", "12a", "--5", "$"]) {
    assert.equal(parseNumeric(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("naturalCompare orders digit runs numerically", () => {
  // Plain string sort puts v10 before v9; natural sort must not.
  assert.ok(naturalCompare("v9", "v10") < 0);
  assert.ok(naturalCompare("file2", "file10") < 0);
  // Leading zeros compare equal numerically; the raw string breaks the tie.
  assert.ok(naturalCompare("a01", "a1") < 0);
});

test("naturalCompare is case-insensitive but fully deterministic", () => {
  assert.ok(naturalCompare("apple", "Banana") < 0);
  // Equal ignoring case: the raw strings break the tie, always the same way.
  const d = naturalCompare("Alpha", "alpha");
  assert.notEqual(d, 0);
  assert.equal(naturalCompare("Alpha", "alpha"), d);
});

test("naturalCompare survives digit runs too long for Number", () => {
  const big = "99999999999999999999999999999999999999";
  const bigger = "100000000000000000000000000000000000000";
  assert.ok(naturalCompare(`v${big}`, `v${bigger}`) < 0);
});

test("auto mode detects numeric columns and sorts them as numbers", () => {
  assert.equal(detectMode(col([["1"], ["2.5"], [""]]), 0), "numeric");
  assert.equal(detectMode(col([["1"], ["two"]]), 0), "natural");
  assert.equal(detectMode(col([[""], [""]]), 0), "natural"); // nothing to detect
  const table = col([["$9.50", "a"], ["$1,200", "b"], ["$88", "c"]]);
  assert.deepEqual(values(sortTable(table, 0)), ["$9.50", "$88", "$1,200"]);
});

test("descending reverses order but keeps empty cells last", () => {
  const table = col([["", "gap"], ["5", "a"], ["10", "b"]]);
  assert.deepEqual(values(sortTable(table, 0, { descending: true })), ["10", "5", ""]);
  assert.deepEqual(values(sortTable(table, 0)), ["5", "10", ""]);
});

test("the sort is stable: ties keep their original order", () => {
  const table = makeTable(
    ["Group", "Id"],
    [["b", "1"], ["a", "2"], ["b", "3"], ["a", "4"]],
  );
  const sorted = sortTable(table, 0);
  assert.deepEqual(sorted.rows.map((r) => r[1]), ["2", "4", "1", "3"]);
});

test("forced modes override detection; out-of-range columns are errors", () => {
  const table = col([["10", "a"], ["9", "b"]]);
  // string mode: "10" < "9" lexicographically
  assert.deepEqual(values(sortTable(table, 0, { mode: "string" })), ["10", "9"]);
  assert.deepEqual(values(sortTable(table, 0, { mode: "numeric" })), ["9", "10"]);
  assert.throws(() => sortTable(table, 5), /out of range/);
});

test("numeric mode puts stray text after numbers, compared naturally", () => {
  const table = col([["n/a", "x"], ["12", "y"], ["3", "z"], ["also n/a", "w"]]);
  assert.deepEqual(values(sortTable(table, 0, { mode: "numeric" })), [
    "3",
    "12",
    "also n/a",
    "n/a",
  ]);
});

test("compareCells is antisymmetric for every mode", () => {
  for (const mode of ["numeric", "natural", "string"]) {
    for (const [a, b] of [["1", "2"], ["x", "y"], ["v9", "v10"], ["$5", "abc"]]) {
      assert.equal(
        compareCells(a, b, mode),
        -compareCells(b, a, mode),
        `${mode}: ${a} vs ${b}`,
      );
    }
  }
});
