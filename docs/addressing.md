# Addressing cells and columns

tablewright's editing commands take spreadsheet-style addresses. This
document is the normative reference; the rules here are stable API.

## Cell addresses

An address is column letters followed by a row number: `A1`, `B2`, `AA10`.

- **Columns** are letters, case-insensitive: `A` is the first column,
  `Z` the 26th, `AA` the 27th.
- **Rows**: `0` is the **header row**, `1` is the first body row. This is
  the one deliberate difference from spreadsheets — headers are cells too,
  so `set A0 Product` renames a column without a separate command.
- Out-of-range addresses are hard errors. `set` never grows the table
  implicitly; a typo like `B20` on a five-row table must not invent
  fifteen blank rows. Use `edit --add-row` to grow.

`get` also accepts two looser forms:

| Form | Example | Prints |
|---|---|---|
| Cell | `get B2` | the single cell value |
| Row | `get 2` (bare number) | the row's cells, tab-separated |
| Column | `get Price`, `get B`, `get #2` | the column's body cells, one per line |

Row 0 (`get 0`) prints the header row tab-separated. Column output
excludes the header on purpose: `tablewright get Price notes.md | sort -n`
should see data only.

## Column references

Wherever a command takes a *column* — `sort --by`, `edit --del-col`,
`get` — the reference is resolved in a fixed order:

1. **Exact header text** (`--by "Unit price"`).
2. **Case-insensitive header text** (`--by price`).
3. **Explicit index** `#N`, 1-based (`--by #3`). Never matches a header.
4. **Column letters** (`--by C`).
5. **Bare 1-based number** (`--by 3`).

Header text winning over letters means a column literally named `B` is
still reachable by name; when you need the *letter* meaning regardless of
headers, use `#N`. Unresolvable references fail with the full list of
available columns.

## Escapes and newlines inside cells

- A literal `|` in a cell is written `\|` in Markdown (GFM rule; applies
  even inside backtick code spans). tablewright decodes it on parse, so
  `get` prints a real `|`, and re-escapes it on render.
- Markdown cells cannot contain raw newlines. Converting *to* Markdown,
  newlines become `<br>`; converting *from* Markdown, `<br>`, `<br/>`
  and `<br />` become `\n`. This is what makes the csv → md → csv
  round-trip byte-identical for fields with embedded newlines.
- If a value passed to `set` contains a newline, it is stored as `<br>`
  so the edited cell can never break the row structure.

## Row repair

Hand-written tables are often ragged. When tablewright parses a table it
takes the widest row as the column count and pads shorter rows (header
included) with empty cells. Nothing is ever truncated — GFM renderers
silently drop overlong cells, but an editing tool must not lose data.
