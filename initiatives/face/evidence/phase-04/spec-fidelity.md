# Phase 04 — spec-fidelity pass (2026-09-18)

A fresh `spec-fidelity` agent read only `phases/phase-04-spec.md`, REQ-06 as amended by ADR-1338, and
`git diff origin/main...HEAD` at `348c3783`. **Verdict: DRIFT FOUND.** Every finding is dispositioned below; the
interpretations are also a current-phase note in the spec, so the owner reads them at the close, not in a log.

## Exit criteria, as the pass read them

| # | criterion | pass said | disposition |
|---|---|---|---|
| 1 | route list derived from the Phase 03 lists | met | -- |
| 2 | GET, allow-list, posture; parser imported | met; parser "partly met" | see drift 1 |
| 3 | reader-only lint; route enumeration | met (lint is a CI fact) | CI 19/19 on the head and on `main` |
| 4 | an arm per route, fixture proven loaded | met; the by-day arm checks shape only | the door's day series over the fixture's own day is proven in `phase04-folds` ("PNL DOOR" checks, the clock forced to that day) |
| 5 | served / residue, none dropped | met (35 + 15 = 50) | -- |
| 6 | union over 22 re-scopes | not triggered (22) | -- |
| 7 | attackers, CI, phase-done | not evaluable from the diff | four rounds (`attackers.md`); CI per job; this close |
| 8 | the round-3 current-phase note | met | -- |

## Drift, and what was done with each

1. **"Parser imported" on the log routes.** `/api/council`, `/api/legal` and `/api/bench` fold a join over receipts
   that no lane exports (verdict to outcome, approval to decision verdict, a run's classes); the parser check in
   dash-doors accepts `hq/spine.mjs#readAll`. **DECLARED** in the spec note: for receipts the parser is the spine
   reader; the joins are a line or two each. **DEBT** row: the owning lane exports the join on its next change.
2. **Additive exports in two owning lanes** (`deriveDaily` in the ledger's `pnl.mjs`, absorb's `judgeRegistry`),
   while ADR-1338 left three lints' inline parsers as residue. **DECLARED** in the spec note as an inconsistency the
   owner may rule on; not silently reconciled.
3. **"Fourteen days" shipped as three tables**, cost as lines per currency. **DECLARED**: real and simulated are
   never one row (non-negotiable), and a cost line carries no rate (ADR-1003), so there is no amount to sum.
4. **Read-only routes write a temp file** (`readCopy`, per request, OS temp, removed). **DECLARED**: no repo or spine
   write; it is how the hashed bytes and the parsed bytes are the same bytes.
5. **The criterion 5 bound changed inside the phase.** **RECORDED**: the owner ruled (ADR-1338), and the assumption
   behind the bound is FIRED in the ledger.
6. **Scope beyond the note** (the spine reader's torn and unreadable-day reporting; the boot clock check; four split
   panels). **DECLARED** in the spec note: each came from an attacker round that turned the old behaviour into a 500
   or a silent gap on a Phase 04 route.
7. **`/api/decide` parity under the shared catch's scrub.** Not evaluable from the diff; the parity suite
   (`dash-parity`) is green on CI per job, and parity is on the WRITE (the representation contract).

## What the owner now sees (the pass's own words, kept)

35 panels that used to say NOT SERVED now show real tables -- the policy ladder, job schedules, experiments,
lessons, council verdicts, slices, gate modes, the leads funnel, the seals, the ADR list, and a 14-day money view.
The other 15 still say NOT SERVED, but each names why and which lane owns the gap.
