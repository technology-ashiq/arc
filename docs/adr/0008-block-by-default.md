# ADR 0008 — Gates block by default; warn is the opt-in downgrade

**Status:** accepted · 2026-07-09

## Context
Current defaults (`coverageMode:"warn"`, `docsGate:"warn"`, `ARC_REQUIRED_REVIEWS` unset) make the advertised moat advisory out of the box — the gstack-vs-arc analysis flagged this as arc's core contradiction: an enforcement product that doesn't enforce by default.

## Decision
Defaults flip to `block` with required reviews `code,security`. Strictness profiles (`starter`=warn-all / `standard`=block-core / `strict`=block-all) give a sanctioned, visible escape hatch — downgrading is a deliberate profile choice, not a silent default.

## Consequences
+ Out-of-the-box behavior finally matches the pitch; "arc = enforcement" becomes literally true on install.
− Harsher first-run experience — mitigated by the `starter` profile and `/arc-toolcheck` guidance.
− Existing synced projects change behavior on next sync — release notes must flag this loudly (breaking change, version bump).
