# PROGRESS.md — arc-council

> Scoped status tracker for the arc-council build (paired with `docs/council/kickoff/PLAN.md`). Not arc's
> root PROGRESS.md. Phase closes via the build playbook DoD (adapted for prompt artifacts: "live demo" = a
> real `/arc-council` run; "tests" = `council-lint.mjs` + dogfood).

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread: Chair + advocate/skeptic/neutral → a rendered verdict | 2 days | ✅ done (2026-07-15) |
| 1 | Verified synthesis: verifier + POINT-ID contracts + output format + `quick` | 3 days | ✅ done (2026-07-15) |
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
- 2026-07-15 — **Phase 1 ✅ (verified synthesis).** Built `council-verifier` (opus) + POINT-ID contract
  (Chair assigns A/S/N by member+position) + extended `council-lint` (`--verdict` mode: POINT-ID
  cross-reference + "verifier contested nothing" guard) + the `quick` flag. RED first: static FAIL
  (verifier missing) + fixtures `bad-unrated` (cites P9) and `bad-nocontest` (0 contested) both FAIL /
  exit 1; `good` fixture PASS. After build → static GREEN, `good` GREEN, bad fixtures still FAIL (negative
  tests bite). Full dogfood ("raise a seed round now?"): 3 members → verifier graded all 16 IDs
  (A1/A2 Contested, A3 Weak, 8 Supported) → verdict `DECISION: CONDITIONAL` citing only Supported/Plausible
  IDs → `council-lint --verdict` GREEN (exit 0). Quick dogfood ("self-host a blog?"): 3 members, no
  verifier, short verdict, 0 files written.

## Appetite burn
5 of 12 phase-days used (42%). Total appetite: 3 weeks (kill criteria at 50% / 100% per PLAN).

## Now
**Phases 0–1 ✅ — the council now researches nothing yet but debates, verifies, and decides.** Position:
`/arc-council` convenes 3 independent members → `council-verifier` grades every point by POINT-ID → the
Chair renders a verdict that cites only verifier-Supported/Plausible points (mechanically enforced by
`council-lint --verdict`); `quick` opt-out works. Next step: **Phase 2** (deep research layer) — add
`council-researcher` fan-out that builds ONE neutral, triangulated Evidence Brief the members debate from,
plus the offline `model-knowledge` mode. Phase 3 (7 domain experts) then depends on Phases 1+2.
