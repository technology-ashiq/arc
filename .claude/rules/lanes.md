# Lanes — which workspace a command operates on

Cycle 4 (arc-portfolio). Decisions: ADR-0050 (`initiatives/<lane>/`) · ADR-0051 (one plan
per lane, `PORTFOLIO.md` is a view) · **ADR-0054 (this file's rules)** · ADR-0053 (company
organs stay single) · ADR-0055 (evidence lane-scoped forward).

## The one rule

**`--lane <name>` is the only way to name a lane.** Bare tokens are never lanes — a
command's first argument is its own (a phase number, a route, a goal sentence, a URL).
`/arc-design design` would otherwise read double, and `/arc-change design the header`
would silently retarget a lane instead of describing a change.

## Resolution order (never guess)

1. `--lane <name>` given → validate → use it.
2. omitted, and `initiatives/` does **not** exist → **ROOT-MODE**: today's behavior,
   byte-identical. This is a permanent consumer contract (LexOS and every venture repo
   run root-mode), not a migration shim.
3. omitted, `initiatives/` exists, exactly **one** eligible lane (`status:` LIVE or
   BLOCKED in its `PROGRESS.md` machine header) → auto-resolve to it.
4. anything else → **ask**. List the lanes and stop. Never pick one.

## Who may create a lane

**`/arc-kickoff` only.** It is the birth ceremony. Every other surface — resume, change,
phase-done, retro, evidence, lint — that is handed an unknown lane **hard-STOPs**, lists
the known lanes, and creates nothing. No command ever scaffolds an empty lane.

## Output order (every lane-mode command, same order)

```
1. Selected lane: <lane> (via arg|auto)     ← wrong-lane risk, addressed first
2. PORTFOLIO board summary                   ← company context
3. the command's own report
```

Root-mode prints **no** lane line at all. Destructive commands (`/arc-phase-done`,
`/arc-retro`, any migration step) must name the selected lane in their confirm/STOP
output before they change anything.

## How to resolve, in practice

```bash
bash .claude/scripts/core/lane-resolve.sh --for <surface> [--lane <name>] --print human
```

Exit `0` resolved · `3` ambiguous (ask) · `4` unknown lane (STOP) · `5` invalid name. On a
non-zero exit, print what it printed and stop — do not improvise a lane. Drop `--print
human` for stable `KEY=value` output (`mode`, `lane`, `tracker`, `lanes`, `eligible`,
`counted`, …) when a script needs to branch. Node callers import `resolveLane` from
`.claude/scripts/core/lane-resolve.mjs` instead of shelling out.

Resolution is read-only: it reports a decision and never creates, moves, or writes.

## Paths, once a lane is selected

| What | Root-mode | Lane-mode |
|---|---|---|
| Plan / progress / phases | `PLAN.md`, `PROGRESS.md`, `phases/` | `initiatives/<lane>/…` |
| Evidence bundles | `docs/evidence/phase-NN/` | `initiatives/<lane>/evidence/phase-NN/` |
| ADRs, retro-log, HISTORY, trial-ledger, tests | repo root — **always**, never per-lane (ADR-0053) | same |

`docs/evidence/**` and `docs/archive/**` are frozen: the sole canonical copy of
pre-portfolio history. Lanes link to history, never copy it (ADR-0058).

## Lane names

`[a-z][a-z0-9-]*`, 64 chars max, and never a Windows reserved device name (`con`, `prn`,
`aux`, `nul`, `com0`-`com9`, `lpt0`-`lpt9`) — those pass the grammar but break `mkdir` on
exactly one of the three CI legs. A directory under `initiatives/` whose name breaks the
grammar is not a lane on any OS.
