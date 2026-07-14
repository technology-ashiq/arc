# Phase NN — <name>

<!-- File convention: phases/phase-NN-spec.md, zero-padded. Exit criteria are written
     BEFORE the phase starts — that's what makes "done" objective (build playbook §8). -->

**Goal (one line):**
**Appetite:** (e.g. 3 days — blown appetite = cut scope or kill, never extend silently)
**Depends on:** phase-NN[, phase-MM] | none
<!-- lint-checked [phase-deps]: referenced phases must exist · no cycles · Phase 0 is always `none`.
     Risk-first ordering stays the human call — this line makes violations machine-visible. -->

## Exit criteria (Definition of Done)
- [ ] <capability> works end-to-end
- [ ] tests added & green
- [ ] live demo run + output checked (qa-tester evidence for UI flows)
- [ ] verified against the real system (if applicable)
- [ ] contract tests green (Phase 0: against fakes; dep's own phase: against the real impl)
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
<!-- Written at kickoff for Phase 0–1 ONLY; later phases keep one coarse line and refine
     it when the phase starts. Detailed verification for a far-future phase is fiction.
     "How we'll verify" is decided BEFORE any code — evidence over assertion.
     lint-gated [verify-red] (v4): Phase 0 must fill **Test command** + **Expected failure
     first**; a Phase 1 that has a Test command must fill Expected failure first too. -->


- **Test command:** (exact, e.g. `npm run test -- invoices`)
- **Expected failure first:** (which test fails BEFORE this phase is built + the expected
  failure message — proves the test tests something; red → green, no after-the-fact tests)
- **Live demo scenario:** (steps + expected output, runnable by a human)
- **Real-system check:** (what to inspect where, or "n/a — fakes only this phase")
- **Expected evidence:** (what artifact proves it — test output, screenshot, DB row)

## Rabbit holes in this phase
Known traps + the decided detour.

## Out of scope for this phase
Deferred to which phase.

## Your-setup / pending
Keys, accounts, infra the human must provide.

## Non-negotiables (verbatim from PLAN)

<!-- COPY PLAN's ## Non-negotiables bullets here verbatim — context-isolated executors
     (plan-simulator, /arc-resume, future subagents) read THIS file, not PLAN. The copy is
     GENERATED, never hand-edited: /arc-change resyncs every spec when PLAN's bullets
     change, and kickoff-lint [nonneg-drift] fails any copy that drifts. A stale copy lies. -->

- <paste PLAN bullets verbatim>
