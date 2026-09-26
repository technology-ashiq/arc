---
description: The PR loop's adversarial pass as governed engine work -- two fresh attackers (logic + boundary) run headless through arc-run, carrying the lane's fixed-defect patterns. Reports only; never fixes, never commits (ADR-0226).
argument-hint: [--base REF | --since SHA] [--lane <name>] [--round K] [--phase NN]
allowed-tools: Bash, Read
---

Attack the committed diff, BEFORE it is pushed: **$ARGUMENTS**

**Lane first** (`.claude/rules/lanes.md`): run
`bash .claude/scripts/core/lane-resolve.sh --for attack --print human` (add `--lane <name>` if I
gave one). Non-zero exit → print what it printed and STOP. In lane-mode echo `Selected lane:` first.

**Where and when this runs.** Run it from the building session, on the LOCAL commit, before any push; do not
start a new session for it. The attacker stays fresh because `arc-run` hands it only the diff, with `tools: []`
(ADR-0226, amended 2026-09-24). It diffs the local HEAD against the base ref, so it never needs a push -- and every
push buys a full CI run, so pushing per round wasted three or four runs per PR (Amendment 2). The order is: commit,
round 1, fix, round 2, fix, **push once**, read CI per job, fix only what CI finds, merge on green. Run it from the
**main clone** when a receipt matters, because `arc-run` writes no receipt from a linked worktree.

1. **Run both surfaces, one command.** Fetch first, and default to `--base "origin/main"` if I named
   neither `--base` nor `--since` -- local `main` lags merges in the main clone, and a stale base
   hands the attacker other lanes' already-merged code. Always quote values:
   ```bash
   git fetch -q origin
   node .claude/scripts/engine/arc-attack.mjs --base "origin/main" --lane "<lane>" --classification "<internal-only|external-ok>"
   ```
   **Classification defaults to `internal-only`, and internal-only is refused (exit 2)**: the data
   boundary (ADR-0219) sends internal-only input to no model at all, so neither surface can run.
   Pass `external-ok` only when this repo's code is public anyway (arc's is; a venture repo such as
   LexOS is not). If unsure, leave it out and say the attack cannot run on this repo.
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

3. **The attacker only reports; the building session fixes, in this same session** (ADR-0226
   Amendment 1). Fix every critical, high and medium finding now, as a fix slice of the current
   phase. Append each fixed hole to the lane's `fixed-defects.md` so the next attacker carries it.
   Then commit (locally) and run `--round 2` against the fixes. After round 2, LOW leftovers go to the
   debt ledger. THEN push once, read CI per job with `ci-digest`, fix anything red here too, and merge
   on green. CI is still required: it sees what an attacker reading a diff cannot (the typecheck, three
   operating systems, a test wrapper's own bugs, hand-kept count floors).
   Never stop at a findings list and hand it to "the next session": a new session costs ~100k tokens
   and adds no independence.
