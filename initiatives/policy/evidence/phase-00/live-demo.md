# Phase 00 — live demo and real-system check (policy cycle 2, POL-L)

**Closed 2026-10-07.** Merged as `091675de` (PR #368). The merged tree was verified by `workflow_dispatch` run
**37611397941**, 19/19 jobs green (arc's CI does not run on a push to main, so the merge alone proves nothing).

## Tests (CI, read per job)

- `tests/policy-evidence.bats`: **59 tests**, including invariants (a) and (b), each with a positive control and a named
  mutant that must be killed by assertion (not by a crash). 18 mutants in total.
- Two attack rounds (logic on deepseek-v4-flash + boundary): 36 findings, 29 fixed, 4 rejected with reasons, 3 LOW to the
  debt ledger. Then three CI rounds found what no attacker did: one-line `@test` bodies that bats never gathers, the
  legal sandbox's fixed import closure, a spine-reader-lint exemption, and a FIFO test that needs perl on macOS and
  cannot run on Windows.

## Live demo (the spec's scenario, run in a scratch sandbox with the main clone's scripts)

A sandbox whose policy lowers `process:denied/write` to L0, with a marker driver and its own spine
(`live-demo.txt`, verbatim):

```
$ arc-run --process denied --driver claude-code
arc-run: policy denied denied: process:denied/write is denied by policy (ceiling L0, cap L1)
exit=1 driver-ran=no
$ policy-evidence report (process:denied/write)
n/a       process:denied/write L0 n/a N=none refusal=01M4B0N2DT5B9HP3QQSQFJMN7C success=- audit=-
$ spine refusal receipts
REFUSALS 1 01M4B0N2DT5B9HP3QQSQFJMN7C INCIDENTS-WITH-DENIALS 1
```

- **No side effect**: the driver never started.
- **No `unpoliced` NOTICE**: the sandbox is the governing root, so the gate actually ran.
- **The refusal is attributed** from typed fields only, corroborated by the incident that precedes it (same
  `process@version`, same IST day, typed `denials`). The cell is `n/a` because L0 is the deny itself.

## Real-system check (canonical spine, main clone, after `git pull --ff-only`)

`policy-evidence.mjs check` (`baseline.txt`, verbatim tail):

```
policy-evidence: as-of 2026-10-07 -- 15 subjects, 120 cells, 17 in scope, 17 BELOW-BAR, 0 spine line(s) rejected,
61 day file(s) read from E:\Work_Hub\01_Automemory\arc\.claude\state\hq\events
```

Exactly the reading predicted at kickoff: 17 in-scope cells (shell L1 × 11, network L1 × 6), every one BELOW-BAR,
all `unknown`, because nothing yet writes a typed refusal at L1. 0 lines rejected across 61 day files: the loader's
validate + seal + idem rules accept the whole real spine.
