# PROGRESS.md — Cycle 4 · arc-portfolio "The Conductor"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 3 · arc-design) CLOSED 2026-07-30: `docs/archive/PROGRESS-2026-07-30.md`.
> Note: this tracker migrates itself to `initiatives/portfolio/` in Phase 1 (REQ-02) —
> pointer stubs will remain at the root paths.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Dual-mode machinery (steel thread): root goldens, resolver on 7 surfaces, creation/STOP/echo/adversarial fixtures | 1.25 days | 🔨 in progress |
| 01 | Self-host + link history + board v1 (rehearsed rollback; close in lane-mode) | 0.75 days | ⬜ pending |
| 02 | Parallel-safety floor: WIP info line, board lint, ownership lint, spine spool | 0.75 days | ⬜ pending |
| 03 | Docs truth + retro | 0.25 days | ⬜ pending |

**Appetite burn:** 0 of 3 days used. Kill tripwire: 1.5 days without Phase 0 closed.

## Done log

- 2026-07-30 — Kickoff: Cycle 3 archived (`docs/archive/PLAN-2026-07-30.md` +
  `PROGRESS-2026-07-30.md` + `phases-design-2026-07-30/`); PLAN.md written from the
  frozen pack `docs/strategy/plans/PLAN-portfolio.md`; ADR-0050..0059 recorded
  (PORT-A…J); 4 phase specs; kickoff-lint green; spine receipts emitted
  (kickoff.done + approval.requested). Question-planner returned zero open forks —
  all §15 items owner-closed 2026-07-29. Attack panel: merged A+C run reconciled
  into PLAN mutations.

## Now

**Position:** Plan APPROVED 2026-07-31 (decision.recorded on approval
01KYT4YM2N9TRE9GPWDCY3VSSR). Phase 0 open on `feat/portfolio-kickoff`.

**Done so far — Phase 0, all four steps executed; exit criteria not yet formally checked:**

1. **Root-mode goldens PINNED pre-refactor** — `tests/root-golden.bats` (7) +
   `tests/fixtures/root-golden/`: SessionStart/SessionEnd hooks, kickoff-lint pass+fail,
   arc-evidence usage+verify-missing. Normalization DECLARED in `_arc_root_norm` (strips
   CR/hashes/clock/paths only; per-OS override slot; named regen step).
2. **A2 VERIFIED HOLDING** — no manifest and no sync path ships root PLAN/PROGRESS/phases.
3. **Resolver seam landed** (ADR-0054) — `lane-resolve.sh` + `lane-resolve.mjs` twins,
   held identical by an equivalence gate. kickoff-lint now splits company root
   (docs/adr, retro-log) from tracker root; arc-evidence routes bundles lane-scoped.
   Five command surfaces cite `.claude/rules/lanes.md` and call the resolver.
   Tests: lane-resolver 44 · lane-surfaces 19 · root-golden 7, all green.
4. **Adversarial pass RUN and its holes CLOSED** — fresh-context attacker returned 18
   findings. Four HIGH, all in `arc-evidence.sh`'s unquoted `$lane_args`: a crafted
   `--lane` value smuggled `--for kickoff` (a surface with no creation rights reporting
   `create`) or `--print human` (a lane's bundle silently redirected into the FROZEN
   `docs/evidence/`), plus an infinite loop when a value-taking flag came last, and a
   name truncated into a *different* valid lane. Also fixed: kickoff-lint anchored on
   cwd instead of the git toplevel (running from inside a lane silently left lane-mode
   and produced a false `[adr]` failure); `~~~` fences ignored; empty `initiatives/`
   was a permanent un-answerable dead end; four bash/node divergences (dot-entries,
   word-split+glob leaking the caller's cwd into a machine field, non-ASCII sort order,
   NUL byte flipping eligibility); phase token `phase-9-of-12` bundling as phase 912.
   **Gate honesty fix:** the equivalence helper existed but was never called — 31
   assertions ran ONE twin while the gate claimed both. Every case now runs both.
   All 18 reproduced against the attacker's own commands before and after.

**Next step:** close Phase 0 via `/arc-phase-done 0` — walk the spec's exit criteria and
Verification plan, bundle evidence, and let CI prove the 3-OS leg (the one claim not yet
evidenced locally: Windows-reserved-name and cross-OS fixtures are written but only the
Windows leg has run here).

blocked-on: —
depends-on: — 
