# Phase 02 — Explore mode: theses → variants → critique loop → blind ranking → pick

**Goal (one line):** Three genuinely different directions (thesis-diverged, IA matrix ≥3/7, isolated worktrees, per-variant temp tokens, one shared render command) survive the read-only critique loop and a blind ×3 ranking, ending in an owner pick recorded with a falsifiable prediction (`decision.recorded`).
**Appetite:** 1.5 days (opens with a 0.5-day infra timebox — pre-mortem #5)
**Depends on:** phase-01

**Dependency gate (ADR-0044):** the spine idem-preimage dedup fix (separate /arc-change)
must have landed AND be proven against the mechanism before this phase can CLOSE —
Phase-2 close evidence must show 2 distinct `review.completed` receipts (distinct idem
keys) for the same route's 2 critique rounds, not a merged-PR attestation alone (retro
2026-07-28: a plausible "fix landed" story hid a real collision for 4 days). Not
landed/not proven at phase open → re-scope to single-round critique per the assumptions
ledger — and REQ-08's exit criterion below downgrades from "≤2 rounds" to "1 round
demoed, 2-round path logged as a known gap". No owner is currently assigned to the dedup
`/arc-change` outside this appetite; if still unowned at Phase-2 open, the single-round
re-scope is MANDATORY, not a fallback to attempt.

## Exit criteria (Definition of Done)

- [ ] REQ-07 acceptance end-to-end on an arc-internal surface (theses assigned + director divergence rejection · IA matrix ≥3/7 · worktree isolation from one recorded base SHA, or the pre-approved route-namespace fallback (ADR-0037) decided at phase open · per-variant temp tokens, no raw hex · shared render command · blind ranking ×3 · pick + falsifiable prediction receipt per ADR-0038)
- [ ] REQ-08 acceptance captured from the SAME run as REQ-07 above (no separate demo run): the critique loop inside that one explore run shows VIOLATION → creation fixes → critic re-verifies, ≤2 rounds; critic session diff shows zero product-code changes
- [ ] tests added & green · live demo · tracker updated

## Verification plan

- One coarse line (refined via `/arc-change` when the phase starts): bats + live demo of
  one full explore run — IA matrix present (lint-checked existence only) and the
  ≥3/7-differ judgment recorded as the director's explicit written call in the brief dir —
  not machine-diffed (Rabbit hole: no string-distance metrics; lint only checks the matrix
  exists) — three critique artifacts with receipts visible via the reader, one
  `decision.recorded` with a prediction sentence; plus a `git diff` scoped to the critic's
  session worktree/branch attached as evidence of zero product-file changes (REQ-08).

## Rabbit holes in this phase

Worktrees-vs-fallback fought mid-phase (decide at open, ADR-0037) · director divergence
judgment automated with string metrics (superseded row 12 — director's call only).

## Out of scope for this phase

Intelligence library + LexOS pilot (Phase 3) · build/suggest mode polish (later cycle) ·
retiring the old reviewer before the ADR-0042 trigger fires.

## Your-setup / pending

The spine dedup /arc-change fix (ADR-0044) — arc-core work outside this appetite.

## Non-negotiables (verbatim from PLAN)

- The critic never writes product code — enforced mechanically (no Edit tool + PreToolUse edit-hook path scope + scoped receipt Bash), never by prose (ADR-0034).
- No lorem ipsum in any reviewed artifact — realistic content from the content contract.
- No absolute quality scores anywhere; numbers exist only as blind comparative ranking.
- Every design review and every owner decision leaves a spine receipt in the closed vocabulary (ADR-0035).
- Taste is a decision recorded as a design ADR, never a research finding; research receipts only for factual/pattern claims.
- A new gate/lint/parser is not done until an adversarial construct-a-breaking-input pass has run and the found holes are fixed + pinned as fixtures.
- Any edit to a product-shipped file treats sync-golden regen as a named step: diff the delta first, confirm only intended paths moved, then re-record.
