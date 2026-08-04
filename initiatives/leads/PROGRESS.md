# PROGRESS.md — Cycle 8 · arc-leads "The Outbound Engine"

status: LIVE
cycle: arc-leads (Cycle 8, opened 2026-08-04)
phase: 00
appetite: 7d
burn: 1.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Born by `/arc-kickoff --lane leads` on 2026-08-04; claims **ADR band 0400–0499**.
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay
> at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/leads/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-leads.md` (v1.0, frozen 2026-08-03).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Foundations — ADR-0410 store + secret + tripwire FIRST, ADR-0400 vocabulary + validators, ADR-0408 `metric.observed`, ADR-0411 journal schema, researcher + dossiers + provenance lint, deliverability preflight, provider interface + fake | 1.5d | code complete, CI green — **NOT closed**: 2nd adversarial surface + evidence bundle owed |
| 01 | Sequencer — caps, suppression, breakers, receipt-derived state, spine-first reconcile, personalization lint + similarity, ADR-0412 review boundary, send-moment guard | 2.0d | core modules written, **unwired and untested** |
| 02 | Replies — ingestion, parser, triage, calendar drafts, auto-stop | 1.0d | not started |
| 03 | Real campaign | 1.0d | 🚫 **BLOCKED** |

**Appetite burn: 1.5 of 7 days used (21%).** 5.5d allocated across the four phases; **1.5d
deliberately unallocated** as the overrun absorber — the arc-portfolio lesson (Cycle 4
allocated 100%, `appetite-sum` warned every run, Phase 02 overran with nothing to absorb it,
closed ~112%).

**Kill checkpoint: at 3.5 days burned (50%), are REQ-03's cap/suppression fixtures green?**
If not: stop. Nothing sends, ever, without the guard. Bank the ADR-0400 vocabulary and the
ADR-0404 lint as documentation, retro.

## Phase 03 is BLOCKED — the four things code cannot supply

| # | Gate row | Who unblocks | Cost |
|---|---|---|---|
| 1 | A real offer, named | owner | blocked on LexOS billing (P5, Sep '26) |
| 2 | **Dedicated domain warmed ≥14d + DMARC green** | owner | **2–4 calendar weeks — the long pole** |
| 3 | ICP v0 file | owner | ~1 hour |
| 4 | Calendar link live | owner | ~15 min |
| 5 | Capability report → provider + verifier | `/arc-capability` | ~1 session |
| 6 | LEA-I / EVO-H0 ruling | ✔ resolved — ADR-0408 | done |

Rows 2–4 are **calendar-gated, not effort-gated** — start them the moment outbound is
plausibly ≤6 weeks away. Row 2 is the critical path and cannot be compressed.

## Done log

- **2026-08-04 — kickoff.** Lane born, ADR band 0400–0499 claimed. 14 ADRs, PLAN, 4 phase
  specs. Gates: `kickoff-lint` green · attacker panel ×3 (21 findings, 20 applied, 1
  applied-with-fix, 0 rejected) · `plan-simulator` 13 → 12 → 2 → 0 blockers.
- **2026-08-04 — Phase 00 code complete, CI green** (PR #111, all legs). Vocabulary 31 → 39,
  private store outside the repo, PII tripwire, researcher + provenance/jurisdiction lint,
  deliverability preflight, provider interface + fake. Demo: 25 PASS / 1 HELD / 3 BELOW-BAR /
  5 REJECTED, 29 dossiers, 29 receipts, 0 quarantined.
- **2026-08-04 — adversarial pass, decision-logic surface.** One fresh agent, **22 confirmed
  breaking inputs while CI was green**, all closed and pinned as fixtures. Four broke a stated
  safety property (id canonicalization, Unicode suppression bypass, fail-open verification,
  non-total idem preimages). Four were twin-fix recurrences of this lane's own running defect
  list — including D3 itself, and a D4 twin where both tests protecting a safety property
  matched the rejection MESSAGE TEMPLATE rather than the input.

## Now

**Current position:** Phase 00 code is complete and CI-green. **Phase 00 is NOT closed.**

**What Phase 00 still owes before `/arc-phase-done 0`:**

1. **The second adversarial surface — shell/OS boundary** (`pii-tripwire.sh`, path handling
   across the three CI legs). The rule is TWO fresh agents with *different* surfaces; one has
   run. A single agent's blind spot is structural, not a matter of effort.
2. The evidence bundle at `initiatives/leads/evidence/phase-00/`.

**Then Phase 01.** Its safety core is written but **unwired and untested**: `caps.mjs`,
`journal.mjs` (two-phase intent + spine-first reconcile), `guard.mjs` (eight-step chain +
single-writer lock), `personalization.mjs`. None of it has a CLI surface or a fixture yet, and
Phase 01 carries six mandatory adversarial passes of its own.

**Standing constraint:** no local test runs — CI is the only gate. Batch commits so each push
buys a full CI cycle.

**Standing caution (ADR-0413):** this cycle produces a **fixture-proven, unexercised** engine.
It does not make outbound ready. Every provider fixture encodes a guess at a vendor that has
not been chosen; the first real campaign is what tests them.
