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

## Phase-open decisions (2026-07-29, recorded at open as the spec requires)

1. **Dependency gate (ADR-0044): SATISFIED at open — full scope.** The dedup fix merged to
   main in PR #56 (`0733c07`), owned and landed before this phase opened, so the
   single-round re-scope clause does not trigger. The close still requires the
   mechanism-proof evidence below (2 distinct receipts, distinct idems, same route), from
   the real explore run — a merged-PR attestation alone stays insufficient per the retro.
2. **Isolation = the pre-approved route-namespace fallback (ADR-0037), not worktrees.**
   Variants live at `docs/design/explore/<explore-id>/variant-{a,b,c}/` on this phase
   branch, each with its own `tokens.css`; the base SHA is recorded in the explore dir.
   Why not worktrees: real blindness comes from fresh-context composers scoped by prompt —
   a worktree does not stop an agent reading an absolute path any more than a directory
   does, so it buys no isolation the namespace lacks; what it DOES buy is three more copies
   of the MSYS/native path-spelling minefield that cost Phase 00 three CI rounds. Recorded
   trade: namespace isolation is branch-level (nothing merges to main until the pick), not
   FS-level. Revisit: variants needing a running dev server each (a real app surface, not a
   static route) → worktrees per ADR-0037's main line.
3. **Verification plan refined** (was the coarse line; routed as this phase-open spec edit):

- **Test command:** `bats tests/design-explore.bats`
- **Expected failure first:** the suite asserts the explore runner scaffolds
  `docs/design/explore/<id>/` (variant dirs + per-variant `tokens.css` + recorded base
  SHA), checks the IA matrix EXISTS (existence only — the ≥3/7 judgment is the director's
  written call in `matrix.md`, never machine-diffed), refuses a variant whose page carries
  raw hex where a token exists, and proves the ADR-0044 mechanism: two `review.completed`
  receipts for the SAME route from two rounds carry DISTINCT idem keys. Before the runner
  exists the first test fails at "design-explore.sh: no such file" — red proven, then green.
- **Live demo scenario (REQ-07 + REQ-08 in ONE run):** explore run on the ARC HQ surface
  (the Phase-01 brief is the input) — director assigns 3 theses + writes the divergence
  call → 3 fresh-context composers each build their variant (own dir, own tokens, no raw
  hex) → shared render (`design-render.sh`, one command, all variants) → critic round 1
  (expected: real VIOLATIONs on ≥1 variant) → creation side fixes → critic round 2
  re-verifies → blind jury ×3, independent, rankings + reasons as artifacts → owner pick +
  falsifiable prediction recorded via the REQ-06 pattern (`approval.requested` →
  `arc-inbox approve --reason "<pick> — prediction: <measurable effect> because
  <mechanism>"` → `decision.recorded`, closed vocabulary, no new kinds).
- **Expected evidence:** explore dir committed (matrix + thesis lines + 3 variants + 3
  critique artifacts + 3 ranking artifacts) · reader output showing ≥2 same-route
  `review.completed` with distinct idems · the `decision.recorded` payload · `git log`/
  `git diff` proof that critic sessions changed zero product files (REQ-08).

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
