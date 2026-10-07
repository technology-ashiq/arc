# Phase 00 live demo -- run output, not a description

Verification plan from `phases/phase-00-spec.md`, steps 1-9, executed 2026-08-06 against the
committed tree. Tests: CI run 31108185564, 19/19 jobs green on ubuntu 18/20/22, macOS and
Windows.

```
=== STEP 1  lint the committed file ===
policy-lint: C:\Users\ashiq\orca\workspaces\arc\arc-policy\hq.policy.yaml is law -- 0 violations
  action kind                 read     write    shell    network  message  publish  deploy   spend    
  session:interactive         L1       L1       L1       L1       L0       L0       L0       L0       
  process:kickoff-plan        L1       L1       L1       L0       L0       L0       L0       L0       
  process:review-diff         L1       L0       L1       L0       L0       L0       L0       L0       
  process:commit-msg-draft    L1       L0       L1       L0       L0       L0       L0       L0       
  (effective at birth: every cap starts at L1, so nothing above L1 executes yet)
exit=0

=== STEP 2  a capability granted L4 ===
policy-lint: tests/fixtures/policy/hostile/17-level-l4.yaml is NOT law -- 1 violation(s)
  - kinds["session:interactive"].read.level "L4" is not one of L0|L1|L2|L3 -- L4 is a parse error
exit=2

=== STEP 3  a kind with no e2 line ===
policy-lint: tests/fixtures/policy/hostile/13-missing-e2.yaml is NOT law -- 1 violation(s)
  - kinds["session:interactive"].e2 is missing or not a list -- it is mandatory, because silence is not consent

=== STEP 4  e2 names an E2 action while holding L2 ===
  - kinds["session:interactive"].write is L2 but the kind declares E2 actions ["killing a venture"] -- a non-empty e2 caps EVERY capability at L1 (blanket, not per-item)
  - kinds["session:interactive"].shell is L2 but the kind declares E2 actions ["killing a venture"] -- a non-empty e2 caps EVERY capability at L1 (blanket, not per-item)

=== STEP 5  the constitution pin no longer matches ===
policy-lint: tests/fixtures/policy/hostile/21-constitution-hash-mismatch.yaml is NOT law -- 1 violation(s)
  - E2: CONSTITUTION.md sha256 is 233a64961dc0a028ceca6b113405ead699f9185b39342924c32c05f9786b6ee6 but hq.policy.yaml pins 0000000000000000000000000000000000000000000000000000000000000000. Either the Constitution changed without a new constitution.adopted receipt, or the checkout rewrote its bytes -- check .gitattributes still pins it to LF before assuming the text changed.

STEP 6  born at L1, empty event stream
  authorizeAction(write, "tmp/x")
    -> propose (L1)  session:interactive/write is at L1 -- prepare and record it, never execute it

STEP 7  the same call against demo-events.jsonl
  authorizeAction(write, "tmp/x")
    -> execute (L2)  session:interactive/write authorized at L2
  authorizeAction(write, ".claude/settings.json")
    -> deny (L0)  .claude/settings.json resolves to the un-grantable resource .claude/settings.json -- excluded from every write and file-mutating shell grant regardless of ceiling or cap (ADR-0502)

STEP 8  ADR-0507 in two commands
  authorizeAction(shell, "node -e ...")
    -> deny (L0)  session:interactive/shell is capped at L0 by ADR-0507: its allowlist reproduces a capability granted no higher
  the same, allowlist narrowed to ["bats"]
    -> execute (L2)  session:interactive/shell authorized at L2

policy_hash of the demo file: 5ee43d8f44b5b437217d82e6b7f46fd058f4e237d6e701da5ac8f8b213fff862

=== STEP 9  the matrix ===
policy-matrix: 63 rows across 4 declared server(s) + built-ins -> initiatives/policy/evidence/phase-00/hook-matrix.json
  intercepted  Bash  [shell]
```
