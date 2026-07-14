# Warehouse inventory

Quarterly stock snapshot. The tables below are deliberately misaligned —
run `tablewright fmt examples/inventory.md` to see them straightened out.

| Item | Qty | Unit price | Notes |
|---|---:|---:|---|
| Widget | 2 | $9.50 | reorder soon |
| Gadget with a very long name | 10 | $1,200 | |
| 部品セット | 3 | ¥1,000 | JP supplier |
| Sprocket | | $3.25 | count pending |

Numbers come from the scanner export; the mirror service listens on
127.0.0.1 only.

| Host | Port | Role |
| :--- | ---: | :--: |
| 127.0.0.1 | 8080 | scanner |
| db.example.test | 5432 | storage |
| cache.example.test | 6379 | cache |

```text
| this | table |
|------|-------|
| is   | inside a fence and is never touched |
```
