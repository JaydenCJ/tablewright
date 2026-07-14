/**
 * tablewright public API.
 *
 * The CLI is a thin shell over these functions; everything here is pure
 * (strings and plain objects in, new values out) so the library is usable
 * from editors, build scripts and tests without touching the filesystem.
 */

export type {
  Alignment,
  CellAddress,
  SortMode,
  SortOptions,
  Table,
  TableBlock,
} from "./types.js";

// Parsing pipe tables and rows.
export {
  alignmentOf,
  hasUnescapedPipe,
  isDelimiterLine,
  parseTable,
  splitRow,
} from "./parse.js";

// Rendering tables to aligned Markdown.
export {
  columnWidths,
  escapeCell,
  renderTable,
  renderTableText,
} from "./format.js";

// Finding and rewriting tables inside documents.
export {
  findTables,
  formatDocument,
  getTable,
  replaceBlock,
} from "./document.js";

// Addresses and column references.
export {
  columnLetterToIndex,
  indexToColumnLetter,
  parseAddress,
  parseRef,
  resolveColumn,
  type Ref,
} from "./address.js";

// Sorting.
export {
  compareCells,
  detectMode,
  naturalCompare,
  parseNumeric,
  sortTable,
} from "./sort.js";

// Structural edits.
export {
  appendColumn,
  appendRow,
  deleteColumn,
  deleteRow,
  getCell,
  getColumn,
  getRow,
  setCell,
} from "./edit.js";

// CSV/TSV and conversion.
export { parseDsv, writeDsv } from "./csv.js";
export {
  brToNewlines,
  newlinesToBr,
  parseAlignSpec,
  rowsToTable,
  tableToRows,
} from "./convert.js";

// Display width (exposed because alignment consumers often need it).
export { charWidth, displayWidth } from "./width.js";

export { VERSION } from "./version.js";
