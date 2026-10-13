# PROGRESS.md — distribute Cycle 3 "zero-step access and the lifecycle"

status: LIVE
cycle: arc-distribute (Cycle 3, opened 2026-10-14)
phase: 08
appetite: 4d
burn: 0d
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
| 08 | Self-render + kill check + debt 22-24 (REQ-14) | 1d | ⬜ |
| 09 | `outdated` + `upgrade` + manifest v2 + `version-lint` (REQ-16, 17) | 1d | ⬜ |
| 10 | `uninstall` + `init` default-all + registry + launch slot + radar; retro + seal (REQ-15, 18, 19) | 1d | ⬜ |

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

**Appetite burn:** ~0.5 of 3 planned days used (4-day cap): ~12%. Kill checkpoint answered YES; 50% tripwire at day 2.

---

## Now

**Current position: Cycle 3 kickoff written 2026-10-14 on `feat/distribute-c3`; the owner pre-approved building in chat.**
**Next step:** `/arc-attack` on the P08 commit, fix, one push, CI green, then Phase 09 (`outdated` + `upgrade` + manifest v2 + `version-lint`).
