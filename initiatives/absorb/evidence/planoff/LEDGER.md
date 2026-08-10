# absorb A/B outcome ledger

> **Append-only. One row per A/B run.** Never hand-reorder. This is the file that turns opinions
> about absorbed techniques into a record, exactly as `docs/evidence/planner-bench/LEDGER.md` does
> for planners. When a report's prose and this file disagree, this file wins.
>
> `verdict` is the OWNER's recorded pick (ADR-0603), not the runner's opinion, and `decision` is the
> `decision.recorded` ULID that carries it. A row with no decision ref is a run that was never
> judged — which is a legitimate state, and it is never an adoption.

| date | candidate | class | fixtures | old-way | absorbed-way | verdict | decision |
|---|---|---|---|---:|---:|---|---|
| 2026-08-09 | T-01 pre-emit finding verification | unspecified-input defect class | 3 named, 0 executed | n/a | n/a | blind pick: reviewproc-with-verification-gate ("read clearer") | 01KZKBYSQ5J46Y82PRN7W3AJNH |
| 2026-08-10 | T-01 pre-emit finding verification | unquotable-finding class (3 fixtures, 22 candidates) | 3 executed | 22 findings, 14 true / 8 false, precision 63.6% | 13 findings + 9 appendix, 8 true / 5 false, precision 61.5% | PRE-COMMITTED CONDITION: **NEW-WINS** (primary unresolvable-false-in-main 3 -> 0, true-lost 0). COMPOSITION, not part of that condition: **-2.1 pts precision**, because 6 of the 9 demoted are TRUE. Unclaimed class untouched: 5 of 8 false findings quote a real line byte-exactly. **OWNER PICKED THE OLD WAY** (quartz = old-way), reason `findings neraya iruku`. Harness said NEW-WINS on its claimed class; the human shown both outputs preferred the one without it. ADR-0603: the owner pick IS the verdict. Adoption is a SEPARATE inbox item (REQ-07) and the registry row moves on that ref, not this one | A/B pick 01KZN380GP5EDF58H6VRTT0S0T; **ADOPTED on 01KZN5H1E2RDHT9ZGQ4CSR85ZB** (`adopt; appendix irundhaalum ok`) -- the owner overruled a retire recommendation, so the two receipts point different ways and both stand |
