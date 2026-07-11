---
description: Reconstruct where we left off — position, health, scoreboard, risks, next action — from the committed tracker + last snapshot. Read-only: resume never writes state.
allowed-tools: Read, Glob, Grep, Bash(git status), Bash(git branch:*), Bash(git log:*), Bash(node .claude/scripts/kickoff-lint.mjs:*)
---

Reconstruct session state. Resume is a dashboard, not an essay — gather facts first,
then report in EXACTLY the 5-block format below (each block 1–3 lines, no padding).

**Gather (deterministic first):**
1. **Health:** run `node .claude/scripts/kickoff-lint.mjs` (plan drift since last session)
   and `git status` + current branch. Dirty tree, lint failures, or build work sitting on
   `main` (belongs on `feat/*`) are flags, not footnotes.
2. **Position:** read `PROGRESS.md` `## Now` (single source of truth), the latest
   `.claude/state/` snapshot (PreCompact hook), and the active `phases/phase-NN-spec.md`
   (its DoD + Verification plan).
3. **Scoreboard:** from PLAN.md — REQ counts by status (validated / active / dropped),
   the active phase's own REQs with acceptance criteria, and the appetite position:
   burn % from PROGRESS.md vs PLAN's kill criteria. Burn past the tripwire with the
   tripwire phase not done = the scope-cut conversation is DUE.
4. **Risks:** any Assumptions-ledger trigger marked `FIRED` that hasn't been routed
   through `/arc-change` yet; any overdue kill-criteria tripwire.

**Report (exactly this shape):**
- `POSITION` — phase N (name), what's done, where we stopped.
- `HEALTH` — lint pass/fail · git clean/dirty · branch (right one?).
- `SCOREBOARD` — REQs: V validated / A active / D dropped · appetite: X% burnt vs tripwire.
- `RISKS` — FIRED assumptions, overdue tripwire — or "none".
- `NEXT` — the ONE exact next action, taken from the phase spec's Verification plan/DoD.

**Rule: if HEALTH or RISKS is red, NEXT is fixing that — never feature work on a broken
base.** Then resume the Golden Loop. State comes from files in git, not loose WIP
commits — a resume is always reproducible. Resume READS state; it never writes it.
