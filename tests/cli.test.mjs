// End-to-end CLI tests against the built dist/cli.js: real subprocesses,
// real files in fresh temp dirs, exit codes and stdout/stderr contracts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { makeDir, runCli, MESSY_DOC } from "./helpers.mjs";

test("--version prints the package version", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const r = runCli(["--version"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test("dispatch: --help documents every command; unknown input exits 2", () => {
  const help = runCli(["--help"]);
  assert.equal(help.status, 0);
  for (const cmd of ["fmt", "sort", "get", "set", "edit", "convert", "info"]) {
    assert.ok(help.stdout.includes(cmd), `help missing ${cmd}`);
  }
  assert.equal(runCli([]).status, 2);
  const r = runCli(["frobnicate"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown command/);
  const r2 = runCli(["fmt", "--bogus"], { input: "" });
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /unknown option/);
});

test("fmt reads stdin and aligns tables, passing prose through", () => {
  const r = runCli(["fmt"], { input: MESSY_DOC });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("| Name   | Qty | Price  |"));
  assert.ok(r.stdout.includes("# Inventory"));
});

test("fmt --write rewrites the file; --check exits 1 then 0", () => {
  const { dir, cleanup } = makeDir({ "doc.md": MESSY_DOC });
  try {
    const file = join(dir, "doc.md");
    const check1 = runCli(["fmt", "--check", file]);
    assert.equal(check1.status, 1);
    assert.match(check1.stdout, /would reformat: .*doc\.md/);

    assert.equal(runCli(["fmt", "--write", file]).status, 0);
    assert.ok(readFileSync(file, "utf8").includes("| Name   | Qty | Price  |"));

    assert.equal(runCli(["fmt", "--check", file]).status, 0);
  } finally {
    cleanup();
  }
});

test("fmt refuses to print multiple files to stdout but checks them together", () => {
  const { dir, cleanup } = makeDir({ "a.md": "|x|\n|-|\n", "b.md": "y\n" });
  try {
    const a = join(dir, "a.md");
    const b = join(dir, "b.md");
    const r = runCli(["fmt", a, b]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--write or --check/);
    const check = runCli(["fmt", "--check", a, b]);
    assert.equal(check.status, 1); // a.md needs formatting, b.md does not
    assert.ok(check.stdout.includes("a.md"));
    assert.ok(!check.stdout.includes("b.md"));
  } finally {
    cleanup();
  }
});

test("sort rewrites only the selected table and keeps prose", () => {
  const r = runCli(["sort", "--by", "Price", "--desc"], { input: MESSY_DOC });
  assert.equal(r.status, 0);
  const gadget = r.stdout.indexOf("Gadget");
  const widget = r.stdout.indexOf("Widget");
  assert.ok(gadget !== -1 && gadget < widget, "expected $1,200 row first");
  // Second table untouched (still in its original ragged form).
  assert.ok(r.stdout.includes("| 127.0.0.1 | 8080 |"));
});

test("sort --table 2 targets the second table; a bad column exits 2", () => {
  const r = runCli(["sort", "--table", "2", "--by", "Port", "--desc"], {
    input: MESSY_DOC,
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.indexOf("8080") < r.stdout.indexOf("443"));
  const bad = runCli(["sort", "--by", "Nope"], { input: MESSY_DOC });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /available columns/);
});

test("get prints a cell, a tab-joined row, and a column as lines", () => {
  assert.equal(runCli(["get", "B2"], { input: MESSY_DOC }).stdout, "10\n");
  assert.equal(runCli(["get", "0"], { input: MESSY_DOC }).stdout, "Name\tQty\tPrice\n");
  assert.equal(runCli(["get", "Price"], { input: MESSY_DOC }).stdout, "$9.50\n$1,200\n");
});

test("set updates one cell and formats only that table", () => {
  const { dir, cleanup } = makeDir({ "doc.md": MESSY_DOC });
  try {
    const file = join(dir, "doc.md");
    assert.equal(runCli(["set", "C1", "$10.00", file, "--write"]).status, 0);
    const text = readFileSync(file, "utf8");
    assert.ok(text.includes("$10.00"));
    assert.ok(!text.includes("$9.50"));
    assert.equal(runCli(["get", "C1", file]).stdout, "$10.00\n");
  } finally {
    cleanup();
  }
});

test("edit applies operations left to right", () => {
  const r = runCli(
    [
      "edit",
      "--add-col", "Stock",
      "--set", "D1=yes",
      "--add-row", "Sprocket | 5 | $3 | no",
      "--del-row", "2",
    ],
    { input: MESSY_DOC },
  );
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes("Stock"));
  assert.ok(r.stdout.includes("yes"));
  assert.ok(r.stdout.includes("Sprocket"));
  // --del-row 2 ran last, so it removed Gadget (row 2 at that point).
  assert.ok(!r.stdout.includes("Gadget"));
});

test("convert md -> csv quotes fields that need it", () => {
  const r = runCli(["convert", "--to", "csv"], { input: MESSY_DOC });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'Name,Qty,Price\nWidget,2,$9.50\nGadget,10,"$1,200"\n');
});

test("convert csv -> md honors --align and infers --from by extension", () => {
  const { dir, cleanup } = makeDir({
    "prices.csv": 'item,price\nwidget,"9,50"\n',
  });
  try {
    const r = runCli(["convert", join(dir, "prices.csv"), "--align", "lr"]);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("| :---"));
    assert.ok(r.stdout.includes("--: |"));
    assert.ok(r.stdout.includes("9,50"));
  } finally {
    cleanup();
  }
});

test("convert round-trips csv -> md -> csv through real processes", () => {
  const original = 'name,notes\nalpha,"line one\nline two"\nbeta,"comma, inside"\n';
  const md = runCli(["convert", "--from", "csv", "--to", "md"], { input: original });
  assert.equal(md.status, 0);
  const back = runCli(["convert", "--from", "md", "--to", "csv"], { input: md.stdout });
  assert.equal(back.status, 0);
  assert.equal(back.stdout, original);
});

test("info lists tables with position, size and headers", () => {
  const r = runCli(["info"], { input: MESSY_DOC });
  assert.equal(r.status, 0);
  const lines = r.stdout.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^#1 {2}lines 5-8 {2}3 cols x 2 rows {2}Name \| Qty \| Price$/);
  assert.match(lines[1], /^#2 {2}lines 12-15 {2}2 cols x 2 rows {2}Host \| Port$/);
  assert.equal(runCli(["info"], { input: "no tables\n" }).stdout, "no pipe tables found\n");
});

test("clean exit-2 errors: no tables, no operations, stdin --write", () => {
  const noTables = runCli(["sort", "--by", "A"], { input: "just prose\n" });
  assert.equal(noTables.status, 2);
  assert.match(noTables.stderr, /no pipe tables found/);

  const noOps = runCli(["edit"], { input: MESSY_DOC });
  assert.equal(noOps.status, 2);
  assert.match(noOps.stderr, /at least one operation/);

  const stdinWrite = runCli(["set", "A1", "x", "--write"], { input: MESSY_DOC });
  assert.equal(stdinWrite.status, 2);
  assert.match(stdinWrite.stderr, /stdin cannot be rewritten/);
});

test("fmt --write on stdin exits 2 even when the input is already formatted", () => {
  // The refusal must not depend on whether formatting would change anything —
  // a script piping into `fmt --write` is broken either way and should hear so.
  const clean = runCli(["fmt"], { input: MESSY_DOC }).stdout;
  const r = runCli(["fmt", "--write"], { input: clean });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /stdin cannot be rewritten/);
  const dash = runCli(["fmt", "--write", "-"], { input: clean });
  assert.equal(dash.status, 2);
});

test("get rejects --write instead of silently ignoring it", () => {
  const r = runCli(["get", "B2", "--write"], { input: MESSY_DOC });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown option/);
});
