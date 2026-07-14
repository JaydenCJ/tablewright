#!/usr/bin/env bash
# Smoke test for tablewright: exercises the real CLI end to end against
# the bundled example files. No network, idempotent, runs from a clean
# checkout (after `npm install`). Prints "SMOKE OK" on success.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd)"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

# 1. Build (idempotent).
npm run build >/dev/null 2>&1 || fail "npm run build failed"
CLI="node $ROOT/dist/cli.js"
echo "[smoke] build ok"

# 2. --version matches package.json; --help documents every command.
PKG_VERSION="$(node -p "require('$ROOT/package.json').version")"
CLI_VERSION="$($CLI --version)"
[ "$CLI_VERSION" = "$PKG_VERSION" ] || fail "--version mismatch: $CLI_VERSION != $PKG_VERSION"
HELP="$($CLI --help)"
for word in fmt sort get set edit convert info; do
  echo "$HELP" | grep -q "$word" || fail "--help missing $word"
done
echo "[smoke] --help/--version ok ($CLI_VERSION)"

# 3. Error handling: unknown commands and impossible requests exit 2.
set +e
$CLI frobnicate >/dev/null 2>&1; [ $? -eq 2 ] || { set -e; fail "unknown command should exit 2"; }
echo "no tables" | $CLI sort --by A >/dev/null 2>&1; [ $? -eq 2 ] || { set -e; fail "sort without tables should exit 2"; }
set -e
echo "[smoke] error handling ok (exit 2)"

# 4. fmt: --check flags the messy example, --write fixes it, --check passes.
cp examples/inventory.md "$WORKDIR/inventory.md"
set +e
$CLI fmt --check "$WORKDIR/inventory.md" >/dev/null; CHECK1=$?
set -e
[ "$CHECK1" -eq 1 ] || fail "fmt --check on the messy example should exit 1, got $CHECK1"
$CLI fmt --write "$WORKDIR/inventory.md" || fail "fmt --write failed"
$CLI fmt --check "$WORKDIR/inventory.md" >/dev/null || fail "fmt --check should pass after --write"
grep -q '| 部品セット                   |' "$WORKDIR/inventory.md" || fail "CJK column not padded by display width"
grep -q '| is   | inside a fence and is never touched |' "$WORKDIR/inventory.md" \
  || fail "fmt touched a table inside a code fence"
echo "[smoke] fmt --check/--write ok"

# 5. Formatting is idempotent: a second fmt changes nothing.
$CLI fmt "$WORKDIR/inventory.md" > "$WORKDIR/second.md" || fail "second fmt failed"
cmp -s "$WORKDIR/inventory.md" "$WORKDIR/second.md" || fail "fmt is not idempotent"
echo "[smoke] idempotency ok"

# 6. info sees both tables (and not the fenced fake).
INFO="$($CLI info "$WORKDIR/inventory.md")"
[ "$(echo "$INFO" | wc -l)" -eq 2 ] || fail "info should list exactly 2 tables: $INFO"
echo "$INFO" | grep -q 'Item | Qty | Unit price | Notes' || fail "info missing table 1 headers"
echo "[smoke] info ok"

# 7. sort: descending by price puts $1,200 first; the empty cell stays last.
$CLI sort "$WORKDIR/inventory.md" --by "Unit price" --desc > "$WORKDIR/sorted.md" || fail "sort failed"
FIRST_ROW="$(sed -n '8p' "$WORKDIR/sorted.md")"
echo "$FIRST_ROW" | grep -q 'Gadget with a very long name' || fail "sort --desc: expected the \$1,200 row first, got: $FIRST_ROW"
LAST_ROW="$(sed -n '11p' "$WORKDIR/sorted.md")"
echo "$LAST_ROW" | grep -q 'Sprocket' || fail "sort: the empty-price row should sink to the bottom, got: $LAST_ROW"
echo "[smoke] sort ok (numeric auto-detect, empties last)"

# 8. get/set/edit: cell addressing round-trip on table 2.
[ "$($CLI get B2 --table 2 "$WORKDIR/inventory.md")" = "5432" ] || fail "get B2 --table 2 should print 5432"
$CLI set C3 standby "$WORKDIR/inventory.md" --table 2 --write || fail "set failed"
[ "$($CLI get C3 --table 2 "$WORKDIR/inventory.md")" = "standby" ] || fail "get after set should print standby"
$CLI edit "$WORKDIR/inventory.md" --add-col Status --set E1=ok --del-row 4 --write || fail "edit failed"
[ "$($CLI get E1 "$WORKDIR/inventory.md")" = "ok" ] || fail "edit --set E1=ok not applied"
grep -q 'Sprocket' "$WORKDIR/inventory.md" && fail "edit --del-row 4 did not remove the Sprocket row"
echo "[smoke] get/set/edit ok"

# 9. convert: csv -> md -> csv is byte-identical (embedded newline survives).
$CLI convert examples/prices.csv --to md > "$WORKDIR/prices.md" || fail "csv->md failed"
grep -q 'two<br>lines' "$WORKDIR/prices.md" || fail "embedded newline not mapped to <br>"
$CLI convert "$WORKDIR/prices.md" --from md --to csv > "$WORKDIR/prices2.csv" || fail "md->csv failed"
cmp -s examples/prices.csv "$WORKDIR/prices2.csv" || fail "csv -> md -> csv round-trip not byte-identical"
echo "[smoke] csv round-trip ok"

# 10. convert: md -> tsv and back through stdin pipes.
$CLI convert "$WORKDIR/inventory.md" --to tsv --table 2 > "$WORKDIR/hosts.tsv" || fail "md->tsv failed"
grep -q "$(printf 'Host\tPort\tRole')" "$WORKDIR/hosts.tsv" || fail "tsv missing tab-separated header"
$CLI convert - --from tsv --to md < "$WORKDIR/hosts.tsv" | grep -q '| db.example.test' \
  || fail "tsv->md via stdin failed"
echo "[smoke] tsv + stdin pipes ok"

echo "SMOKE OK"
