# Phase 04 — Live dogfood

**Goal (one line):** The spine proven on ≥5 consecutive real working days with honest money.
**Appetite:** 3 days effort (≥5 elapsed calendar days)
**Depends on:** phase-02, phase-03

## Exit criteria (Definition of Done)

- [ ] ≥5 consecutive real working days (arc's own development and/or one consumer repo):
      real events flowing, brief read daily, ≤ one screen held all 5 days (REQ-07, REQ-05
      north-star).
- [ ] Honest revenue rules held: `revenue.received` = real money only; pre-revenue →
      `revenue.simulated`, and REQ-07 closes "mechanism proven, live value pending" —
      never fake P&L truth.
- [ ] Weekly gap audit run (session-log vs spine — pre-mortem #2): every factory action in
      the session log has a receipt, or the gap is named and fixed.
- [ ] Evidence bundle: the days' JSONL + briefs + the gap audit (REQ-07).
- [ ] `/arc-retro` run + TRIAL review for the NEW grep-lint gate only — the 8 existing
      kickoff-lint trial gates stay WARN regardless (locked this cycle).

## Verification plan

Coarse (refined via `/arc-change` at phase entry): dogfood host access confirmed at entry
(assumptions row 4 fallback: arc itself) · 5-day evidence bundle verified complete ·
quarantine dir reviewed (ADR-0031 consequence) · evidence in `docs/evidence/phase-04/`.

## Rabbit holes in this phase

- Chasing 100% coverage by inventing kinds mid-dogfood — vocabulary is closed (ADR-0026);
  gaps become `note.logged` or a post-cycle ADR.
- Making the brief "nicer" during the window — read what ships; polish is Cycle-3+ evidence.

## Out of scope for this phase

- Promotion of the 8 kickoff-lint trial gates · dashboard · Cycle-3 venture work ·
  any new emission points (wiring closed at Phase 1/3).

## Your-setup / pending

- Confirm the Phase-4 host at phase entry: arc itself and/or venturemind /
  Opportunity-Scout (both carry arc installs; access re-verified then).
- If any real money lands in the window: provide the provider export (else the
  `revenue.simulated` path closes the mechanism).

## Non-negotiables (verbatim from PLAN)

- Append-only forever; corrections supersede (ADR-0029).
- Emitter/validator/replayer/reader are parser-class code → **mandatory adversarial
  construct-a-breaking-input pass, holes fixed + pinned as red fixtures, BEFORE FAIL-mode
  promotion** (council v2+v3: 43-hole history).
- Twin determinism cases (REQ-04 a+b) enter CI at Phase 0-B and never leave.
- No secrets on the spine — redaction fail-safe, stub-only, never fail-open (ADR-0028).
- Hook-mode emitter can never block or fail a session; `arc_hook_field` guard chain
  untouched. Appends are durable and atomic: an emitter killed mid-append (SIGKILL/hard-exit)
  leaves zero torn lines and zero silently-lost acknowledged events, and two concurrent
  emitters never interleave a torn/partial line — pinned fixtures (Phase 0 corpus + Phase 1
  bats; exit-timing-race class, `docs/retro-log.md`).
- No module reads `events/*.jsonl` or `state.db` directly except the spine reader —
  grep-lint WARN-first (ADR-0030), wired as a `mode: warn` row in `arc.gates.yaml` (same
  schema as the existing gate rows — unregistered, it never runs), scanning by glob over
  tracked source paths (not a hardcoded file list) so consumers added after this cycle are
  covered without a lint edit.
- `products/hq/manifest.json` never declares a `.claude/state/**` path in `files`/`scripts`/
  `docs`: `arc-products.mjs`'s `assertSafe` has no state-tree rule, so a `--products hq`
  selective install would copy spine data into a consumer's payload — the golden bare-sync
  gate only covers the full-sync path (ADR-0025). Asserted by a Phase 0 bats case.
- Canonical serialization defined ONCE, shared by emitter/hasher/reader (ADR-0024).
- Inherited whole: zero-dep Node · bash-3.2/POSIX · no GNU-only constructs (macOS BSD leg)
  · every script ships bats (central `tests/`, ADR-0021) · CI red = no merge · golden
  bare-sync byte-identical · new lints WARN in TRIAL · evidence bundle per phase-done.
- The 8 existing kickoff-lint trial gates stay WARN this cycle (escape-hatch precondition,
  council session 001) — this initiative does not touch them.
