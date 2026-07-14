# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-07-12

### Added

- `tablewright fmt`: aligns every pipe table in a Markdown document —
  canonical pipes, display-width padding (East Asian Wide characters
  count two columns, combining marks zero), alignment colons preserved,
  ragged rows repaired, everything outside tables passed through
  byte-for-byte. `--write` rewrites in place, `--check` exits 1 for CI.
- Fence-aware document scanning: tables inside ``` / ~~~ blocks and
  indented code blocks are never touched, and the GFM header/delimiter
  cell-count rule keeps prose and setext headings from being eaten.
- `tablewright sort`: sort a table's body rows by column with stable
  ordering, empties-last in both directions, and four comparators —
  `auto` (numeric when the whole column is numeric), `numeric`
  (tolerates `$1,200`, `42%`, `1_000`), `natural` (`v9` < `v10`) and
  `string`; all locale-independent.
- `tablewright get` / `set` / `edit`: spreadsheet-style cell addresses
  (`B2`, row 0 = header) and column references resolved header-first;
  ordered edit operations `--set`, `--add-row`, `--del-row`, `--add-col`,
  `--del-col` applied left to right.
- `tablewright convert`: Markdown ↔ CSV ↔ TSV with RFC 4180 quoting and
  a byte-identical csv → md → csv round-trip (embedded newlines travel
  as `<br>`); `--align` sets alignment when producing Markdown.
- `tablewright info`: lists each table's position, size and headers.
- Script-friendly exit codes (0 ok / 1 `fmt --check` differences /
  2 usage or I/O error) shared by all subcommands, stdin/stdout piping,
  and `--table N` selection everywhere.
- Public programmatic API (`parseTable`, `renderTable`, `formatDocument`,
  `sortTable`, `setCell`, `parseDsv`, `writeDsv`, …) with type
  declarations.
- Test suite: 91 node:test tests (unit + CLI integration in fresh temp
  dirs) and an end-to-end `scripts/smoke.sh` against the bundled
  examples.

[0.1.0]: https://github.com/JaydenCJ/tablewright/releases/tag/v0.1.0
