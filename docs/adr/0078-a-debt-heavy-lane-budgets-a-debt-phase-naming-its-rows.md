# ADR 0078 — A lane with more than 20 open debt rows opens its next cycle with a named debt phase

**Status:** accepted
**Date:** 2026-10-14
**Product:** `portfolio`
**Reversibility:** two-way
**Revisit trigger:** a debt ledger's closure wording is miscounted by the open-row rule below (a closed row counted open, or the reverse), or the threshold is reached by more than half the lanes

## Context
Debt ledgers grow and nothing makes a cycle pay them: face holds ~112 table rows, design ~45, launch ~38,
distribute ~24 (survey 2026-10-14, data rows, not yet split open/closed). The twelve ledgers use six
different header grammars and **none has an open/closed column** — closure is free text ("fixed",
"mitigated, not closed").

## Options considered
1. **Define "open" by a closed list of leading closure words in any cell, ids by `#` column or ordinal; require a `Debt:` phase row ≥ 20% of the PROGRESS `appetite:` that names its rows** — works on all six grammars without touching another lane's ledger.
2. **Add a `status` column to every ledger** — exact, but rewrites twelve lanes' files in this cycle (cross-lane edits to shared state for a portfolio rule).
3. **Count all rows** — the lint would charge a lane for debt it already paid.

## Decision
Option 1, in `kickoff-lint.mjs`, applied only to a new-cycle plan (ADR-0076):
- **Ledger:** `initiatives/<lane>/debt-ledger.md`; absent → the gate does not apply. Every markdown table's data rows count (header and `---` separator excluded).
- **Closed row:** a row whose first cell is wholly struck through (`~~…~~`), or where any cell, after trimming and stripping `*`/`~`/`` ` ``, begins with `closed`, `fixed`, `paid`, `resolved` or `done` (case-insensitive, word boundary). "mitigated, not closed" stays **open** — the word must lead the cell.
- **Row id:** the `#` cell when the table's first header is `#`; otherwise `D<n>`, the 1-based ordinal across the file's data rows.
- **Budget:** more than 20 open rows → the PLAN's phase table must hold a row whose capability cell starts `Debt:` with an appetite ≥ 20% of the PROGRESS header `appetite:` (both parsed as days), and that names ≥ 1 row as `debt #<id>` tokens, each an existing OPEN row. Otherwise `FAIL [debt-budget]` printing the open count, the needed days and the first five open ids.

## Consequences
Easier: one shared reading of every ledger, no lane's files rewritten. Harder: a ledger author who writes
"Fixed" mid-cell is read as open — the revisit trigger watches the count; the cheap fix is the lead word.
