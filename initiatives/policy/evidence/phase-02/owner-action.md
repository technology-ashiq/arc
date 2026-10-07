# Phase 02 — the owner action (POL-L, REQ-05)

**What:** copy six generated files over their live versions. Every target is on the static deny floor and the
un-grantable list, so no agent may write it (ADR-0502) — the rule working, not an obstacle.

**Why whole files:** the Phase 04 lesson. Three diffs sat undone for a day; two whole files closed in one sitting.
These files were generated from the live ones by `generate-paste.mjs`, each edit asserted to apply exactly once, and
the paste is proven on CI by `tests/policy-evidence-paste.bats` before you apply it.

## The one step

From **Git Bash** (PowerShell sends `bash` to WSL), in the checkout that holds this branch, at the repo root:

```bash
node initiatives/policy/evidence/phase-02/verify-paste.mjs --pre && cp -r initiatives/policy/evidence/phase-02/paste/. . && node initiatives/policy/evidence/phase-02/verify-paste.mjs
```

The first check refuses to copy if any live file changed after the paste was generated (copying would revert that change). The last check prints six `APPLIED` lines and `every file is byte-identical to the paste`. Anything else: stop,
and the agent reads what `verify-paste` printed.

## What the six files change

| File | Change |
|---|---|
| `hq.policy.yaml` | `evidence_days: 35` on the 17 in-scope L1 grants (shell × 11, network × 6); the evidence code joins `ungrantable_resources` |
| `.claude/scripts/hq/lib/policy/lint.mjs` | a declared `evidence_days` must be a whole number of days, 1..3650 |
| `.claude/scripts/hq/policy-lint.mjs` | `--evidence` runs `policy-evidence.mjs check` after the file is law (exit 3 = law, but BELOW-BAR) |
| `.claude/scripts/hq/policy-hook.mjs` | an L1+ propose or deny writes ≤ 1 `policy.refusal` per capability, decision and IST day; 3000 ms bound; never changes the block |
| `.claude/scripts/hq/lib/policy-evidence/fold.mjs` | the fold learns the interactive writer exists (in the same paste as the writer) |
| `.claude/settings.json` | the deny floor names the evidence code (`Edit`/`Write` on 3 paths) |

## After it is applied

The agent commits the six files (a commit is not an edit — the deny floor governs the Edit/Write tools), pushes, reads
CI per job, and records the before/after `report` in `live-demo.md`. Nothing about any level changes.
