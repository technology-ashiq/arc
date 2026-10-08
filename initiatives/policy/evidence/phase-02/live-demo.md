# Phase 02 — live demo (policy cycle 2, POL-L): the owner's paste, applied

Merged as `494e0f46` (PR #384). The merged tree is verified by `workflow_dispatch` run 37828894878, 19/19 on attempt 2
(see the done-log for the one flake).

## The paste, applied and byte-compared (main clone, Git Bash)

```
$ node initiatives/policy/evidence/phase-02/verify-paste.mjs
APPLIED  hq.policy.yaml  live=7692257bc365 paste=7692257bc365
APPLIED  .claude/scripts/hq/lib/policy/lint.mjs  live=8617d3d18aca paste=8617d3d18aca
APPLIED  .claude/scripts/hq/policy-lint.mjs  live=b9aa9b86932c paste=b9aa9b86932c
APPLIED  .claude/scripts/hq/policy-hook.mjs  live=f0d811e5243e paste=f0d811e5243e
APPLIED  .claude/scripts/hq/lib/policy-evidence/fold.mjs  live=18f2b72674df paste=18f2b72674df
APPLIED  .claude/settings.json  live=31cbd7b15f94 paste=31cbd7b15f94
verify-paste: every file is byte-identical to the paste
```

The owner applied it and committed it too: the auto-mode classifier refused the agent the commit as well as the edit
(`[Self-Modification]`), so the plan's "a commit is not an edit" did not hold in this harness. Retro row.

## The armed hook's refusal, read back as `last_refusal` (throwaway root, `live-demo.txt`)

REQ-05's acceptance is a real tool call in a throwaway root, not on the canonical spine: the PLAN's no-gos forbid a
synthetic run whose only purpose is refreshing a cell. Two blocked Bash calls on one IST day seal one refusal, and the
cell turns `absent` → `fresh`; the hook's block and exit code are unchanged.

```
BELOW-BAR session:interactive/shell L1 absent N=35 refusal=-          (before)
BLOCKED by policy: Bash needs shell ... exit=2                        (call 1 and call 2, same words)
REFUSALS 1 <ULID>
PASS      session:interactive/shell L1 fresh age 0d N=35 refusal=<ULID> (after)
policy-lint --evidence (sandbox): 16 BELOW-BAR, exit=3
```

## The canonical spine after the paste (main clone at `a9f7a0fa`, as-of 2026-10-09)

```
policy-evidence: as-of 2026-10-09 -- 15 subjects, 120 cells, 17 in scope, 17 BELOW-BAR, 0 spine line(s) rejected, 63 day file(s) read
  15 unknown  (process:* shell/network -- a headless L1 run is not offered the tool, so nothing exists to refuse)
   2 absent   (session:interactive/shell, session:interactive/network -- N=35 declared, no real refusal yet)
$ node .claude/scripts/hq/policy-lint.mjs --evidence    -> exit 3 (the file is law, the cells are BELOW-BAR)
```

Every in-scope cell now reads `N=35`; before the paste each read `no-bar-declared`. The interactive cells will turn
`fresh` on the first real armed-session refusal, and the `process:*` cells stay `unknown` until the engine lane
instruments a headless attempt: both were predicted at kickoff and neither is this cycle's to force.

## Receipts (canonical spine, main clone, 0 quarantined)

`phase.closed` `01M4EHTBQ2SQ38A9FGZZ5T41XY` · `approval.requested` `01M4EHTC6YQM8VJYZEFPP2CMMF` (the stamp is the owner's)
