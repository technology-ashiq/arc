# ADR 2015 — REQ-09's protection binds admins and requires checks, not reviews; the merge row is corrected

**Status:** accepted
**Date:** 2026-10-07
**Product:** `distribute`
**Reversibility:** one-way
**Revisit trigger:** the owner revokes the 2026-07-31 grant under which the session merges on green per-job CI. `required_approving_review_count` then becomes 1, and the merge row reads "required checks + owner approval".

## Context

The design source's merge row reads "Required checks + **owner's click** (E2: the machine never merges)". CONSTITUTION E2 lists moving money, killing a venture, changing prices, unlocking real-money trading, and publishing under the owner's name. It does not list merges. Since 2026-07-31 the session pushes `feat/*` and merges via `gh pr merge` on green per-job CI under an owner grant. That merge runs with the owner's own token, which is an **admin** token on a user-owned repo. On a protected branch without "include administrators", an admin's merge skips required checks. So REQ-09 as written would bind every actor except the one who actually merges. Baseline read 2026-10-07: `gh api …/branches/main/protection` → `404 Branch not protected`; `…/rulesets` → `[]`; the repo is public (branch protection is available on the free plan).

## Options considered

1. **Required checks + required review (1)** — a solo repo cannot merge without the owner bypassing as admin, which disables the very rule it sets.
2. **Required checks, `enforce_admins: true`, no required review** — every merge, the session's and the owner's alike, waits for green checks.

## Decision

Option 2. The REQ-09 settings the owner flips in Phase 01:

- required status checks (`strict: true`), naming the CI check-runs that carry the gates (enumerated in P01 from `gh api repos/technology-ashiq/arc/commits/<sha>/check-runs`)
- `enforce_admins: true`
- `allow_force_pushes: false`
- `allow_deletions: false`
- `required_pull_request_reviews: null`

Direct push to `main` is refused for everyone, because a required check can only pass on a PR head. The merge row of `engine/enforcement.yaml` reads "required checks green on the PR head; merged by the session under the standing grant or by the owner — **truth**".

## Consequences

Once `enforce_admins` is on, a red `main` blocks every merge, including fixes. Required checks must therefore start green. P01 enables protection only on a `main` whose per-job dispatch run is green (`arc-ci-never-runs-on-main-push`). A flaky required job (the macOS face-smoke unmount flake) now blocks merges until it is rerun, and that cost is accepted and recorded.
