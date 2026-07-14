// The argv parser: order preservation for repeatable operations, both
// value syntaxes, aliases, and hard errors for unknown flags.
import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs, tableFlag } from "../dist/cliargs.js";

const SPECS = [
  { name: "--write", alias: "-w", takesValue: false },
  { name: "--by", takesValue: true },
  { name: "--set", takesValue: true },
  { name: "--del-row", takesValue: true },
  { name: "--table", alias: "-t", takesValue: true },
];

test("positionals, aliases and both value syntaxes", () => {
  const p = parseArgs(["file.md", "-w", "--by=Price", "--table", "2"], SPECS);
  assert.deepEqual(p.positionals, ["file.md"]);
  assert.equal(p.flags.get("--write"), true);
  assert.equal(p.flags.get("--by"), "Price");
  assert.equal(p.flags.get("--table"), "2");
});

test("repeated flags are preserved in argv order", () => {
  const p = parseArgs(
    ["--set", "B2=x", "--del-row", "3", "--set", "A1=y"],
    SPECS,
  );
  assert.deepEqual(
    p.ordered.map((o) => `${o.name}:${o.value}`),
    ["--set:B2=x", "--del-row:3", "--set:A1=y"],
  );
});

test("a lone dash is a positional (stdin) and -- ends flag parsing", () => {
  const p = parseArgs(["-", "--", "--by"], SPECS);
  assert.deepEqual(p.positionals, ["-", "--by"]);
});

test("unknown and malformed flags are hard errors", () => {
  assert.throws(() => parseArgs(["--frobnicate"], SPECS), /unknown option/);
  assert.throws(() => parseArgs(["--by"], SPECS), /requires a value/);
  assert.throws(() => parseArgs(["--write=yes"], SPECS), /does not take a value/);
});

test("tableFlag validates --table as a positive integer", () => {
  assert.equal(tableFlag(parseArgs([], SPECS)), 1);
  assert.equal(tableFlag(parseArgs(["--table", "3"], SPECS)), 3);
  assert.throws(() => tableFlag(parseArgs(["--table", "0"], SPECS)), /positive integer/);
  assert.throws(() => tableFlag(parseArgs(["--table", "two"], SPECS)), /positive integer/);
});
