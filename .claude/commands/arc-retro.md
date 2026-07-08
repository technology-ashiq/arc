---
description: End-of-phase retro — turn repeated corrections into permanent setup upgrades.
argument-hint: [phase-number (optional)]
---

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
3. Show each proposal as a concrete diff. Wait for my approval, apply only what I approve.
4. Nothing qualifies? Say so plainly — don't invent rules to look useful.
