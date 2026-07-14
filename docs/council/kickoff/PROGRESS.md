# PROGRESS.md — arc-council

> Scoped status tracker for the arc-council build (paired with `docs/council/kickoff/PLAN.md`). Not arc's
> root PROGRESS.md. Phase closes via the build playbook DoD (adapted for prompt artifacts: "live demo" = a
> real `/arc-council` run; "tests" = `council-lint.mjs` + dogfood).

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 0 | Steel thread: Chair + advocate/skeptic/neutral → a rendered verdict | 2 days | ✅ done (2026-07-15) |
| 1 | Verified synthesis: verifier + POINT-ID contracts + output format + `quick` | 3 days | ✅ done (2026-07-15) |
| 2 | Deep research layer: researcher fan-out + neutral Evidence Brief + offline | 2 days | ✅ done (2026-07-15) |
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

- 2026-07-15 — **Phase 2 ✅ (deep research layer).** Built `council-researcher` (fan-out) + command
  (research fan-out → neutral Evidence Brief → offline `model-knowledge` mode) + `council-lint --brief`
  (≥3 facts; live brief needs ≥2 sources per High/Med fact or a low-mark). RED first: static (researcher
  missing) + `bad-fewfacts` (<3) + `bad-unsourced` (High/1-URL) FAIL; `good-live`/`good-offline` PASS.
  After build → static GREEN, both good briefs GREEN, bad still FAIL. Live dogfood ("adopt Rust for a
  perf-sensitive backend?"): 3 parallel researchers (2 real-web, 15+23 tool calls fetching
  discord/cloudflare/aws/rust-lang/crates.io; 1 offline model-knowledge) → live Evidence Brief (11 facts,
  `--brief` GREEN) + offline brief (`--brief` GREEN) → URL spot-check confirmed Cloudflare Pingora (caught
  a 70%-vs-67% imprecision) → 3 members debated from the brief AND gap-filled with sources → verifier
  graded 16 POINT-IDs AND caught a brief error all 3 inherited (actix-web is 4.x, not pre-1.0) → verdict
  `DECISION: CONDITIONAL` citing only Supported/Plausible IDs → `council-lint --verdict` GREEN.
  Honest gap: offline mode proven at brief level; a full offline→verdict chain wasn't re-run (pipeline is
  mode-agnostic, proven on the live run). New finding: a newly-created `council-*` agent isn't a
  registered `subagent_type` until a turn boundary — create-and-same-turn-spawn fails (→ Phase 2 retro).

## Appetite burn
7 of 12 phase-days used (58%). Total appetite: 3 weeks. (50% tripwire passed; council demonstrably beats a
raw answer — the verifier caught a propagated factual error + survivorship-bias framing — so kill-criteria PASS.)

## Now
**Phases 0–2 ✅ — the council now researches, debates, verifies, and decides end-to-end.** Position:
`/arc-council` fans out `council-researcher` → ONE neutral triangulated Evidence Brief (live or offline) →
3 independent members debate from it → `council-verifier` grades by POINT-ID (and flags brief-bias) → the
Chair renders a mechanically-verified verdict (`council-lint --verdict`/`--brief` both gate it); `quick`
opt-out works. Next step: **Phase 3** (full domain roster) — add the 7 domain experts (strategist,
risk-analyst, marketer, designer, engineer, policy-analyst, life-counselor) + the Chair's per-question
roster selection (domain match, ceiling 4, documented tie-break). Depends on Phases 1+2 (both done).
