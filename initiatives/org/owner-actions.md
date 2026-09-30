# org: what only the owner can do

These are the things this lane cannot do for itself. Each one is here because a rule or an ADR
makes it the owner's.

## 1. Register Nilluvai (ADR-1612), which blocks the Phase 02 pilot and the Phase 03 five days

The kill lines are the owner's numbers. Run this from the main clone (`E:/Work_Hub/01_Automemory/arc`):

```bash
node .claude/scripts/hq/venture-register.mjs --help     # read the flags first
```

Then approve the `ledger.criteria` receipt it raises, in `arc-inbox`. After that, this lane runs
`org-team --init nilluvai`, raises the team's `org.team` approval, and the pilot starts.

## 2. The dispatcher's policy row (ADR-1623), which blocks the Phase 03 scheduler job

`hq.policy.yaml` is in its own `ungrantable_resources`, so no session writes it. Paste this block
immediately after the `"process:day-close-roll":` row. It is the same shape: born at L1, no E2, and
spine writes only.

```yaml
  "process:org-dispatch":
    e2: []
    read: { level: L3 }
    write: { level: L2, roots: [".claude/state/hq/**"] }
    shell: { level: L1 }
    network: { level: L0 }
    message: { level: L0 }
    publish: { level: L0 }
    deploy: { level: L0 }
    spend: { level: L0 }
```

After the row lands, this lane adds, in one commit, `processes/org-dispatch.process.yaml`
(`job_stub: true`), its `expected-set.json` row, and the `hq.jobs.yaml` entry below. They must land
together, because kickoff-lint's birth rule and policy-lint fail if either lands without the other.

```yaml
  - name: org-dispatch
    type: script
    entry: .claude/scripts/org/jobs/org-dispatch.mjs
    budget:
      min: 2
    policy_kind: process:org-dispatch
    cadence: daily@07:00
    enabled: true
    catchup: run
```

Until then the dispatcher runs dry, as `org-dispatch --all` without `--emit`. It prints the
proposals it would make and writes nothing.

## 3. Genesis (ADR-1602)

Do **not** approve `01M3QSK9P0DZJXKR2XSC4PMKHB`. Its digest went stale when skills were bound to
cards. A fresh genesis request over the final catalog is raised at the cycle close.
