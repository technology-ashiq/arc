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

**Appetite burn:** ~1.25 of 3 days used — Phase 00 consumed its full allocation, including
the cross-OS fix round. Kill tripwire: 1.5 days without Phase 0 closed — **not reached**;
Phase 0 is complete on all criteria and awaiting `/arc-phase-done 0`.

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

5. **Cross-OS defects found by CI, fixed (#71)** — the first 3-OS run came back red on two
   legs, and PR #68 had been merged in that state. Both traced to one root: shell text
   handling is locale-dependent where its twin is not. **macOS** — a bracket RANGE resolves
   through the locale's collation table, which interleaves case there, so `*[!a-z0-9-]*`
   never fired for `D` and `Design` was accepted as a lane name (`lanes=Design portfolio`);
   the .mjs regex is codepoint-ranged and refused it, and the equivalence gate caught the
   divergence — only because step 4's gate-honesty fix had landed first. **windows** — two
   `@test` names carried U+2014; bats builds a function identifier from a test's NAME, and
   under the C locale bash walks bytes, so both tests were absent from the run. The step was
   red, but its only explanation was a `# bats warning:` comment among 91 `ok` lines.
   Fixed twice over (`LC_ALL=C` export **and** explicit character lists — a list has no
   collation semantics, so the check survives losing the export). An adversarial sweep found
   the same construct live in `design-explore.sh`; also fixed. Four guards added, each proven
   to go red against a constructed breaking input: executed-vs-declared TAP reconciliation in
   CI (cause-agnostic, every leg), non-ASCII `@test` names, `.bats` in a subdirectory, and a
   ratchet on new negated letter-ranges with a stale-allowlist check.
   **Verified green on all 3 OS** (run 30610231939 + main @ #75): macOS tests 264/268/287/294
   now `ok` with zero `lanes=Design`; windows shard 9/9 reconciles 93/93 (was 91/93); no real
   `bats warning` on any leg.

**Assumption A5: FIRED 2026-07-31**, recorded in PLAN's ledger. Its trigger detected the right
event class but named the wrong scope (Windows-only) and the wrong remedy (path-string
compare). Its original subject — `git mv` casing — remains unvalidated and is load-bearing for
the Phase 1 move (REQ-02): Phase 1 must test casing explicitly rather than inherit A5's
now-spent credibility.

**Carried forward, deliberately not fixed (same bug class, out of this cycle's scope):** the
`_slug` pair (`design-critique.sh:42`, `design-render.sh:71`) slugs the same route differently
per box under UTF-8, and the slug is an artifact filename — changing it renames existing
artifacts, so it needs a behaviour decision, not a quiet fix. `shard-tests.mjs:77`'s
`localeCompare` tiebreak claims a byte determinism it does not provide (no divergence today,
verified across 13 collations). Both are named in `tests/portability.bats`'s allowlist, and a
companion test fails if an entry stops matching — so neither can rot into a gate that lies.

**Next step:** close Phase 0 via `/arc-phase-done 0` — walk the spec's exit criteria and
Verification plan, bundle evidence. The 3-OS claim is now evidenced, not asserted.

blocked-on: —
depends-on: — 
