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
| 3 | Full domain roster: 7 experts + Chair roster selection (ceiling 4) | 2 days | ✅ done (2026-07-15) |
| 4 | Fairness invariants + auto-save sessions + sync wiring + docs | 3 days | ✅ done (2026-07-15) |

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

- 2026-07-15 — **Phase 3 ✅ (full domain roster).** Built 7 domain experts (strategist, risk-analyst,
  marketer, designer, engineer, policy-analyst, life-counselor; arc-native shadowing the global 5 per
  ADR-0001, marketer+designer new) with the member contract + POINT-ID prefixes (ST/RK/MK/DS/EN/PO/LC) +
  Chair roster-selection (domain match, ceiling 4, tie-break + disclosure) + `council-lint` static roster
  (all 12 agents). RED (7 missing) → GREEN (all exist). Dogfood ("launch a paid AI writing assistant that
  trains on user docs?", model-knowledge): Chair classified 6 matching domains → convened top-4 (strategist,
  risk-analyst, marketer, policy-analyst) + **named the 2 dropped** (engineer, designer) → 3 stance + 4
  experts (7) debated the brief + gap-filled with live sources → verifier graded all **34 POINT-IDs** AND
  caught a **materially-misleading citation** (Garante €15M OpenAI fine ANNULLED 18-Mar-2026) + flagged the
  Regime-A/B brief-framing bias → verdict `DECISION: CONDITIONAL` citing only Supported/Plausible IDs across
  all 7 members → `council-lint --verdict` GREEN. This offline run also **closes Phase 2's offline→verdict gap**.
  (Build was committed b648636; dogfood + close this commit.)

- 2026-07-15 — **Phase 4 ✅ (fairness + auto-save + sync + docs).** Built: **PREDICTION-vs-RESULT** (command
  intake pre-registers a prediction; the verdict shows both; `council-lint --verdict` now REQUIRES a
  `PREDICTION:` line — fairness enforced by the lint, not Chair self-grade) + **auto-save** (deep runs →
  `docs/council/sessions/NNN-slug.md`; `quick` writes nothing) + `docs/council/references/fairness.md`
  (11 invariants + what the lint enforces) + `docs/council/README.md`. RED (a verdict missing PREDICTION
  fails — incl. the old good.md fixture) → GREEN (good.md + PREDICTION passes, bad-noprediction fails).
  Dogfood: saved a real session (`001-ai-writing-assistant...`, with PREDICTION-vs-RESULT) →
  `council-lint --verdict` GREEN; `sync-to-project` to a temp dir → command + 12 agents + lint landed,
  `docs/council/` NOT synced (no sessions leak), 0 mods to pre-existing files (REQ-10). Concurrency
  assumption (A1) validated — the Phase-3 run stacked 8 agents in one batch with 0 spawn errors.
  Deferred (isolation): the arc-repo `CLAUDE.md`/`README`/`CHANGELOG` rows — documented in
  `docs/council/README.md` instead, to avoid touching existing shared files.

## Appetite burn
12 of 12 phase-days used (100%) — **feature-complete, on appetite** (no scope cut, no overrun).

## Now
**FEATURE-COMPLETE — all 5 phases (0–4) ✅.** `/arc-council "<q>"` runs end-to-end: intake (disambiguate +
pre-register a prediction + classify domains) → `council-researcher` fan-out → ONE neutral triangulated
Evidence Brief (live/offline) → 3 stance members + matched domain experts (ceiling 4, dropped named) debate
independently → `council-verifier` (opus) grades every POINT-ID + flags brief-bias → the Chair renders a
mechanically-verified verdict (PREDICTION-vs-RESULT; only verifier-Supported/Plausible points cited; DISSENT
preserved) → auto-saved to `sessions/`. `quick` opt-out works. `council-lint` gates artifacts, verdicts, and
briefs. Next: **project-level `/arc-retro`** (scoreboard row) → then the branch is ready for `!git push` + PR.
