# Phase 05 live demo -- the debt-ledger reader on every real ledger

`readDebtLedger` from `.claude/scripts/plan/kickoff-gates.mjs`, run 2026-10-14 against the tree at
`feat/portfolio-cycle-5` (no lane's ledger edited):

| Lane | Data rows | Open | Closed (ids) | Over 20 -> next cycle needs a Debt: phase |
|---|---|---|---|---|
| face | 112 | 111 | 1 (D98) | yes (>= 20% of appetite) |
| design | 45 | 45 | 0 | yes |
| launch | 38 | 38 | 0 | yes |
| distribute | 24 | 23 | 1 (#3) | yes |
| policy | 13 | 13 | 0 | no |
| org | 9 | 9 | 0 | no |
| develop | 8 | 5 | 3 (D3, D6, D7) | no |
| discover | 7 | 7 | 0 | no |
| engine | 2 | 2 | 0 | no |
| docs, legal, memory | 0 | 0 | 0 | no |

**First run found a reader defect, fixed before commit:** distribute read 4 rows, not 24. Its ledger
appends rows under later prose without repeating the header (rows 5..24 sit between ``` REJECTED blocks),
and the first reader required a header + separator above every row. Now a pipe line after the first
table is a row of the last table seen, and lines inside code fences are never rows. Survey count (24)
and reader count now agree; discover (7) likewise.

## A4 hand-check -- 10 sampled rows plus one closed row

| Row | Disposition / lead cell (abridged) | Reader | Hand |
|---|---|---|---|
| distribute #2 | "mitigated, not closed: on 2026-10-07 ..." | open | open |
| distribute #11 | "accepted: the text must still parse ..." | open | open |
| distribute #20 | "accepted: the cap check runs right after ..." | open | open |
| distribute #3 | "fixed in the same commit via `native()` ..." | closed | closed |
| face D2 | type error in `face/src` does not fail CI; pay-down Phase 02 | open | open |
| face D11 | colour literal not caught before Phase 02/03 | open | open |
| face D20 | exemption rows make the browser report an orphan | open | open |
| face D29 | a gutted module ships green | open | open |
| launch D2 | slot timeout kills the worker not descendants ("closed for now only because ..." mid-cell) | open | open |
| launch D11 | logic surface timed out once at 420 s | open | open |
| launch D21 | `verifyBody` misreads a quote in a regex literal | open | open |

11 of 11 agree. **A4 held.** launch D2 is the case the leading-word rule exists for: "closed" appears
mid-cell ("closed for now only because ...") and the row is genuinely open.
