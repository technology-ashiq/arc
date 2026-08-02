# Phase 00 — Steel thread: the Balanced Model Policy exists and is merged

**Goal (one line):** ADR-0069 — the Balanced Model Policy — written with all seven content
blocks, linted, and merged, so every later phase and the future engine cycle has one
written policy to cite instead of taste.
**Appetite:** 0.5 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** none

## Exit criteria (Definition of Done)

- [ ] `docs/adr/0069-balanced-model-policy.md` exists, status `accepted`, and contains all
      seven blocks:
  - [ ] **(a)** provider-neutral tier definitions — *cheap-scan · balanced-workhorse ·
        high-judgment · independent-family-verifier* — with the claude mapping
        (haiku/sonnet/opus) labelled "implementation v1", plus a seat→tier table matching
        the live 27-agent census, one-line *why* per seat-class
  - [ ] **(b)** the never-do list: no auto-switching · no LLM-judge-as-sole-metric · no
        silent tier changes · same-model consensus ≠ independent truth · absent data is
        never estimated
  - [ ] **(c)** 5 metric definitions, each with a formula and a **named** data source:
        cost/accepted-output · retry rate · escalation rate · review escape rate · council
        Brier. Defined only — instrumenting them is a no-go
  - [ ] **(d)** the engine trigger restated with each condition's check location; per
        assumption **A-04** it names the two event triggers (public-prep start, provider
        event) and states plainly that **no spend threshold is set** — it does not invent a
        rupee figure
  - [ ] **(e)** the MP-F fingerprint block, verbatim field list from ADR-0068
  - [ ] **(f)** the MP-A emergency fallback clause (human approval · expiry · reason in the
        receipt · follow-up ADR within 48h)
  - [ ] **(g)** the MP-A exploratory-trial freedom clause (any candidate model in an
        isolated receipted experiment; production changes only via amendment)
- [ ] Non-negotiables section cites Constitution **A1 · A2 · A4 · A6 · A7 · A9**
- [ ] ADR-0069 cites ADR-0063..0068 as its decision record, and supersedes-in-scope council
      ADR-0006 (`docs/council/kickoff/docs/adr/0006-per-agent-model-tiers.md`) for the
      council seats — that ADR's own revisit trigger is open and must be answered, not
      silently contradicted
- [ ] PLAN.md's ADR index carries the 0069 row
- [ ] `kickoff-lint` exits 0 with the 0069 row present
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)
- [ ] receipt emitted on the spine (existing kinds only)

## Verification plan

- **Test command:** `node .claude/scripts/plan/kickoff-lint.mjs . --lane model-policy`
- **Expected failure first:** the phase's **first** action is adding the `| 0069 | Balanced
  Model Policy | accepted |` row to PLAN.md's ADR index **before** the ADR file exists. The
  `[adr]` group then fails with `ADR 0069 in index but docs/adr/0069-*.md not found` — a hard
  FAIL in `kickoff-lint.mjs`'s unconditional file-existence check, **not** `[adr-wired]` (a
  WARN-only TRIAL check that tests whether an already-existing ADR is cited elsewhere, and
  which never runs for a row whose file is missing — the loop `return`s before reaching it).
  That red is the proof the gate can see this ADR at all — pre-mortem row 1's "what asserts
  this is here?" answered with a failing check rather than an intention. Writing
  `docs/adr/0069-balanced-model-policy.md` turns it green. (Exact failure string is recorded
  from the first red run into the evidence bundle; it is not asserted in advance.)
- **Live demo scenario:** open `docs/adr/0069-balanced-model-policy.md` and read it
  top to bottom against the seven-block checklist above — the owner's own eyes on the
  artifact, not an agent's report about it (retro 2026-07-30). Then run the test command
  and see exit 0. A block that is present but empty fails the phase.
- **Real-system check:** the seat→tier table is checked against the live tree, not memory:
  `grep -r '^model:' .claude/agents/ | sort` must reconcile row-for-row with the table —
  27 agents, 1 haiku / 22 sonnet / 4 opus. Name the **query** in the ADR alongside the
  table so a future reader can re-derive it (retro 2026-07-22: hardcoded counts rot).
- **Expected evidence:** the merged ADR file · the first red `kickoff-lint` output and the
  final exit-0 output · the `grep` reconciliation · the spine receipt id.

## Rabbit holes in this phase

- **Writing the engine's policy instead of arc's.** Block (c) *defines* five metrics and
  stops. Any sentence describing how a metric would be collected, routed, or enforced is
  engine work — cut it, and queue it in `PLAN-engine-process-layer.md` via `/arc-change`.
- **Inventing the spend number.** A-04 is an explicit assumption with a trigger. A
  fabricated ₹ figure in an append-only ADR is worse than an honest blank, because the
  engine cycle will read it as ground truth.
- **Re-deriving MP-A..F.** They are decided (ADR-0063..0068). This phase states them
  normatively and cites them; it does not re-argue them.

## Out of scope for this phase

Council `standard` mode and the session-001 retrofit (Phase 1) · the paired composer A/B
(Phase 2) · the attacker reject-log (Phase 3) · any metric instrumentation, router, or
collector (no-go, all cycles).

## Your-setup / pending

None. No keys, accounts, or infra — this phase writes and merges one markdown file and runs
one existing script.

## Non-negotiables (verbatim from PLAN)

- **No engine code.** Nothing under `processes/`, no drivers, no `router.yaml`, no budget enforcement, no bench runner — those plans sleep until their own triggers (A8).
- **No auto model switching anywhere.** Every production tier change is a reviewed diff citing the Balanced Model Policy (ADR-0069; rationale MP-A/ADR-0063); the two MP-A carve-outs are the only exceptions and both are human-approved.
- The session-model pin stays personal (`settings.local.json`) — shared settings never gain a `model` key this cycle.
- Council remains additive-only; council ADR-0002 (deep default) and the council-v3 juror contract (ADR-0015..0018) untouched; `standard` never weakens `deep`.
- REQ-03 verdicts follow ADR-0047/0048/0049: blind ordering + owner's own eyes on the artifact; no absolute scores inside the loop; PREDICTION pre-registered before reveal.
- Fingerprints are forward-only and never estimated (MP-F / ADR-0068).
- Every phase close leaves its receipt on the spine (existing kinds only).
