# PROGRESS.md — arc-ledger "the money brain"

status: LIVE
cycle: arc-ledger (opened 2026-08-12)
phase: 00
appetite: 8d
burn: 1d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/ledger/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **1000–1099**; ADR-1000..1015 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Money math core — payload contract + PII validator, normalization, pnl math on pinned fixtures, `arc pnl` v0, 2 export parsers, twin-determinism | 3d | ⬜ not started |
| 01 | Kill-distance — `ventures.yaml` schema + parser, distance / warning / crossing render, brief needs-you integration, receipt enforcement | 2d | ⬜ not started |
| 02 | Close and costs — reconciliation gate, `month.closed` (44 to 45), cost trichotomy + Overhead, daily spend line, `--explain` if appetite holds | 2d | ⬜ not started |
| 03 | Proof — real-spine replay rendering honest-empty, `--simulated` demo view, evidence bundle, retro | 1d | ⬜ not started |

Phases sum to **8d against an 8d cap — there is no reserve.** That is deliberate and is recorded as
such: the shock absorber is the pre-authorized cut order (REQ-07, then REQ-08, then REQ-03's
80%-warning line), spent before the cap is rather than after.

## Appetite burn

**1d of 8d used (13%).** 50% tripwire at 4d: if REQ-01 and REQ-02 are not green on fixtures by then,
cut to the pnl-math lib only and bank it. At 100% we cut or kill, never extend.

## Phase 00 adversarial pass — two fresh surfaces, 30 findings

Run 2026-08-13, two agents, neither having seen the implementation written. Their findings
overlapped on **nothing**, which is the two-surface rule earning its keep (retro 2026-08-03:
7 passes, 77 holes, near-disjoint by surface).

**Decision logic — the PII control did not work.** Through the real ingest path, a mobile number,
a dotted personal name, a name-plus-date-of-birth, a PAN and an Aadhaar number all reached the
spine, as did a mobile number in the *required* `provider_payment_id`. The comment beside the
grammar asserted they could not be spelled in it; two of its three claims were false. Tokens now
need the shape a machine issues, and the residual limit (`ashiq_ahmed1994` still passes) is
written down rather than implied.

**And the suite could not have caught it.** 34 of 37 fixture ids were rejected by the lane's own
grammar, so the whole MRR section and 3 of 5 determinism tests died at the validator before
reaching the code they test. **CI confirmed this independently** on run 31633673658: `not ok`
817-821 plus the four determinism tests, exactly the nine the attacker predicted, and nothing else
in the repo. Nothing in this lane had ever exercised MRR — which is why four money defects were
sitting behind it (MRR in native currency rendered as rupees, the all-time view counting every
subscription that ever existed, a refund booked to the wrong venture, a fully refunded charge
still reporting MRR).

**Shell and byte boundary — a file git could not diff.** A literal NUL byte in `pnl.mjs` made git
classify the money core as binary: `0 insertions, 0 deletions` on a 1473-byte change, invisible to
ripgrep, and silently exempt from the repo's LF policy. Separately, data after a closing quote was
concatenated onto the value, so `"1180"00` became 118000 minor units — 100x, while leaving
`net == gross - tax - fees` intact so every other check passed it.

**Three of my own tests were vacuous**, each green with the implementation deleted: the runner
could not tell a missing parser from a rejected input; the CRLF test asserted `rows=*`, which a
header-only file satisfies; and half the PII cross-assertions named a column their fixture never
had. All four suites now assert their own registered count, derived rather than pinned.

## Done log

Nothing closed yet. `/arc-kickoff` completed 2026-08-12: PLAN.md, ADR-1000..1015 and
phases/phase-00..03-spec.md written; `kickoff-lint` green (one WARN, the zero-slack line, kept
deliberately); `board-lint` clean.

**Attack panel ×3 (tier M): 20 findings, 19 accepted, 1 rejected.** Focus A (edge cases) 7/7 —
including that the over-refund comparison had no defined currency, so FX drift between a charge and
its refund could fire or suppress the flag on rate movement alone. Focus B (scope and hidden
dependencies) 5 of 6 — two CI-red dependencies verified against the tree before acceptance:
`tests/policy-brief.bats` derives its coverage list from `KINDS`, so `month.closed` without an
`arc-brief.mjs` `GROUPS` entry fails that suite shut; and `tree-manifest.txt` carries 32
`.claude/scripts/hq/` entries. Focus C (pre-mortem, retro-seeded) 7/7 — the sharpest being that
Phase 3's entire acceptance IS a zero, and retro 2026-07-28 is the record of a zero explained away
for four days inside the phase built to catch it.

```
REJECTED: shared root organs belong in the External dependencies table — duplicate
```

**Simulation gate: TWO NON-ZERO ROUNDS — 7 blockers, then 6.** All 13 were closed by spec and PLAN
edits, but the gate never returned zero and, per the kickoff process, a third round was NOT run:
two non-zero rounds make it the owner's call. Round 2's findings included three defects introduced
by round 1's own fixes — an Appendix A example that violated the grammar written to constrain it, a
100x prose-to-JSON mismatch in the money example, and a Verification plan naming `arc-pnl` as the
binary under test when PLAN said ingest runs through `arc-event`. Round 2 also forced two real
design answers: the PII validator belongs in `validate-ledger.mjs` inside the emitter's own
validation path (the per-family pattern already in the tree), making it unskippable; and the money
fields carry a stated invariant (`gross == amount + tax`, `net == gross - tax - fees`) rather than
one example to reverse-engineer.

Spine receipts on the canonical spine (main clone), both confirmed present in
`events/2026-08-12.jsonl` and absent from `_quarantine/`:
`kickoff.done` `01KZVJZ6X4C0KJ1Y0K9RM69S50` · `approval.requested` `01KZVJZFTJ85GDVAWBBDAPN751`.

## Requirements

| REQ | Phase | Status |
|---|---|---|
| REQ-01 P&L is true and reproducible | 0 | active |
| REQ-02 MRR math survives its edge cases | 0 | active |
| REQ-03 Kill-distance is visible and tamper-evident | 1 | active |
| REQ-04 Currency honesty | 0 | active |
| REQ-05 A month closes only behind a green reconciliation | 2 | active |
| REQ-06 Costs are honest three ways | 2 | active |
| REQ-07 Every number explains itself | 2 | active (first cut) |
| REQ-08 Demo without lies | 3 | active (second cut) |

## Now

**Current position:** kickoff complete and STOPPED at the approval gate. The lane exists, the plan
is written, all sixteen ADRs are recorded in century 1000–1099, the four phase specs are written and
`kickoff-lint` passes. No product code has been written and none may be until the owner approves.

**Next step:** owner reviews `initiatives/ledger/PLAN.md` and the four phase specs, and rules on the
four items flagged at the STOP — (1) the A9 live-slot checklist item, which does not say what the
design source claims it says; (2) the policy-row checklist item, corrected by ADR-1011; (3) the four
forks decided at kickoff (ADR-1012 integer minor units, ADR-1013 USD, ADR-1014 no cache, ADR-1015
both reconciliation paths); and (4) **the simulation gate's two non-zero rounds**, which the process
makes a human call rather than a third respawn.

On approval, from the main clone:
`cd /e/Work_Hub/01_Automemory/arc && node .claude/scripts/hq/arc-inbox.mjs approve 01KZVJZFTJ85GDVAWBBDAPN751 --reason "approved"`
(a failed approve leaves no trace, so confirm the `decision.recorded` landed). Then begin Phase 0
with `validate-ledger.mjs`, which ships before any ingest path exists.
