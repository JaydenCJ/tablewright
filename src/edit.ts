/**
 * Structural edits: read/write cells by address, add and delete rows and
 * columns. Every function returns a **new** table — inputs are never
 * mutated, so a CLI `edit` pipeline can apply operations left to right
 * and a failing step leaves nothing half-changed.
 *
 * Row addressing matches `parseAddress`: row 0 is the header, rows 1..n
 * are body rows. Out-of-range addresses are hard errors, never silent
 * growth — a typo like `B20` on a five-row table should not invent
 * fifteen blank rows.
 */

import { indexToColumnLetter } from "./address.js";
import type { Alignment, CellAddress, Table } from "./types.js";

function checkCol(table: Table, col: number): void {
  if (!Number.isInteger(col) || col < 0 || col >= table.header.length) {
    const last = indexToColumnLetter(Math.max(0, table.header.length - 1));
    throw new Error(
      `column is out of range (table has columns A–${last})`,
    );
  }
}

function checkRow(table: Table, row: number): void {
  if (!Number.isInteger(row) || row < 0 || row > table.rows.length) {
    throw new Error(
      `row ${row} is out of range (0 = header, body rows 1–${table.rows.length})`,
    );
  }
}

function cloneTable(table: Table): Table {
  return {
    header: [...table.header],
    alignments: [...table.alignments],
    rows: table.rows.map((r) => [...r]),
  };
}

/** Read one cell; address row 0 reads the header. */
export function getCell(table: Table, address: CellAddress): string {
  checkCol(table, address.col);
  checkRow(table, address.row);
  return address.row === 0
    ? table.header[address.col]!
    : table.rows[address.row - 1]![address.col]!;
}

/** Write one cell; address row 0 renames the header. */
export function setCell(
  table: Table,
  address: CellAddress,
  value: string,
): Table {
  checkCol(table, address.col);
  checkRow(table, address.row);
  const next = cloneTable(table);
  if (address.row === 0) {
    next.header[address.col] = value;
  } else {
    next.rows[address.row - 1]![address.col] = value;
  }
  return next;
}

/** Read a whole row; row 0 is the header. */
export function getRow(table: Table, row: number): string[] {
  checkRow(table, row);
  return row === 0 ? [...table.header] : [...table.rows[row - 1]!];
}

/** Read a whole column's body cells (the header is addressable as row 0). */
export function getColumn(table: Table, col: number): string[] {
  checkCol(table, col);
  return table.rows.map((r) => r[col]!);
}

/**
 * Append a body row. Shorter rows are padded with empty cells; a row
 * with *more* cells than the table has columns is an error, because
 * silently dropping data is worse than failing.
 */
export function appendRow(table: Table, cells: string[]): Table {
  const cols = table.header.length;
  if (cells.length > cols) {
    throw new Error(
      `row has ${cells.length} cell(s) but the table has ${cols} column(s)`,
    );
  }
  const next = cloneTable(table);
  const row = [...cells];
  while (row.length < cols) row.push("");
  next.rows.push(row);
  return next;
}

/** Delete body row `row` (1-based; the header cannot be deleted). */
export function deleteRow(table: Table, row: number): Table {
  if (row === 0) {
    throw new Error("cannot delete the header row (row 0)");
  }
  checkRow(table, row);
  const next = cloneTable(table);
  next.rows.splice(row - 1, 1);
  return next;
}

/** Append an empty column with the given header and alignment. */
export function appendColumn(
  table: Table,
  header: string,
  alignment: Alignment = "none",
): Table {
  const next = cloneTable(table);
  next.header.push(header);
  next.alignments.push(alignment);
  for (const row of next.rows) row.push("");
  return next;
}

/** Delete a column by index; a table must keep at least one column. */
export function deleteColumn(table: Table, col: number): Table {
  checkCol(table, col);
  if (table.header.length === 1) {
    throw new Error("cannot delete the only column");
  }
  const next = cloneTable(table);
  next.header.splice(col, 1);
  next.alignments.splice(col, 1);
  for (const row of next.rows) row.splice(col, 1);
  return next;
}
