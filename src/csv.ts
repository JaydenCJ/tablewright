/**
 * RFC 4180 CSV reading and writing, parameterized by delimiter so the
 * same code handles TSV.
 *
 * The parser is a small state machine, not a regex: quoted fields may
 * contain the delimiter, doubled quotes (`""` → `"`) and real newlines,
 * and records may end in LF or CRLF. It is deliberately lenient where
 * real-world files are messy — a quote in the middle of an unquoted
 * field is literal, and an unterminated quote runs to end of input.
 *
 * The writer is strict: a field is quoted iff it contains the delimiter,
 * a quote, a newline, or leading/trailing whitespace, so output always
 * re-parses to the same values (round-trip enforced by tests).
 */

/** Parse delimiter-separated text into rows of raw field values. */
export function parseDsv(text: string, delimiter = ","): string[][] {
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === "\n") {
    throw new Error(`invalid delimiter ${JSON.stringify(delimiter)}`);
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let fieldStarted = false; // distinguishes "" (no field) from an empty field
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      fieldStarted = false;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      fieldStarted = false;
      continue;
    }
    field += ch;
    fieldStarted = true;
  }
  // Flush a final record that has no trailing newline.
  if (field !== "" || fieldStarted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** True if a field must be quoted to survive a round-trip. */
function needsQuoting(field: string, delimiter: string): boolean {
  return (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r") ||
    /^\s|\s$/.test(field)
  );
}

/**
 * Serialize rows to delimiter-separated text with a trailing newline.
 * Records are LF-terminated; fields are quoted only when required.
 */
export function writeDsv(rows: string[][], delimiter = ","): string {
  if (delimiter.length !== 1 || delimiter === '"' || delimiter === "\n") {
    throw new Error(`invalid delimiter ${JSON.stringify(delimiter)}`);
  }
  if (rows.length === 0) return "";
  const lines = rows.map((row) =>
    row
      .map((field) =>
        needsQuoting(field, delimiter)
          ? '"' + field.replace(/"/g, '""') + '"'
          : field,
      )
      .join(delimiter),
  );
  return lines.join("\n") + "\n";
}
