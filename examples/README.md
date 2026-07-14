# tablewright examples

Two small fixtures to try every command against. All commands below are
run from the repository root after `npm install && npm run build`; replace
`node dist/cli.js` with `tablewright` if you installed the package globally.

## Files

- `inventory.md` — a Markdown document with two deliberately misaligned
  tables (CJK cells, currency values, an empty cell) plus a fenced code
  block containing a fake table that must never be touched.
- `prices.csv` — an RFC 4180 CSV with a quoted comma and a field
  containing a real newline, for round-trip experiments.

## Format

```bash
node dist/cli.js fmt examples/inventory.md            # aligned copy to stdout
node dist/cli.js fmt --check examples/inventory.md    # exit 1: needs formatting
```

## Inspect and sort

```bash
node dist/cli.js info examples/inventory.md
node dist/cli.js sort examples/inventory.md --by "Unit price" --desc
node dist/cli.js sort examples/inventory.md --table 2 --by Port
```

The empty Qty cell of the Sprocket row always sorts last, ascending or
descending.

## Edit cells by address

```bash
node dist/cli.js get B2 examples/inventory.md           # Qty of row 2
node dist/cli.js get "Unit price" examples/inventory.md # whole column
node dist/cli.js set D4 "recounted" examples/inventory.md
node dist/cli.js edit examples/inventory.md \
  --add-col Status --set E1=ok --del-row 4
```

Row 0 is the header, so `set A0 Product` renames the first column.

## CSV round-trip

```bash
node dist/cli.js convert examples/prices.csv                # csv -> md
node dist/cli.js convert examples/prices.csv --align lrn    # with alignment
node dist/cli.js convert examples/inventory.md --to csv     # md -> csv
node dist/cli.js convert examples/prices.csv | node dist/cli.js convert --from md --to csv
```

The last pipeline prints `prices.csv` byte-identical: embedded newlines
travel through Markdown as `<br>` and come back out as real newlines.
