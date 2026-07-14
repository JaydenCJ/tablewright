# Contributing to tablewright

Issues, discussions and pull requests are all welcome — this project aims
to stay small, zero-dependency at runtime, and predictable for scripts.

## Getting started

Requirements: Node.js >= 22.13 (for the stable `node:test` runner used by the suite).

```bash
git clone https://github.com/JaydenCJ/tablewright.git
cd tablewright
npm install            # installs typescript, the only devDependency
npm run build          # compile TypeScript to dist/
npm test               # build + 91 node:test tests
bash scripts/smoke.sh  # end-to-end CLI check against examples/
```

`scripts/smoke.sh` exercises the real CLI (fmt, sort, get/set/edit,
convert round-trips, exit codes, idempotency) against the bundled example
files and must print `SMOKE OK`.

## Before you open a pull request

1. `npx tsc -p tsconfig.json --noEmit` — the tree must type-check clean (strict mode is enforced).
2. `npm test` — all tests must pass.
3. `bash scripts/smoke.sh` — must print `SMOKE OK`.
4. Add tests for behavior changes; keep logic in pure, unit-testable
   modules (parsing/formatting/sorting take values, not file handles —
   only `cli.ts` touches the filesystem).
5. Formatting changes to rendered output are breaking for anyone diffing
   files in CI: call them out explicitly in the PR description.

## Ground rules

- **No runtime dependencies.** The zero-dependency install is a core
  feature; adding one needs justification in the PR and will usually be
  declined.
- No network calls, ever — the tool reads and writes local files only.
- Determinism is API: same input, same flags, byte-identical output, on
  every platform and under every locale (no `localeCompare`, no `Date`).
- The column-reference resolution order (header text, `#N`, letters,
  bare number) is documented contract: never reorder it.
- Code comments and doc comments are written in English.

## Reporting bugs

Please include: `tablewright --version` output, the exact command line,
the smallest input document (or CSV) that reproduces the problem, and
what you expected. For alignment bugs, mention the terminal/font, since
display width is the usual suspect.

## Security

Do not open public issues for security problems; use GitHub private
vulnerability reporting on this repository instead.
