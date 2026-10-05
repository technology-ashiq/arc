# PROGRESS.md — org v2.1 "the four ORG-R holds"

status: LIVE
cycle: arc-org (Cycle 20, opened 2026-10-05)
phase: 00
appetite: 3d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence at `initiatives/org/evidence/phase-NN/`.
> Cycles 18–19 are archived under `initiatives/org/archive/`. ADR century 1600–1699; ADR-1626..1629 written this cycle.

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | process `role:` slot + resolver + `--trial-seat` in `arc-run` | 0.75d | ⏳ |
| 01 | `org-judge.mjs` head-judge emission (ORG-O) | 0.5d | ⏳ |
| 02 | `skill-import.mjs` + `lib/skill-vet.mjs` (pinned, vetted, proposal branch) | 0.6d | ⏳ |
| 03 | `org-own.mjs` hire-to-own over `agent-scaffold` | 0.5d | ⏳ |

## Done log

(none yet)

**Appetite burn:** 0 of 3 days used (0%; tripwire 50%).

## Now

**Current position:** Cycle 20 kicked off 2026-10-05; plan approval requested on the spine. Owner instruction
2026-10-05: build every phase without waiting.
**Kickoff attack (tier S, one merged A+C run):** 7 findings, 7 applied (review.completed scoring arm, run.completed-only role fields, planScaffold extraction, skill-import golden/approval, judge reason guard, headroom golden filter, main-guard row). No REJECTED lines.
**Next step:** one /arc-attack round over the whole cycle diff, fix, push once, ci-digest, then /arc-phase-done 00..03. Phases 00-03 built locally; main held a duplicate `PLAN-launch` key in expected-set.json (PRs 317 and 318 both added it), removed in Phase 02; REQ-03 is fixture-proven and unused until an `org/teams/*.team.yaml` exists. Phase 00 built locally (role-seat resolver, lint, arc-run --trial-seat, drivers); one attack round + one push cover the whole cycle.
