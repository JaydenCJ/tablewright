#!/usr/bin/env node
/**
 * tablewright CLI.
 *
 * Every command reads a file (or stdin), transforms the *table lines
 * only*, and prints the whole document to stdout — or rewrites the file
 * with `--write`. Exit codes are script-friendly and shared by all
 * commands: 0 success, 1 `fmt --check` found unformatted input, 2 usage
 * or processing error.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

import { parseAddress, parseRef, resolveColumn } from "./address.js";
import {
  boolFlag,
  parseArgs,
  stringFlag,
  tableFlag,
  type FlagSpec,
} from "./cliargs.js";
import { parseDsv, writeDsv } from "./csv.js";
import {
  parseAlignSpec,
  rowsToTable,
  tableToRows,
} from "./convert.js";
import { findTables, formatDocument, getTable, replaceBlock } from "./document.js";
import {
  appendColumn,
  appendRow,
  deleteColumn,
  deleteRow,
  getCell,
  getColumn,
  getRow,
  setCell,
} from "./edit.js";
import { renderTableText } from "./format.js";
import { splitRow } from "./parse.js";
import { sortTable } from "./sort.js";
import type { SortMode, Table } from "./types.js";
import { VERSION } from "./version.js";

const USAGE = `tablewright ${VERSION} — format, sort, edit and convert Markdown pipe tables

Usage: tablewright <command> [options] [file]

Reads FILE (or stdin when FILE is "-" or absent) and prints the result to
stdout; --write rewrites the file in place. Only table lines are touched.

Commands:
  fmt [files...]        align and normalize every pipe table
  sort --by <col>       sort a table's body rows by a column
  get <ref> [file]      print a cell (B2), a row (2) or a column (B, name)
  set <addr> <value>    set one cell (row 0 = the header row)
  edit [ops...]         apply cell/row/column operations left to right
  convert               convert between Markdown, CSV and TSV
  info [file]           list the tables in a document

Common options:
  -t, --table <n>       pick table n (1-based, default 1); not fmt or info,
                        which always cover every table in the document
  -w, --write           rewrite the input file in place (fmt, sort, set, edit)
  -h, --help            show this help
  -V, --version         print the version

fmt:
  --check               exit 1 if any input would change; write nothing

sort:
  --by <col>            header text, letter (B), #n, or 1-based number
  --desc                descending (empty cells still sort last)
  --mode <m>            auto | numeric | natural | string (default auto)
  --numeric --natural --string      shorthands for --mode

edit operations (repeatable, applied in the order given):
  --set <addr>=<value>  set a cell, e.g. --set B2=42
  --add-row <cells>     append a body row, cells separated by "|"
  --del-row <n>         delete body row n (1-based)
  --add-col <header>    append an empty column
  --del-col <col>       delete a column (header text, letter, #n)

convert:
  --from <f>            md | csv | tsv (default: file extension, else md)
  --to <f>              md | csv | tsv (default: md input -> csv, else md)
  --align <spec>        alignment for md output: letters l/r/c/n ("lrn")
                        or names ("left,right,center"); n = no marker

Exit codes: 0 success · 1 fmt --check found unformatted input · 2 error
`;

const TABLE_FLAG: FlagSpec = { name: "--table", alias: "-t", takesValue: true };

/** Flags shared by the document-rewriting commands. */
const COMMON_FLAGS: FlagSpec[] = [
  TABLE_FLAG,
  { name: "--write", alias: "-w", takesValue: false },
];

interface Input {
  text: string;
  /** File path, or null when reading stdin. */
  path: string | null;
  /** Human-readable name for messages. */
  name: string;
}

function readInput(file: string | undefined): Input {
  if (file === undefined || file === "-") {
    return { text: readFileSync(0, "utf8"), path: null, name: "<stdin>" };
  }
  return { text: readFileSync(file, "utf8"), path: file, name: file };
}

/** Print to stdout, or rewrite the input file when --write was given. */
function emit(text: string, input: Input, write: boolean): void {
  if (write) {
    if (input.path === null) {
      throw new Error("--write requires a file argument (stdin cannot be rewritten)");
    }
    writeFileSync(input.path, text);
  } else {
    process.stdout.write(text);
  }
}

function atMostOnePositional(positionals: string[], command: string): string | undefined {
  if (positionals.length > 1) {
    throw new Error(`${command} takes at most one file argument, got ${positionals.length}`);
  }
  return positionals[0];
}

// ---------------------------------------------------------------------------
// fmt

function cmdFmt(argv: string[]): number {
  const parsed = parseArgs(argv, [
    { name: "--write", alias: "-w", takesValue: false },
    { name: "--check", takesValue: false },
  ]);
  const write = boolFlag(parsed, "--write");
  const check = boolFlag(parsed, "--check");
  if (write && check) throw new Error("--write and --check are mutually exclusive");

  const files: Array<string | undefined> =
    parsed.positionals.length === 0 ? [undefined] : parsed.positionals;
  if (!write && !check && files.length > 1) {
    throw new Error("formatting multiple files to stdout would interleave them; use --write or --check");
  }
  if (write && files.some((f) => f === undefined || f === "-")) {
    throw new Error("--write requires file arguments (stdin cannot be rewritten)");
  }

  let unformatted = 0;
  for (const file of files) {
    const input = readInput(file);
    const formatted = formatDocument(input.text);
    if (check) {
      if (formatted !== input.text) {
        unformatted++;
        process.stdout.write(`would reformat: ${input.name}\n`);
      }
    } else if (write) {
      if (formatted !== input.text) emit(formatted, input, true);
    } else {
      emit(formatted, input, false);
    }
  }
  return check && unformatted > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// sort

function cmdSort(argv: string[]): number {
  const parsed = parseArgs(argv, [
    ...COMMON_FLAGS,
    { name: "--by", takesValue: true },
    { name: "--desc", takesValue: false },
    { name: "--mode", takesValue: true },
    { name: "--numeric", takesValue: false },
    { name: "--natural", takesValue: false },
    { name: "--string", takesValue: false },
  ]);
  const by = stringFlag(parsed, "--by");
  if (by === undefined) throw new Error('sort requires --by <column> (try --by Price or --by B)');

  let mode: SortMode = "auto";
  const modeFlag = stringFlag(parsed, "--mode");
  if (modeFlag !== undefined) {
    if (!["auto", "numeric", "natural", "string"].includes(modeFlag)) {
      throw new Error(`invalid --mode "${modeFlag}" (auto | numeric | natural | string)`);
    }
    mode = modeFlag as SortMode;
  }
  for (const shorthand of ["numeric", "natural", "string"] as const) {
    if (boolFlag(parsed, `--${shorthand}`)) mode = shorthand;
  }

  const input = readInput(atMostOnePositional(parsed.positionals, "sort"));
  const block = getTable(input.text, tableFlag(parsed));
  const col = resolveColumn(block.table, by);
  const sorted = sortTable(block.table, col, {
    mode,
    descending: boolFlag(parsed, "--desc"),
  });
  emit(
    replaceBlock(input.text, block, sorted),
    input,
    boolFlag(parsed, "--write"),
  );
  return 0;
}

// ---------------------------------------------------------------------------
// get / set

function cmdGet(argv: string[]): number {
  // get never rewrites anything, so it takes --table but not --write.
  const parsed = parseArgs(argv, [TABLE_FLAG]);
  const [refText, ...rest] = parsed.positionals;
  if (refText === undefined) throw new Error("get requires a reference (e.g. B2, 2, or a header name)");
  const input = readInput(atMostOnePositional(rest, "get"));
  const table = getTable(input.text, tableFlag(parsed)).table;

  const ref = parseRef(refText);
  if (ref.kind === "cell") {
    process.stdout.write(getCell(table, ref.address) + "\n");
  } else if (ref.kind === "row") {
    process.stdout.write(getRow(table, ref.row).join("\t") + "\n");
  } else {
    const col = resolveColumn(table, ref.ref);
    for (const cell of getColumn(table, col)) process.stdout.write(cell + "\n");
  }
  return 0;
}

function cmdSet(argv: string[]): number {
  const parsed = parseArgs(argv, COMMON_FLAGS);
  const [addrText, value, ...rest] = parsed.positionals;
  if (addrText === undefined || value === undefined) {
    throw new Error('set requires an address and a value (e.g. set B2 "in stock")');
  }
  const input = readInput(atMostOnePositional(rest, "set"));
  const block = getTable(input.text, tableFlag(parsed));
  const next = setCell(block.table, parseAddress(addrText), value);
  emit(replaceBlock(input.text, block, next), input, boolFlag(parsed, "--write"));
  return 0;
}

// ---------------------------------------------------------------------------
// edit

function applyEditOp(table: Table, name: string, value: string): Table {
  switch (name) {
    case "--set": {
      const eq = value.indexOf("=");
      if (eq <= 0) throw new Error(`--set expects <addr>=<value>, got "${value}"`);
      return setCell(table, parseAddress(value.slice(0, eq)), value.slice(eq + 1));
    }
    case "--add-row":
      return appendRow(table, splitRow(value));
    case "--del-row": {
      const n = Number(value);
      if (!Number.isInteger(n)) throw new Error(`--del-row expects a row number, got "${value}"`);
      return deleteRow(table, n);
    }
    case "--add-col":
      return appendColumn(table, value);
    case "--del-col":
      return deleteColumn(table, resolveColumn(table, value));
    default:
      throw new Error(`unknown edit operation "${name}"`);
  }
}

function cmdEdit(argv: string[]): number {
  const parsed = parseArgs(argv, [
    ...COMMON_FLAGS,
    { name: "--set", takesValue: true },
    { name: "--add-row", takesValue: true },
    { name: "--del-row", takesValue: true },
    { name: "--add-col", takesValue: true },
    { name: "--del-col", takesValue: true },
  ]);
  const ops = parsed.ordered.filter(
    (op) => op.name !== "--table" && op.name !== "--write",
  );
  if (ops.length === 0) {
    throw new Error("edit requires at least one operation (--set, --add-row, --del-row, --add-col, --del-col)");
  }
  const input = readInput(atMostOnePositional(parsed.positionals, "edit"));
  const block = getTable(input.text, tableFlag(parsed));
  let table = block.table;
  for (const op of ops) {
    table = applyEditOp(table, op.name, op.value as string);
  }
  emit(replaceBlock(input.text, block, table), input, boolFlag(parsed, "--write"));
  return 0;
}

// ---------------------------------------------------------------------------
// convert

type DataFormat = "md" | "csv" | "tsv";

function parseFormat(raw: string, flag: string): DataFormat {
  if (raw === "md" || raw === "csv" || raw === "tsv") return raw;
  throw new Error(`invalid ${flag} "${raw}" (md | csv | tsv)`);
}

function formatFromExtension(path: string | null): DataFormat {
  if (path === null) return "md";
  const ext = extname(path).toLowerCase();
  if (ext === ".csv") return "csv";
  if (ext === ".tsv") return "tsv";
  return "md";
}

function cmdConvert(argv: string[]): number {
  const parsed = parseArgs(argv, [
    TABLE_FLAG,
    { name: "--from", takesValue: true },
    { name: "--to", takesValue: true },
    { name: "--align", takesValue: true },
  ]);
  const input = readInput(atMostOnePositional(parsed.positionals, "convert"));

  const fromRaw = stringFlag(parsed, "--from");
  const from = fromRaw !== undefined
    ? parseFormat(fromRaw, "--from")
    : formatFromExtension(input.path);
  const toRaw = stringFlag(parsed, "--to");
  const to = toRaw !== undefined
    ? parseFormat(toRaw, "--to")
    : from === "md" ? "csv" : "md";

  // Normalize the source into rows of raw field values.
  const rows: string[][] =
    from === "md"
      ? tableToRows(getTable(input.text, tableFlag(parsed)).table)
      : parseDsv(input.text, from === "csv" ? "," : "\t");
  if (rows.length === 0) throw new Error("the input contains no rows");

  if (to === "md") {
    const alignSpec = stringFlag(parsed, "--align");
    const alignments = alignSpec === undefined ? [] : parseAlignSpec(alignSpec);
    process.stdout.write(renderTableText(rowsToTable(rows, alignments)));
  } else {
    process.stdout.write(writeDsv(rows, to === "csv" ? "," : "\t"));
  }
  return 0;
}

// ---------------------------------------------------------------------------
// info

function cmdInfo(argv: string[]): number {
  const parsed = parseArgs(argv, []);
  const input = readInput(atMostOnePositional(parsed.positionals, "info"));
  const blocks = findTables(input.text);
  if (blocks.length === 0) {
    process.stdout.write("no pipe tables found\n");
    return 0;
  }
  blocks.forEach((block, i) => {
    const t = block.table;
    process.stdout.write(
      `#${i + 1}  lines ${block.start + 1}-${block.end}  ` +
        `${t.header.length} cols x ${t.rows.length} rows  ` +
        `${t.header.join(" | ")}\n`,
    );
  });
  return 0;
}

// ---------------------------------------------------------------------------
// dispatch

const COMMANDS: Record<string, (argv: string[]) => number> = {
  fmt: cmdFmt,
  sort: cmdSort,
  get: cmdGet,
  set: cmdSet,
  edit: cmdEdit,
  convert: cmdConvert,
  info: cmdInfo,
};

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return command === undefined ? 2 : 0;
  }
  if (command === "--version" || command === "-V") {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  const handler = COMMANDS[command];
  if (handler === undefined) {
    process.stderr.write(`tablewright: unknown command "${command}" (run tablewright --help)\n`);
    return 2;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  try {
    return handler(rest);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`tablewright: ${message}\n`);
    return 2;
  }
}

process.exit(main(process.argv.slice(2)));
