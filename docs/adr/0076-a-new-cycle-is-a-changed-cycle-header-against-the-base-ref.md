# ADR 0076 — A "new cycle" is a lane whose PROGRESS `cycle:` header differs from the base ref's

**Status:** accepted
**Date:** 2026-10-14
**Product:** `portfolio`
**Reversibility:** two-way
**Revisit trigger:** a cycle opens without changing its `cycle:` header (the check goes blind), or CI's checkout cannot resolve the base ref on any leg

## Context
Cycle 5's two kickoff gates (the kernel freeze, ADR-0077; the debt budget, ADR-0078) must bite on a
NEW cycle's plan and never on a live one: `kickoff-lint` runs on every lane, and refusing a lane that is
already mid-cycle (launch, face) would turn a kickoff rule into a red build for work the rule never
meant to stop. `kickoff-lint.mjs` has no notion of "new cycle" today (survey 2026-10-14: it keys on the
`**Tier:**` line and on `next cycle|parked` phase rows only).

## Options considered
1. **Compare the lane's PROGRESS machine-header `cycle:` value with the same file on a base ref** (default `origin/main`) — deterministic, works at the kickoff moment and on a PR in CI, reads only git.
2. **A `--kickoff` flag passed by the kickoff process** — exact at the kickoff moment, but CI never passes it, so the gate has no merge-time twin at all.
3. **The spine's `kickoff.done` receipts** — emitted AFTER the lint (kickoff step 9), so they cannot say a cycle is new at step 8; the spine is also absent on CI.

## Decision
Option 1. A lane's plan is a **new-cycle plan** when `initiatives/<lane>/PROGRESS.md` on the working tree
has `status: LIVE` and carries a `cycle:` header whose **cycle identity** — the `Cycle <N>` token, or the whole value when it has none — is absent from, or different to, the identity in
`git show <base>:initiatives/<lane>/PROGRESS.md`. A typo fix, an "opened" date amendment or a close to IDLE never makes a cycle new. `--base <ref>` overrides the default `origin/main`.
A base ref that does not resolve is a WARN `[new-cycle-unknown]` naming the ref, and the new-cycle gates
are skipped — never a silent pass, never a guessed answer. Root-mode (no `initiatives/`) is out of scope.

## Consequences
Easier: one detector serves both gates, and a PR that opens a cycle is judged by CI the same way the
kickoff session judged it. Harder: the gate trusts that a new cycle changes its `cycle:` value — every
kickoff in this repo has, and the revisit trigger watches for the one that does not.
