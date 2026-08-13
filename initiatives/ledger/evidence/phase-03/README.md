# Phase 03 evidence — the live spine, and the zero that was tested rather than accepted

Captured 2026-08-13 against the **canonical spine** in the main clone
(`/e/Work_Hub/01_Automemory/arc/.claude/state/hq`), not a fixture and not a worktree spine. The
spine is gitignored and per-clone, so this is the only place the real numbers exist.

## The acceptance of this phase is an empty answer

`arc pnl` on the live spine renders **"no real revenue yet"**, with no fabricated figure anywhere
in it. That IS the proof, not a disappointing result to work around.

## …which is exactly why the zero is corroborated (`corroborated-zero.txt`)

A zero from a working reader and a zero from a broken one look identical. Retro 2026-07-28
(arc-cycle2) records a day of zero receipts read as "no work happened" when work HAD happened and
the instrument was wrong for four days — inside the very phase built to catch it.

So the zero is counted **twice, independently**:

| | method | touches |
|---|---|---|
| RAW | `readFileSync` + `split` + `JSON.parse` over `events/*.jsonl` | no lane code at all |
| READER | `spine.mjs` `query()` | the only sanctioned path, and what `arc pnl` actually uses |

```
day files 17   raw lines 1038   engine scan
ok   the instrument is ALIVE: the reader returns a non-zero event count  reader=1038
ok   raw and reader agree on the TOTAL event count  raw=1038 reader=1038
ok   raw and reader agree on EVERY kind's count  11 kinds compared

revenue.received   raw=0 reader=0
revenue.simulated  raw=0 reader=0
cost.incurred      raw=0 reader=0
month.closed       raw=0 reader=0
```

**The liveness control is asserted FIRST and is the load-bearing half.** A reader returning nothing
at all would agree with a zero on every money kind while being completely broken; the agreement
only means something because the same reader returns 1038 events across 11 other kinds, and agrees
with the raw count on every one of them.

## Production counts, stated rather than discovered later

**`month.closed` on the live spine: 0.** The mechanism is proven against fixtures and has never
been run on a real month, because there has never been a real month to close. Retro 2026-08-10
(arc-policy) records an entire engine shipping with four new kinds and zero real emissions; this
line exists so the number is said out loud.

## `--simulated` (REQ-08) — `live-spine-simulated-view.txt`

Shipped rather than cut; the appetite held. Every line carries the `SIMULATED` mark, not just the
header — a header scrolls off, and a screenshot of the middle of a simulated P&L must not be
mistakable for the real thing.

The two views are **structurally separate, not filtered**: `cmp` reports the real and simulated
renders differ, and the simulated view says out loud that there is no `cost.simulated` kind rather
than showing an empty cost section that would read as "costs are zero".

## The kill panel renders ABSENT on both criteria, with reasons — and that is correct

Neither criterion can be evaluated today (ADR-1018): ledger has no traffic source at all, and
`days_without_revenue` has no zero to count from for a venture that has never earned. Both rows are
PRINTED with their reasons and counted (`2 criteria could not be evaluated`) rather than dropped.
A list that silently omits what it could not evaluate is shorter and greener than the truth.

## The genesis criteria receipt

`ventures.yaml` was committed with no receipt on this spine, which would have made `arc pnl` exit 3
and `arc brief` print NOT EVALUATED repo-wide the moment this branch merged — found by the Phase 01
adversarial pass (finding F6), invisible in the worktree because the linked-worktree spine guard
fires first.

Emitted here: `approval.requested[ledger.criteria]` **`01KZX6D7J1D1FGKX8YGA4WQX1W`** carrying digest
`095766c66154f307c0ec419e6212c0a2e62f2c0fb467a996e64a7cfb2ec3443a`, approved through `arc-inbox`.
Confirmed **present in `events/` and absent from `events/_quarantine/`** by listing both — retro
2026-08-02 records an emitter exiting 0 while every receipt it wrote was quarantined, so the exit
code is not the evidence.

There is no genesis exemption: the first `ventures.yaml` needed a receipt exactly as the tenth edit
will.

## Engine (`engine-announced.txt`, ADR-1014)

The engine is announced on **stderr** and never on stdout. If it were part of the rendered P&L the
two determinism legs would differ by construction and the byte-identity they exist to prove would
be impossible. The criteria PATH rides there too, for the same reason: a path is different bytes on
ubuntu, macos and windows, and this stdout is compared against a golden on all three. The DIGEST is
on stdout, because it identifies the criteria exactly and is identical everywhere.

## Closure language

**Mechanism proven, live value pending.** The live-value milestone is the first real month closed
behind a green reconciliation, expected around September or October 2026 when LexOS earns. It is
explicitly not a gate on this closure.
