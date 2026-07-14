// CSV/TSV parsing and writing (RFC 4180) plus the Table<->rows
// conversion layer. The headline property is the round-trip: parse and
// write are inverses, and csv -> md -> csv preserves embedded newlines
// via the <br> mapping.
import test from "node:test";
import assert from "node:assert/strict";

import { parseDsv, writeDsv } from "../dist/csv.js";
import {
  brToNewlines,
  newlinesToBr,
  parseAlignSpec,
  rowsToTable,
  tableToRows,
} from "../dist/convert.js";
import { renderTableText } from "../dist/format.js";
import { parseTable } from "../dist/parse.js";
import { makeTable } from "./helpers.mjs";

test("parses plain fields, LF and CRLF records", () => {
  assert.deepEqual(parseDsv("a,b\nc,d\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseDsv("a,b\r\nc,d\r\n"), [["a", "b"], ["c", "d"]]);
});

test("a final record without a trailing newline is kept", () => {
  assert.deepEqual(parseDsv("a,b\nc,d"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parseDsv(""), []);
});

test("quoted fields may contain delimiters, newlines and doubled quotes", () => {
  assert.deepEqual(parseDsv('a,"x, y"\n'), [["a", "x, y"]]);
  assert.deepEqual(parseDsv('"line 1\nline 2",b\n'), [["line 1\nline 2", "b"]]);
  assert.deepEqual(parseDsv('"she said ""hi""",b\n'), [['she said "hi"', "b"]]);
});

test("empty and whitespace fields survive", () => {
  assert.deepEqual(parseDsv("a,,c\n"), [["a", "", "c"]]);
  assert.deepEqual(parseDsv('a,"",c\n'), [["a", "", "c"]]);
  assert.deepEqual(parseDsv(",\n"), [["", ""]]);
});

test("lenient corners: mid-field quotes are literal, unterminated quotes run out", () => {
  assert.deepEqual(parseDsv('say "hi",b\n'), [['say "hi"', "b"]]);
  assert.deepEqual(parseDsv('"never closed,a\nb'), [["never closed,a\nb"]]);
});

test("writeDsv quotes only when needed and round-trips", () => {
  const rows = [
    ["plain", "with, comma", 'with "quote"'],
    ["multi\nline", " leading space", ""],
  ];
  const text = writeDsv(rows);
  assert.equal(
    text,
    'plain,"with, comma","with ""quote"""\n"multi\nline"," leading space",\n',
  );
  assert.deepEqual(parseDsv(text), rows);
});

test("TSV is the same machinery with a tab delimiter; bad delimiters are rejected", () => {
  const rows = [["a", "b\tc"], ["d", "e"]];
  const text = writeDsv(rows, "\t");
  assert.equal(text, 'a\t"b\tc"\nd\te\n');
  assert.deepEqual(parseDsv(text, "\t"), rows);
  assert.throws(() => parseDsv("a", ",,"), /invalid delimiter/);
  assert.throws(() => writeDsv([["a"]], '"'), /invalid delimiter/);
});

test("rowsToTable pads ragged rows and applies an alignment spec", () => {
  const table = rowsToTable([["A", "B"], ["1"]], parseAlignSpec("lr"));
  assert.deepEqual(table.rows, [["1", ""]]);
  assert.deepEqual(table.alignments, ["left", "right"]);
  assert.deepEqual(parseAlignSpec("left,center,right"), ["left", "center", "right"]);
  assert.throws(() => parseAlignSpec("x"), /invalid alignment/);
});

test("newlines map to <br> going into Markdown, and back out", () => {
  assert.equal(newlinesToBr("a\nb\r\nc"), "a<br>b<br>c");
  assert.equal(brToNewlines("a<br>b<BR/>c<br />d"), "a\nb\nc\nd");
  const table = rowsToTable([["H"], ["two\nlines"]]);
  assert.equal(table.rows[0][0], "two<br>lines");
  assert.deepEqual(tableToRows(table)[1], ["two\nlines"]);
});

test("csv -> md -> csv is byte-identical, including embedded newlines", () => {
  const original = 'name,notes\nalpha,"line one\nline two"\nbeta,"comma, inside"\n';
  const md = renderTableText(rowsToTable(parseDsv(original)));
  const back = writeDsv(tableToRows(parseTable(md.trimEnd().split("\n"))));
  assert.equal(back, original);
});

test("md -> csv -> md preserves cell data (alignment is CSV-lossy by design)", () => {
  const md = makeTable(["A", "B"], [["x|y", "2"]]);
  const rows = tableToRows(md);
  assert.deepEqual(rows, [["A", "B"], ["x|y", "2"]]);
  const back = rowsToTable(parseDsv(writeDsv(rows)));
  assert.deepEqual(back.header, md.header);
  assert.deepEqual(back.rows, md.rows);
});
