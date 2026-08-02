# ADR 0101 — develop-lint's floor: structural checks BLOCK, heuristic checks WARN-first

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** one-way
**Revisit trigger:** the first false positive from a structural BLOCK on a legitimate ledger — that
check drops to WARN and enters `docs/trial-ledger.md` like any other gate, and this ADR is superseded.

## Context

The design source contradicts itself. §6.2 lists the v1 develop-lint floor as FAIL: ticked slice
without declared proof, brief missing or stale, ledger unparseable, self-declared numbers in ledger
rows. §12 states the opposite as policy: *every* develop-lint gate ships WARN and promotes to BLOCK
only via `docs/trial-ledger.md` — fixture-proven, ≥3 clean dogfood runs, retro sign-off.

Both positions have a live retro-log row behind them. For WARN-first: 2026-08-02 (portfolio) — "treat
a control that fails one run in several as a coin, not a gate", and the whole trial-ledger mechanism
exists to bound false-block cost. For BLOCK: 2026-07-30 (design cycle 3) — PASS defined as an absence
let characterless work pass five consecutive runs; and 2026-08-02 (portfolio) — "a rule only the phase
close can enforce gets skipped for a whole phase". A floor that only WARNs during the very cycle that
builds it is not a floor.

This is the lint's exit-code contract, which CI and `/arc-phase-done` both depend on, so it needs one
answer rather than two.

## Options considered

1. **All four BLOCK from v1** — honours §6.2; hardest discipline. But `self-declared-number` is a
   regex that has never run against real ledger prose, and a false block on your own build is
   friction with no appeal path.
2. **All four WARN-first** — honours §12 and maximises consistency with arc's proven mechanism. But
   nothing then stops a slice being ticked with no proof during the cycle that is dogfooding the
   proof-first discipline.
3. **Split by false-positive risk** — structural presence-and-parse checks BLOCK; pattern-heuristic
   checks ship WARN-first.

## Decision

Option 3. The split is drawn on a principle, not on picking a side: **false-block risk lives in
pattern matching, never in "did the file parse".**

BLOCK from v1 (exit 1):
- `ledger-unparseable` — the file either satisfies the ADR-0100 grammar or it does not.
- `brief-stale` — the brief's recorded spec hash either matches `phase-NN-spec.md` or it does not.
- `slice-unproven` — a ticked slice either carries `proof:` and `tier:` fields or it does not.

WARN-first, promotes via `docs/trial-ledger.md` (exit 0, `[trial]` suffix, arc's existing convention):
- `self-declared-number` — a heuristic that could trip on a legitimate version string, dependency
  count or line number.

Owner decision, 2026-08-02, at kickoff step 2b.

## Consequences

Easier: the proof-first rule actually holds while it is being dogfooded, and the exit-code contract is
unambiguous for CI. The three BLOCKs are cheap to prove correct because each is a presence-or-parse
question with a fixture on both sides.

Harder: every BLOCK must ship with a negative control — a fixture proving the check *can* fail —
because 2026-08-02's retro records a control that passed six CI legs by luck. REQ-05 and REQ-06 carry
that cost.

What we would revisit if this goes wrong: a structural BLOCK firing on a legitimate ledger means the
grammar, not the gate, was wrong — fix the grammar, drop the check to WARN, log the false positive in
the trial ledger, and re-promote on evidence.
