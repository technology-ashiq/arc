---
description: End-of-phase retro — turn repeated corrections into permanent setup upgrades.
argument-hint: [phase-number (optional)]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(node .claude/scripts/plan/kickoff-lint.mjs:*), Bash(bash .claude/scripts/core/lane-resolve.sh:*), Bash(bash .claude/scripts/hq/arc-event.sh:*)
---

**Lane first** (`.claude/rules/lanes.md`): run
`bash .claude/scripts/core/lane-resolve.sh --for retro --print human` (add `--lane <name>`
if I gave one). Non-zero exit → print it and STOP. `$1` is the PHASE NUMBER, never a lane.
A retro rewrites setup files, so **name the selected lane in your confirmation first**:
"Running retro for lane `<lane>`." The retro reads that lane's tracker, but writes findings
to the COMPANY layer — `docs/retro-log.md`, `docs/trial-ledger.md`, `CLAUDE.md` — which is
single and never per-lane (ADR-0053). Root-mode is unchanged.

Run a retro on this session/phase. The build playbook's closing rule: *the setup should
improve with every project* — this command is how.

1. Scan our conversation and the phase's commits for friction:
   - instructions I had to repeat
   - mistakes you made more than once
   - permission prompts that kept appearing for safe commands
   - manual steps we performed more than once
2. For each finding, propose its permanent home (one owner per job):
   - guideline → a line in `CLAUDE.md`, or `.claude/rules/*.md` if area-specific
   - repeated multi-step request → a new `.claude/commands/*.md`
   - safe-but-nagging command → `settings.json` allow rule
   - must ALWAYS/NEVER happen → a hook (highest bar — only if advisory failed)
   - a vague/weasel word that escaped kickoff-lint → add it to the `VAGUE` regex in
     `.claude/scripts/plan/kickoff-lint.mjs` (the ban-list must compound, not ossify)
3. **Feed the kickoff loop:** for each *recurring* finding (not one-offs), append ONE
   line to `docs/retro-log.md`:
   `YYYY-MM-DD | <project> | <pattern> | <prevention> | <tags>`
   (tags = lowercase tokens like `deploy,ci,scope` — plan-attacker focus C matches history
   to a new project by tag-token overlap, not vibes.) One line, no essays — the next `/arc-kickoff` reads these to seed its pre-mortem.
4. **Scoreboard row (project retro / final phase only):** append the metrics row to
   `docs/retro-log.md`:
   `YYYY-MM-DD | <project> | <tier> | rework <reopened>/<closed> | amendments <n> | FIRED <n>/<total> | burn <actual %> | sim-blockers-r1 <n> | t-to-phase0 <days>`
   Numbers come from PROGRESS's done-log metrics + PLAN's ledgers — count, don't estimate.
   Metrics are read HERE only; they never gate mid-build. This row is how "world's best
   planning" stays a measured claim instead of a slogan.
5. **Promote trial gates (kickoff v4 F1):** read `docs/trial-ledger.md`. Append one row per
   substance gate exercised this build (`date | gate | run-ref | fired? | false-positive?`). A gate
   is **promotable** only when BOTH hold: its bats fixture proves it FAILs on its own mutation
   (`good/` still clean), AND it now has ≥ 3 logged clean dogfood runs with zero false-positives.
   For each promotable gate, propose the one-line diff that removes it from the `TRIAL` set in
   `.claude/scripts/plan/kickoff-lint.mjs`. Never promote on judgement — the ledger is the gate; a logged
   false-positive resets that gate's count.
6. Show each proposal as a concrete diff. Wait for my approval, apply only what I approve.
7. Nothing qualifies? Say so plainly — don't invent rules to look useful.
