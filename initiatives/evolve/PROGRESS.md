# PROGRESS.md — Cycle 7 · arc-evolve "The Self-Improvement Engine"

status: LIVE
cycle: arc-evolve (Cycle 7, opened 2026-08-03)
phase: 00 — awaiting owner approval before any code
appetite: 7d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane evolve` on 2026-08-03 and claims **ADR band
> 0300–0399**. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`,
> `tests/`) stay at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/evolve/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-evolve.md` (v1.0, frozen — the decision record, not
> this cycle). Model policy is inherited from `docs/adr/0069-balanced-model-policy.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + steel thread — manifest schema, `product-lint` extension, 8 kinds + validators, grammar, one receipt end-to-end | 1.5 days | ⬜ pending |
| 01 | Board — reader-only reducer; `PENDING` / staleness / `MISSING` / `insufficient evidence`; stream separation | 1.0 days | ⬜ pending |
| 02 | Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference vectors | 1.5 days | ⬜ pending |
| 03 | Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, revert path | 1.5 days | ⬜ pending |
| 04 | Council bridge — **THE DESIGNATED CUT** | 1.5 days | ⬜ pending |

**Appetite burn: 0 of 7 days used (0%).** Phases 00–03 (the core engine) allocate **5.5 days**.
Phase 04 allocates the remaining 1.5d and is the designated cut — it is simultaneously the only
slack in the cycle. That is deliberate and it is the lesson `arc-portfolio` paid for: Cycle 4
allocated 100% with zero slack, `appetite-sum` warned on every run, Phase 02 overran 0.35d with
nothing to absorb it, and the cycle closed at ~112%. Here the overrun absorber is a phase that
was pre-decided as cuttable, rather than slack nobody named.

**Kill checkpoint: at 3.5 days burned (50%), is REQ-02 met?** — i.e. does a wiped-and-replayed
spine produce a byte-identical board? If not, the reader-only derivation is fighting the spine:
bank the contract, lint and vocabulary ADRs as documentation, stop, retro.

## Done log

Nothing closed yet — the cycle has not started. Kickoff produced `PLAN.md`, 11 ADRs (0300–0310)
and 5 phase specs on 2026-08-03, and STOPPED for owner approval per the kickoff contract.

## Now

**Current position: kickoff complete, awaiting explicit owner approval. No product code exists
and none may be written until that approval lands.**

**This cycle is built ahead of its trigger, and that is on the record (ADR-0300).** The
pre-kickoff gate was verified in-tree at kickoff and **all five rows are unevidenced**: no client
module is named, `metric.observed` is not in `KINDS` (so 4 weeks of receipts are technically
impossible, not merely absent), and rows 3–5 have nothing to derive from. The owner was shown
this evidence and directed the build forward twice. The build proceeds fixture-proven; the
operational runway does not start.

**What that costs, stated up front so the close cannot be surprised by it:** Phase 03's "first
real experiment OPENED on the chosen surface" is **cut and banked**, not delivered. This cycle
must close saying its north-star claim is *fixture-proven, unexercised* — the `engine` lane's
REQ-08 partial is the precedent for reporting a partial claim as partial rather than waiving it,
and this lane inherits that standard.

**To start Phase 00, in this order:**
1. Owner approves the plan (`arc-inbox approve <id>` against the `approval.requested` receipt).
2. `/arc-develop start 0 --lane evolve` — turn the approved phase into proven slices.
3. Phase 00's first red test is already named in its spec: `bats tests/evolve-contract.bats`
   fails with `expected exit 2, got 0`, and `bats tests/evolve-receipts.bats` fails with the
   receipt in `_quarantine/` carrying `UNKNOWN_KIND`. Both are the exact states verified in-tree
   at kickoff, so red-before-green is already evidenced rather than assumed.
