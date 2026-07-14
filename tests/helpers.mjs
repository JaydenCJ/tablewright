// Shared test helpers: table factories, temp files with cleanup, and a
// CLI runner against the built dist/. No network, no clocks — every
// fixture lives in a fresh mkdtemp directory.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");

/** Build a Table value without repeating the alignment boilerplate. */
export function makeTable(header, rows, alignments) {
  return {
    header,
    alignments: alignments ?? header.map(() => "none"),
    rows,
  };
}

/** Create a temp dir with the given files; returns { dir, cleanup }. */
export function makeDir(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tablewright-test-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Run the built CLI synchronously. Returns { status, stdout, stderr }.
 * Pass `input` to feed stdin.
 */
export function runCli(args, { input, cwd } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    input: input ?? "",
    cwd: cwd ?? ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/** A small messy document used by several suites. */
export const MESSY_DOC = `# Inventory

Intro paragraph.

| Name | Qty | Price |
|---|---:|---|
| Widget | 2 | $9.50 |
| Gadget | 10 | $1,200 |

Some prose between tables.

| Host | Port |
| :--- | ---: |
| 127.0.0.1 | 8080 |
| example.test | 443 |
`;
