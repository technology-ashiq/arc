---
description: Independent cross-model review of the current diff (OpenAI Codex CLI or a second model), compared against /arc-review. Critical disagreement blocks ship.
argument-hint: "[base-ref] (default: main)"
allowed-tools: Bash, Read, Write, Glob, Grep
---

Get an independent, cross-model review of the current diff vs **${ARGUMENTS:-main}**.

1. Build a compact diff summary + the file diffs.
2. Send them to a **second model**. Prefer the OpenAI Codex CLI if on PATH:
   ```bash
   git diff ${ARGUMENTS:-main}...HEAD | codex exec "Review this diff for correctness, security, and edge-case bugs. List findings with severity (critical/high/medium/low) and file:line."
   ```
   If `codex` is unavailable, fall back to a configured second Claude profile. If neither exists, say so -- **do not fake a second opinion**.
3. Compare its findings against the most recent `/arc-review` (code-reviewer) output archived in `docs/reviews/`. Produce an **overlap analysis**: agreed findings (high confidence), and findings unique to each model.
4. Archive to `docs/reviews/$(date +%F)-second-opinion.md`.

## The arc twist -- disagreement is a gate
If the two models **disagree on a CRITICAL finding** (one flags critical, the other clears it), do not let it slide: surface it loudly and treat ship as **blocked** until the human resolves it. Record the block in `PROGRESS.md` `## Now`.
