# PROGRESS.md — distribute Cycle 3 "zero-step access and the lifecycle"

status: IDLE
cycle: arc-distribute (Cycle 3, opened 2026-10-14)
phase: 10 (cycle closed)
appetite: 4d
burn: 2.5d
blocked-on: —
depends-on: —

Tracker for `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`. Evidence in `initiatives/distribute/evidence/phase-NN/`.
Cycles 1 and 2 are archived under `archive/` (`PLAN-cycle{1,2}-2026-10-13.md` + PROGRESS twins); their 13 validated REQs
and phases 00–07 stand. ADR century 2000–2099; Cycle 3 writes ADR-2023..2027. The owner approved the full v1.4 Cycle 3
block in chat on 2026-10-14 with no cuts ("no cut ethume miss aga kodathu … complete all phase … don't wait for me …
push permission iruku, code merge … ella phases complete aana apram"). Every phase is built on `feat/distribute-c3` and
merged once at cycle end; each phase closes from the main clone after that merge.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — parked, shipped in Cycle 1 | — | ✅ |
| 08 | Self-render + kill check + debt 22-24 (REQ-14) | 1d | ✅ |
| 09 | `outdated` + `upgrade` + manifest v2 + `version-lint` (REQ-16, 17) | 1d | ✅ |
| 10 | `uninstall` + `init` default-all + registry + launch slot + radar; retro + seal (REQ-15, 18, 19) | 1d | ✅ |

## Done-log

- **Kickoff 2026-10-14** (receipts `kickoff.done` 01M4VPX3VKXVM4XND3GZ20Q225, `approval.requested` 01M4VPX5FTYQ2BHFHQA4NJZ676; the owner pre-approved building in chat, the stamp stays theirs): PLAN (tier M, 6 REQs), phase specs 08–10, ADR-2023..2027. Survey facts that shaped it: no
  rendered target writes `AGENTS.md` (it stays the brain, so it is not a render output as v1.4 said); codex and skills-only
  collide on `.agents/skills/` (26 of 30 shared files differ), hence the one-owner-per-path rule; the `inside-source`
  guard covers every target (kept: each rendered init also copies the support payload, found while building) and zero
  git tags exist. Attack panel (A/B/C, 21 findings): 20 applied, 1 rejected (the `--to` cut, owner-locked); the tag moved to
  the seal. Simulation gate: 4 + 4 blockers, all missing spec facts, fixed in the spec; the second non-zero round is a
  human call by rule, taken by the owner's standing "don't wait, ask only if needed" and reported.

- **P08 2026-10-14** (built, not closed): `compile --self` + committed outputs (177 files), `action-stale-self-render`
  row + pre-commit line, `distribute-self-render.bats`. **Kill checkpoint: YES** — a fresh clone opened in OpenCode ran
  the committed `/arc-resume` through its fence and returned the 5-block report, no tracked change after
  (`evidence/phase-08/kill.md`, $0.0393). Debt 22 fixed and probed live (top-level session fenced, `probe.md`, $0.0083);
  23 fixed (deploy fence, tracked target, tree recorded and reaped after a killed wrapper, exit 7); 24 reproduced and
  fixed in the redactor (`redact-replay.md`). A-15 holds statically (`codex-skills.md`). First CI run on `161a384d`: 2
  red tests across 6 jobs (plan-bound allowlist, a RAN regex), both fixed. Cycle spend $0.0476 of $0.15.

- **P08 attack 2026-10-14**: round 1 on `8707a5c` (boundary 10, logic 12; the logic surface returned malformed JSON
  once and was re-run on the same model, as the rule asks) and round 2 on `0eb78f6` (boundary 15, logic 12). Every
  critical/high/medium fixed or answered already-covered, lows ledgered (debt 25-31), fixed-defects (ct)-(do). Two
  findings changed the design: the reaper keys a process on pid + start time + command line, never pid alone, and a
  run record git tracks is refused. To run at all, the attack input had to leave out the 211 generated or recorded
  files (`build-attack-input.mjs` GENERATED/RECORDS; ~1 MB of diff down to ~230 KB).
- **P09 2026-10-14** (built with P08's attack fixes, not closed): manifest v2 (`targets`, `tag`, `commit`, per-file
  target; v1 still read), `arc outdated` and `arc upgrade [--to] [--confirm] [--force]` in
  `install-targets/lifecycle.mjs` (`--to` renders from a temp-index extract, never a checkout), `version-lint.mjs`
  called by the existing `version-gate.sh`, `package.json` 0.1.0 → 0.2.0 and a dated `[0.2.0]` (the lint found both
  drifts on its first run), `tests/distribute-lifecycle.bats` (11).

- **P10 2026-10-14** (built, not closed): `arc init` with no `--target` places all four harnesses under one v2 manifest
  (668 files on a scratch project; a second init writes only the record), registers the project in
  `~/.arc-private/consumers.json` (opt-in by directory), `arc uninstall [--force]` (managed files only, modified kept,
  record kept until done, hooks unset only when init set them), `arc outdated --all`, the radar job script, and
  `owner-apply-radar-policy.mjs` for the three ceiling files. `tests/distribute-p10.bats` (7). The launch slot is the
  launch lane's (`evidence/phase-08/launch-prompt.md`).

- **P09/P10 attack + real checks 2026-10-14**: attack on the P09+P10 commits only (`cc5f385`, 120 KB; boundary 13,
  logic 15): mediums fixed (registry lock and no links, GIT_* scrubbed, `--force` backs up, radar via node with
  timeouts), lows and already-covered ledgered (debt 32-33), fixed-defects (dp)-(dt). CI on the first push
  (`9443de57`) found `version-lint` without a face room and a hash-only sync-golden row from the merge-conflict regen;
  both fixed in `e08d759f`. Real-system checks: a genuine v1 consumer made by the `4741c770` CLI read `11 commits
  behind`, upgraded to v2 with its owner file untouched (`evidence/phase-09/demo.md`); a venture born with every harness,
  watched, then uninstalled to its own files (`evidence/phase-10/demo.md`).

- **Phase 08 closed 2026-10-14** (`/arc-phase-done 08 --lane distribute`, from the main clone): REQ-14 validated. Built
  on `feat/distribute-c3`, merged once at cycle end as PR #419 (`b478b743`), CI 19/19 on head `f1fb1594` (run
  38566913612; the merged tree equals the head). `distribute-self-render` 9, `distribute-redact-replay` 2 and
  `distribute-opencode-session` 18 ran `ok` on all 5 legs that carry them, 0 `not ok`, 0 skipped
  (`evidence/phase-08/ci-38566913612-p08-suites.txt`). **Seal kill re-check: YES** on a fresh clone of merged `main`
  (`evidence/phase-10/kill-seal.md`, $0.0076): 21 read-only calls, 3 fence denials, no tracked change. Receipts
  `phase.closed` 01M4XDT77MW2VC3208MJQ5Z2VX, `approval.requested` 01M4XDT8NMFZBYWZKXTHF5VYYT. Actual ~1d vs 1d.
  amendments: 0 · reopened: n.
- **Phase 09 closed 2026-10-14**: REQ-16 and REQ-17 validated. `distribute-lifecycle` 11 ran `ok` on 5 legs, among them
  `version-lint passes the committed tree and fails each drift` (`evidence/phase-09/ci-38566913612-p09-suites.txt`);
  the real v1 consumer read `11 commits behind` and upgraded (`demo.md`). `v0.2.0` is cut as an annotated tag on
  `b478b743` and pushed; `version-lint` in the main clone now reads `tags: 1 read; v0.2.0 has its section`. Receipts
  01M4XDTA64KCW2G4GTEM06B9RC / 01M4XDTBC0TPYA2N5KF97186TC. Actual ~0.5d vs 1d. amendments: 0 · reopened: n.
- **Phase 10 closed 2026-10-14**: REQ-18 validated; `distribute-p10` 7 ran `ok` on 5 legs, the escape-link mutant BUILT
  on every leg (a junction on Windows). **Owed, as PLAN's spend/tripwire rule records unproven work:** REQ-15's launch
  `core` slot clause (the launch lane answers `evidence/phase-08/launch-prompt.md`, A-17; `init` alone stands) and
  REQ-19's seal run (the owner applies `owner-apply-radar-policy.mjs`; no `consumers.json` exists yet because no
  project was installed by `arc init`). Both stay `active`. Receipts 01M4XDTCE1MMPSAF5X7SAXXWHQ /
  01M4XDTDCRVF26Y4E78PNZW5A6. Actual ~1d vs 1d. amendments: 0 · reopened: n. Debt row 34 (cycle ledger scope) filed
  at the seal.
- **REQ-19 validated 2026-10-15** (seal run, owed at the close): the owner applied `owner-apply-radar-policy.mjs`,
  merged as PR #429 (`77840115`, CI 19/19 on head `63f4b8cd`). CI asked for two fixes on the way: face rooms for the new
  process and job, and a sandboxed radar in the `jobs-panel` catchup suite. A trial project became the first `arc init`
  consumer (671 files, every harness). The radar then ran once from the main clone: `metric.observed`
  01M4Y4B7XPWXSFVC7NRFSYP62C, 1 of 1 behind, no path in the payload, not in `_quarantine/`, and 0 files written in the
  consumer (`evidence/post-merge/req19-radar-seal.md`). **Next acting fire: 2026-10-22 07:45 IST** (daily fires print `not due`
  until then). The owner's 4 stamps were approved 2026-10-14 (`decision.recorded`).

**Appetite burn:** ~2.5 of 3 planned days used (4-day cap): ~63%. The 50% tripwire held (REQ-16's arms green on CI). Live spend $0.0551 of $0.15.

---

## Now

**Current position: Cycle 3 SEALED 2026-10-14 (retro: `docs/retro-log.md`, HISTORY C25); lane IDLE.** arc ships as
`v0.2.0`. A clone of arc opens in OpenCode or Codex with its commands and no install step. `arc outdated` and `arc upgrade`
tell a project the truth and move only arc's files, `arc uninstall` removes exactly the manifest's files, and `arc init`
places every harness at once. The weekly radar is live: its first run was 2026-10-15 and the next acting fire is 2026-10-22.
REQ-14, 16, 17, 18 and 19 are validated; only REQ-15's launch `core` slot clause is owed.
**Next step:** none in this lane until the launch lane answers `evidence/phase-08/launch-prompt.md` (A-17) or a new
`/arc-kickoff --lane distribute`. All owner stamps are approved.
