# PROGRESS.md — arc-council v2

> Scoped build tracker (arc's root PROGRESS.md is arc's own — never touched). On phase close:
> flip the row, append one evidence line to the Done-log, update the burn line.
> Gate: `node .claude/scripts/kickoff-lint.mjs docs/council/kickoff-v2`.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread — tightened `--verdict` gates + fixtures + session-001 correction | 2 days | pending |
| 1 | Calibration loop — Review-by/Resolution, `review` mode + OUTCOME, `council-calibrate.mjs` | 3 days | pending |
| 2 | Bounded rebuttal + verbatim verifier handoff (REBUTTAL LOG, F8 both hops) | 2.5 days | pending |
| 3 | Eval harness — planted-error + flip-rate probes, grading script + runbook | 2 days | pending |

## Appetite burn
0 of 10 days used (phase appetites sum to 9.5).

## Done-log
- 2026-07-15 — Kickoff: PLAN + ADRs 0008–0013 + 4 phase specs written; attack panel ×3 ran, 19 findings reconciled into the plan (rebuttal-set definition, OUTCOME grammar, F8 both-hops widening, probe isolation, consumer-sync dep).
- 2026-07-15 — Gates: `kickoff-lint docs/council/kickoff-v2` PASS (4 WARNs accepted: 2 vague-heuristic false-positives, 95% appetite-sum stated in PLAN, scoped-folder retro-log); plan-simulator r1 = 4 blockers → all fixed (parse rule, 001-line format, grep/commit scope, verdict schema block) → r2 = 1 blocker (no-rubber-stamp rule undocumented in executor info set) → fixed doc-only, flagged at STOP.

## Now
Kickoff artifacts complete; awaiting kickoff-lint + simulation gate, then the STOP review.
**Next step:** on explicit approval — open Phase 0 (steel thread: tightened verdict gates, red fixtures first).
