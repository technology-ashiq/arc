---
description: The PR loop's adversarial pass as governed engine work -- two fresh attackers (logic + boundary) run headless through arc-run, carrying the lane's fixed-defect patterns. Reports only; never fixes, never commits (ADR-0226).
argument-hint: [--base REF | --since SHA] [--lane <name>] [--round K] [--phase NN]
allowed-tools: Bash, Read
---

Attack the pushed diff: **$ARGUMENTS**

**Lane first** (`.claude/rules/lanes.md`): run
`bash .claude/scripts/core/lane-resolve.sh --for attack --print human` (add `--lane <name>` if I
gave one). Non-zero exit → print what it printed and STOP. In lane-mode echo `Selected lane:` first.

**Where this runs.** Not in the session that wrote the code — that session ends at push
(CLAUDE.md). Run it from the **main clone**: `arc-run` writes no receipt from a linked worktree.

1. **Run both surfaces, one command** (default `--base main` if I named neither `--base` nor
   `--since`; always quote values):
   ```bash
   node .claude/scripts/engine/arc-attack.mjs --base "main" --lane "<lane>"
   ```
   - **boundary** runs on the router class `attack-diff` (balanced-workhorse, claude-code), with
     no tools at all: the attacker sees its input and nothing else.
   - **logic** runs `--driver generic-api --trial-model $ARC_ATTACK_TRIAL_MODEL` — an ADR-0069(g)
     trial, receipted `model_source: trial`. With that variable unset it prints
     `LOGIC: NOT RUN` and exits 7. **Never substitute a general-purpose agent for it.** Say it did
     not run, and name the three env vars it needs (`ARC_LLM_ENDPOINT`, `ARC_LLM_API_KEY`,
     `ARC_ATTACK_TRIAL_MODEL`).
   - Round 2 attacks the fixes: `--round 2` picks up round 1's result for each surface. Max two
     rounds per PR; LOW leftovers go to the debt ledger.

2. **Print its output verbatim.** Findings are written to
   `initiatives/<lane>/evidence/phase-NN/attack-<sha7>-r<K>-<surface>.json`.
   Exit codes: `0` both ran · `1` a run failed or answered the wrong surface · `2` usage ·
   `3/4/5` lane · `6` empty diff · `7` logic NOT RUN.

3. **Stop there.** No fixing, no commit, no push. Each finding becomes a fix slice in the NEXT
   interactive session (`/arc-resume`, then `/arc-develop`), and every fixed hole is appended to the
   lane's `fixed-defects.md` so the next attacker carries it.
