# PROGRESS.md — arc-council v2

> Scoped build tracker (arc's root PROGRESS.md is arc's own — never touched). On phase close:
> flip the row, append one evidence line to the Done-log, update the burn line.
> Gate: `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v2`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — tightened `--verdict` gates + fixtures + session-001 correction | 2 days | ✅ 2026-07-15 |
| 1 | Calibration loop — Review-by/Resolution, `review` mode + OUTCOME, `council-calibrate.mjs` | 3 days | pending |
| 2 | Bounded rebuttal + verbatim verifier handoff (REBUTTAL LOG, F8 both hops) | 2.5 days | pending |
| 3 | Eval harness — planted-error + flip-rate probes, grading script + runbook | 2 days | pending |

## Appetite burn
2 of 10 days used (Phase 0 closed; phase appetites sum to 9.5).

## Done-log
- 2026-07-15 — Kickoff: PLAN + ADRs 0008–0013 + 4 phase specs written; attack panel ×3 ran, 19 findings reconciled into the plan (rebuttal-set definition, OUTCOME grammar, F8 both-hops widening, probe isolation, consumer-sync dep).
- 2026-07-15 — Gates: `kickoff-lint docs/council/kickoff-v2` PASS (4 WARNs accepted: 2 vague-heuristic false-positives, 95% appetite-sum stated in PLAN, scoped-folder retro-log); plan-simulator r1 = 4 blockers → all fixed (parse rule, 001-line format, grep/commit scope, verdict schema block) → r2 = 1 blocker (no-rubber-stamp rule undocumented in executor info set) → fixed doc-only, flagged at STOP.
- 2026-07-15 — **Phase 0 CLOSED ✅ (REQ-01/02/03 validated).** 3 new `--verdict` checks shipped red-first: decision-core (exactly-one filled DECISION+CONFIDENCE + DISSENT-cite w/ all-Weak-WAIT exemption), model-knowledge cap (High requires explicit `Research mode: live`), UNRESOLVED + citation-scoping (every `[Pn]` outside `## UNRESOLVED`/`## DISPUTED` must be Supported/Plausible; fence-stripped). RED gate: 10 fixtures matched red-first prediction exactly. GREEN: all good=0/bad=1, each bad names its check. No regression: 8 v1 fixtures + static unchanged. Session 001 corrected in place (ADR-0010): post=0, pre-correction-from-git=1. **Adversarial pass** (workflow, 4 lenses → verify): 11 holes found + ALL fixed (unfilled-template, mk-cap synonym/whitespace/U+2011/omission, fence-unaware, dissent-in-prose[high], subheading-scope-escape, decoy-WAIT, UNRESOLVED-prose-token, inline-dissent false-fail); REBUTTAL-LOG path deferred to phase-2. 6 hole reproductions pinned as permanent fixtures.

## Now
**Phase 0 CLOSED ✅ (2026-07-15).** The verdict gate is hardened and adversarially proven. Committed on `feat/council-v2`.
**Next step:** Phase 1 (calibration loop — `review` mode + `council-calibrate.mjs` + Review-by/Resolution template lines). Depends on phase-0 ✅.
