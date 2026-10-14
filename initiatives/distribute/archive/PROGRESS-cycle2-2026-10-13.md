# PROGRESS.md — distribute Cycle 2 "arc's loop under OpenCode on a non-Anthropic model"

status: IDLE
cycle: arc-distribute (Cycle 2, opened 2026-10-13)
phase: 07 (cycle closed)
appetite: 3d
burn: 1.75d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
Cycle 1 is archived at `archive/PLAN-cycle1-2026-10-13.md` + `archive/PROGRESS-cycle1-2026-10-13.md`; its 9 validated
REQs and phases 00–04 stand. ADR century 2000–2099; Cycle 2 writes ADR-2019..2021. The owner opened and approved this
cycle in chat on 2026-10-13 ("REQ-03 cycle", model `deepseek/deepseek-v4-flash-0731`, cap $0.50, "complete all phase …
don't wait for me … merge ellam phases complete aana apram"). Every phase is built on `feat/distribute-c2-req03` and
merged once at cycle end; each phase closes from the main clone after that merge.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 1 | — | ✅ |
| 05 | Capped wrapper + transcript + harness/evidence stamp + one live `arc-commit` smoke receipt — 50% tripwire (REQ-11, 12) | 1d | ✅ |
| 06 | `arc-ship` runnable in arc: package scripts, `ci-digest --wait`, no-deploy branch, goldens (REQ-13) | 0.75d | ✅ |
| 07 | The real run: commit → review → push → ship, 3 negatives, PR merged after checks, transcripts, retro + seal (REQ-03) | 1d | ✅ |

## Done-log

- **Kickoff 2026-10-13** (receipts `kickoff.done` 01M4RWTWG6GANBZE4YQA7TKW1R, `approval.requested` 01M4RWTX3STGAQNY4KE5XXKHCR; the owner pre-approved building in chat, the stamp stays theirs): PLAN (tier S, 4 REQs), phase specs 05–07, ADR-2019..2021. Survey facts that shaped it:
  nothing in code sets `harness` on a receipt; `arc-ship` cannot run in arc (no scripts, no deploy target);
  `core.hooksPath` is unset; no USD cap exists for a foreign harness. Cycle 1's stale "owner items" line is
  corrected here: all 6 distribute approvals (kickoff + P00..P04 move-on) were decided `approve` on the spine
  between 2026-10-07 and 2026-10-09; `arc-inbox inbox` shows none open.

- **P05 2026-10-13**: wrapper + stamp built; attack r1 (logic 15, boundary 10) and r2 (logic 0, boundary 12) fixed or
  ledgered. Four live smokes and three probes measured two OpenCode facts the plan did not know: a subagent's `ask`
  hangs a headless run (fences now deny) and subagent spend is not in the stream (now read by `opencode export`),
  ADR-2022. **50% tripwire: YES** — receipt `01M4S4V92YACPXF1V08XXWR04B` (`commit.done`, `harness: opencode`) on the
  main spine for $0.0019 (`evidence/phase-05/smoke.md`). Cycle spend $0.035 of $0.50.
- **P06 2026-10-13**: package scripts, `ci-digest --wait`, the no-deploy `arc-ship` branch; attack r1 fixed or ledgered.
- **Phase 05 closed 2026-10-13** (`/arc-phase-done 05 --lane distribute`): REQ-11 and REQ-12 validated. Built on
  `feat/distribute-c2-req03`, merged once at cycle end as PR #412 (`eb8065ec`), CI 19/19 on head `e5fd6f32` (run
  38415953364). The 21 P05 tests (`distribute-opencode-session.bats` 15, `distribute-harness-stamp.bats` 6) ran `ok` on
  all 5 legs that carry them, 105 lines, 0 `not ok`, 0 skipped (`evidence/phase-05/ci-38415953364-p05-suites.txt`). The
  smoke receipt `01M4S4V92YACPXF1V08XXWR04B` carries `harness: opencode` and `evidence` =
  `evidence/phase-05/transcripts/smoke-arc-commit-4.jsonl`, whose line 1 names `opencode 1.17.18 session=ses_…`. CI on
  the first push (4efbce5f) found five defects, fixed as (cq)-(cs) plus the board row and the stall fixture. Actual ~1d
  against 1d. Metrics: `amendments: 1` (ADR-2022, subagent spend via `opencode export`) · `reopened: n`.
- **Phase 06 closed 2026-10-13** (`/arc-phase-done 06 --lane distribute`): REQ-13 validated. Same PR and run. The 8
  `distribute-ship-nodeploy.bats` tests ran `ok` on all 5 legs, 40 lines, 0 `not ok`
  (`evidence/phase-06/ci-38415953364-p06-suites.txt`); goldens, the sync golden and the wiki `--check` green on every
  leg. **REQ-13 amended on CI evidence:** a `build` script made npm prepare the git install and broke
  `distribute-install-clean`, so `build` left `package.json` and `arc-ship` runs `npm run build --if-present`
  (ADR-2021 amended). Actual ~0.25d against 0.75d. Metrics: `amendments: 1` · `reopened: n`.
- **Phase 07 closed 2026-10-13** (`/arc-phase-done 07 --lane distribute`): **REQ-03 validated**, owed since Cycle 1. In
  OpenCode 1.17.18 on `openrouter/deepseek/deepseek-v4-flash-0731`, every run through `opencode-session.mjs`:
  `arc-commit` (`dda92dfb`) → `arc-review` (`review.completed`, archive) → `arc-commit` (`6405eef1`) → operator push →
  `arc-ship`. **5 receipts with `harness: opencode`** found by id on the main spine, each `evidence` a committed
  transcript carrying the OpenCode version and session id; `_quarantine/2026-10-13.jsonl` holds 1 stub and 0 receipts
  (run 5c's first `ship.done` emit, refused by the redactor, re-emitted 25 s later: debt row 24). **3 negatives refused**
  (branch-guard, secret-diff-scan, arc-compile `[byte-diff]`), nothing reached GitHub. **The session's PR #416 merged
  after 19/19 required checks** as `7598708a`. Spend: $0.06 measured across P07's runs; the cycle ledger reads ~$0.444
  of $0.50 because it charges killed runs at their cap. Two findings, both recorded in `evidence/phase-07/run.md`: the
  parent OpenCode session is unfenced (debt row 22), and a killed run's child linked a new Vercel project that the next
  ship deployed to production (debt row 23; the owner deleted it, URL 404). So the `ship.done` url is that deploy,
  not PR #416. Four memory-pressure kills cost reruns, not results. Actual ~0.5d against 1d. Metrics:
  `amendments: 0` · `reopened: n`.

**Appetite burn:** 1.75 of 2.75 planned days used (3-day cap): 58%. The 50% tripwire (end of P05) answered YES; the
spend kill ($0.50) was never reached; the model kill never fired (no malformed tool call; the stalls were host memory
kills, not the model).

---
## Now

**Current position: Cycle 2 SEALED 2026-10-13 (retro: `docs/retro-log.md`, HISTORY C24); lane IDLE.** REQ-03 is
validated: arc's own commit → review → ship loop ran under OpenCode on a non-Anthropic model, left 5 receipts stamped
`harness: opencode`, refused the 3 negatives and merged its own PR after required checks. All 13 distribute REQs are
validated across Cycles 1 and 2.
**Next step:** none in this lane until a new `/arc-kickoff --lane distribute`. That cycle opens on debt rows 22-24: fence the
parent session, narrow `arc-ship`'s `vercel` fence and count only a git-tracked deploy target, make a Windows wrapper
kill take the OpenCode tree, and replay the redactor refusal. Owner items: the Cycle 2 kickoff stamp
`01M4RWTX3STGAQNY4KE5XXKHCR` and the P05/P06/P07 move-on stamps (printed when emitted).
