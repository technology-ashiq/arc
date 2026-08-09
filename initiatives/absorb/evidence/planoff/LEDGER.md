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
