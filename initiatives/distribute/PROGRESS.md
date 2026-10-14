# PROGRESS.md — distribute Cycle 3 "zero-step access and the lifecycle"

status: LIVE
cycle: arc-distribute (Cycle 3, opened 2026-10-14)
phase: 10
appetite: 4d
burn: 2.25d
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
| 08 | Self-render + kill check + debt 22-24 (REQ-14) | 1d | 🔨 built, attack r1+r2 done |
| 09 | `outdated` + `upgrade` + manifest v2 + `version-lint` (REQ-16, 17) | 1d | 🔨 built |
| 10 | `uninstall` + `init` default-all + registry + launch slot + radar; retro + seal (REQ-15, 18, 19) | 1d | 🔨 built |

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

**Appetite burn:** ~2.25 of 3 planned days used (4-day cap): ~56%. 50% tripwire: REQ-16 arms green on CI is read on `e08d759f`. Kill checkpoint answered YES; 50% tripwire at day 2.

---

## Now

**Current position: Cycle 3 kickoff written 2026-10-14 on `feat/distribute-c3`; the owner pre-approved building in chat.**
**Next step:** push P08 + P09 once, read CI per job (50% tripwire = REQ-16 arms green), fix what CI finds, then Phase 10.
