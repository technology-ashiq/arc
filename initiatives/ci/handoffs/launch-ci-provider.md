# Handoff -- launch: the venture CI provider follows the one-Linux gate (ci CI-P, ADR-2205)

**Status:** FILED 2026-10-24. Not a ci REQ: launch owns `products/launch/providers/ci/github-actions.mjs`
and merges this on its own lane (non-negotiable: launch's provider changes only via /arc-change on launch).

## Paste into a launch session

```
/arc-change --lane launch Align the venture CI provider (products/launch/providers/ci/github-actions.mjs)
with arc's one-Linux gate (ci ADR-2201/2205): LEGS = ["ubuntu-latest"] (was 3 OS), node-version 24
(was 20), triggers pull_request + push: main, a concurrency group with cancel-in-progress, a draft
skip (if: github.event.pull_request.draft != true), actions pinned by SHA. Update CHECKS, the
commit message ("arc-ci on 1 operating system"), verify()'s required-check list, and the
launch-contract tests that pin the three legs. Ventures already provisioned keep their workflow until
re-scaffolded; say so in the ADR.
```

## Outcome

- (launch's to record)
