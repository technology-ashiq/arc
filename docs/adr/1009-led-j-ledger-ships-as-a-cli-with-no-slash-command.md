# ADR 1009 — LED-J: ledger ships as `arc pnl` under `hq`, with no slash command in v1

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** the close ritual or a P&L read is repeatedly wanted from inside a Claude Code
session rather than a terminal — a slash command is then a thin wrapper over the same CLI.

## Context

Every arc capability faces the same fork: a CLI under `.claude/scripts/hq/`, or a slash command in
`.claude/commands/`. The spine's own tools (`arc-event`, `arc-brief`, `arc-inbox`, `arc-replay`)
all chose the CLI, which is the SPINE-D pattern. The design source's originating brief used
`/arc-pnl` phrasing; that phrasing is retired here.

The commands directory is also partly generated from `processes/*.process.yaml` — a hand-edited
command there is deleted by the next regeneration, so adding one is not a free act.

## Options considered

1. **CLI only: `arc pnl` under `.claude/scripts/hq/` (`arc-pnl.mjs` plus a lib)** — matches every
   sibling, testable by bats directly, scriptable, and adds nothing to the command surface.
2. **Slash command `/arc-pnl`** — discoverable in-session; a second surface to keep in sync, and it
   would need a process file, which drags in a policy subject (ADR-1011 explains why that is the
   wrong shape here).
3. **Both** — two surfaces for one capability at v1, with the sync burden and none of the evidence
   that either is wanted.

## Decision

Option 1. `arc pnl` lives at `.claude/scripts/hq/arc-pnl.mjs` with its logic in a lib beside it,
tests in central `tests/` (`ADR-0021`). **No new slash command in v1.** The no-gos say so
explicitly.

The reason that carried the most weight: the lib is the real artifact. A later HTML dashboard, a
future slash command and the daily brief all consume the same lib and the same reader unchanged —
so the CLI is not a lesser surface, it is the first consumer of the thing that matters.

## Consequences

Easier: one surface to test, one to document, and the brief integration is a library call rather
than a second implementation.

Harder: the capability is not discoverable by typing a slash in a session. Given the sole user is
the person who built it, discoverability is not the binding constraint at v1.

The month-close ritual stays human-run regardless of surface. A future scheduler may invoke the
same CLI; the gate logic never moves into a daemon.
