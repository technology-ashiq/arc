# ADR 0054 — PORT-E: uniform explicit `--lane` flag, dual-mode resolution, kickoff-only creation

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

Seven surfaces read tracker state today at hardcoded root paths: `/arc-kickoff`,
`/arc-resume`, `/arc-change`, `/arc-phase-done`, `/arc-retro`, kickoff-lint,
arc-evidence. They must find the right lane without ever guessing, while consumer repos
(LexOS, venturemind) keep today's single-root layout forever. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §4 flowchart, §5 PORT-E, **owner-locked
2026-07-29 (round 6)**.

## Options considered

- Uniform explicit `--lane <name>` on every surface — accepted.
- Positional lane token (`/arc-resume design`) — rejected (§14, round 6): command names
  are product-flavored (`/arc-design design` reads double) and free-text surfaces
  (`/arc-change <what>`, `/arc-kickoff <goal>`, `/arc-qa [url]`) make a bare first token
  ambiguous with the description/goal/route — a real context-miss risk.
- cwd-based lane inference — rejected (§14): hidden state; sessions anchor at repo root;
  wrong-lane accidents start exactly there.
- Renaming the flag (`--product` / `--initiative`) — rejected (§14): `--product` collides
  with the `products/` module registry; vocabulary table locks "lane".

## Decision

**One rule everywhere:** every surface accepts explicit `--lane <name>`; bare tokens keep
their existing per-command meanings (phase number, goal text, route) and are NEVER parsed
as a lane. `--lane` omitted → auto-resolve if exactly one LIVE/BLOCKED lane exists → else
list lanes and ask — never guess. No `initiatives/` dir → **root-mode, byte-identical to
today** (permanent consumer contract, bare-root CI fixture). Lane names validated
(`[a-z][a-z0-9-]*`). **Lane creation = `/arc-kickoff` ONLY** (birth ceremony, WIP info
line printed); every other surface hitting an unknown lane → **hard STOP listing known
lanes**, never auto-creates. Canonical output order everywhere:
`Selected lane: <lane> (via arg|auto)` → board summary → the command's report.
Destructive commands (`/arc-phase-done`, `/arc-retro`, migration) include the selected
lane in their confirm/STOP output. SessionStart degraded rule (passive hook cannot ask):
zero or multiple eligible lanes → print board + one hint line, select NOTHING; exactly
one → full canonical order.

## Consequences

- Root-mode goldens must be pinned BEFORE any refactor (REQ-01) — the regression net.
- Resolution is routing code: the adversarial construct-a-breaking-input pass applies
  (lane-name fixtures: `../`, absolute path, empty, uppercase, leading-digit).
- If generalizing resolver/lint burns >0.5d, assumption A1 FIRES: ship root goldens +
  minimal explicit `--lane` routing only, postpone auto-resolution and migration.
