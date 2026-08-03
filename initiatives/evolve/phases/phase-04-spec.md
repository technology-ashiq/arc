# Phase 04 — Council bridge (THE DESIGNATED CUT)

**Goal (one line):** The council measures itself — verdict and outcome receipts land on the
spine, `council-calibrate` reads them through the reader instead of Markdown, and the board shows
calibration honestly or says `insufficient evidence`.

**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01

> **This phase is THE DESIGNATED CUT (ADR-0307).** Burn pressure → it banks as a follow-up
> micro-drop and the cycle still closes whole. It is honest value, not engine safety. The retro
> runs at close either way.

## Exit criteria (Definition of Done)

- [ ] Council verdict/outcome lifecycle emits typed receipts — `council.verdict` already exists in
      `KINDS`; `council.outcome` is added per ADR-0310
- [ ] `council-calibrate` re-pointed from Markdown session files to the reader
- [ ] **No v1 backfill** of historical Markdown sessions — only receipts emitted from wiring-time
      forward count
- [ ] Juror hit-rates, confidence buckets and Brier score render on the board
- [ ] A proposed juror-weight change arrives as a diff + inbox item, human-approved — never applied
- [ ] Terminal outcomes below floor → `insufficient evidence`, never invented calibration
- [ ] Fixture on synthetic sessions proves the calibration math
- [ ] tests added & green in CI · live demo run + output checked · tracker updated

## Verification plan

One coarse line, refined via `/arc-change` when the phase starts: the calibration math is proven
on synthetic sessions, and the board's council columns render `insufficient evidence` against the
real spine — where `council.verdict` count is 0 as of kickoff — rather than any computed number.

## Rabbit holes in this phase

Backfilling historical Markdown council sessions to make the columns look populated — explicitly
a no-go (ADR-0307), because scored outcomes are 0 and a backfill would invent calibration from
sessions that were never scored.

## Out of scope for this phase

Any change to how the council reaches a verdict — this phase measures the council, it does not
tune it. Juror-weight changes are proposed, never applied.

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
  not to revert (Constitution A6, no exceptions, no carve-outs).
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
  FRESH agent that has not seen the implementation runs the adversarial breaking-input pass on
  the manifest validator, every receipt validator, and floor + cohort + seal + lineage + watch
  enforcement — bound to the section that ships each gate, never deferred to the phase close.
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
  at the contract layer, with a fixture.
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
  replay-identical board, config-hash-carrying verdicts, SHA-bound lineage at every hop. If
  replay cannot re-derive it, it does not count.
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
  PII on the spine.
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never
  mixed. Zero-dep Node + POSIX.
