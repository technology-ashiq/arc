# PROGRESS.md — arc-council

> Scoped status tracker for the arc-council build (paired with `docs/council/kickoff/PLAN.md`). Not arc's
> root PROGRESS.md. Phase closes via the build playbook DoD (adapted for prompt artifacts: "live demo" = a
> real `/arc-council` run; "tests" = `council-lint.mjs` + dogfood).

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread: Chair + advocate/skeptic/neutral → a rendered verdict | 2 days | ✅ done (2026-07-15) |
| 1 | Verified synthesis: verifier + POINT-ID contracts + output format + `quick` | 3 days | not started |
| 2 | Deep research layer: researcher fan-out + neutral Evidence Brief + offline | 2 days | not started |
| 3 | Full domain roster: 7 experts + Chair roster selection (ceiling 4) | 2 days | not started |
| 4 | Fairness invariants + auto-save sessions + sync wiring + docs | 3 days | not started |

## Done-log
- 2026-07-15 — kickoff complete: PLAN + 7 ADRs + 5 phase specs written; attack panel (×3) reconciled;
  scoped tracker under `docs/council/kickoff/`.
- 2026-07-15 — **Phase 0 ✅ (steel thread).** Built `.claude/scripts/council-lint.mjs` (RED first:
  4 FAILs / exit 1 with command+agents absent), then `.claude/commands/arc-council.md` +
  `council-advocate/skeptic/neutral` agents → `council-lint` GREEN (exit 0). Live dogfood:
  `/arc-council "Should I rewrite my 5k-line side project in Rust?"` spawned all 3 members in ONE
  parallel batch (independence held — they independently converged on "motivation is the crux"),
  rendered a verdict whose first line is `DECISION: CONDITIONAL` (+ CONFIDENCE / KEY REASONS / DISSENT /
  CHEAPEST TEST). Evidence: RED→GREEN lint transcript + the verdict block above.

## Appetite burn
2 of 12 phase-days used (17%). Total appetite: 3 weeks (kill criteria at 50% / 100% per PLAN).

## Now
**Phase 0 ✅ done — steel thread proven end-to-end.** Position: `/arc-council` runs, convenes 3 independent
members in one batch, and renders a `DECISION:` verdict; `council-lint` passes (RED→GREEN). Next step:
**Phase 1** (verified synthesis) — add `council-verifier` (opus) + numbered POINT-ID member contracts +
the full output format + the `quick` flag, then extend `council-lint` with the POINT-ID cross-reference and
the "verifier contested nothing" check (red-first fixtures per phase-01-spec).
