# ADR 0500 — POL-K: lane `policy`, ADR century 0500, and the policy library lives in `hq`

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** a consumer outside `hq` and `engine` needs the policy library, **or** a
repo that deliberately runs without policy shows a measured cost from hq carrying it. Either
one reopens the separate-product option — the move is a file relocation plus import rewrite,
not a data migration.

## Context

`docs/strategy/plans/PLAN-policy.md` locked POL-A..POL-J and deliberately left **POL-K** open
until kickoff: the lane name, the ADR century, and the code home. The design source recorded a
lean toward a separate `products/policy` "for dependency cleanliness: engine consumes the
policy library", and marked that lean **opinion only**. `docs/strategy/arc-full-architecture.md`
places the policy engine inside `hq`. The two are in tension, and every phase's file paths,
imports and manifest hang off the answer, so it is decided once, here, before Phase 0.

Two constraints are not negotiable and they do most of the deciding:

1. The **closed `KINDS` array lives in `hq`** (`.claude/scripts/hq/lib/validate.mjs`). POL-E's
   four new event kinds must be validated beside it, exactly as `validate-experiment.mjs`
   (ADR-0309) and `validate-leads.mjs` (ADR-0400) already are. No option moves that.
2. The policy library has **two consumers with different homes**: the `arc-run` wrapper
   (`.claude/scripts/engine/arc-run.mjs`, product `engine`) and the PreToolUse hooks
   (`.claude/hooks/`, product `core`/`hq`). POL-D forbids two implementations.

## Options considered

1. **A — everything inside `hq`**: library at `.claude/scripts/hq/lib/policy/`, validator at
   `.claude/scripts/hq/lib/validate-policy.mjs`. Pros: matches the existing validator
   precedent exactly; no new product; `engine` already declares `requires: ["core","hq"]`, so
   every repo that can run `arc-run` already has the library. Cons: `hq` grows; the
   architecture doc's "policy engine in hq" placement wins over the design source's lean.
2. **B — full separate product `products/policy`, validator included**: cleanest dependency
   story on paper. Cons: **not achievable** — the validator has to sit beside the closed
   `KINDS` array in `hq`, so B is really C wearing B's name.
3. **C — split: validator in `hq`, library in `products/policy` requiring `["core","hq"]`**:
   the design source's stated lean. Pros: the dependency arrow points the way the lean wants.
   Cons: the library becomes an **optional install**. `products/engine` would have to add
   `policy` to its `requires`, or `arc-run` has to tolerate the library being absent — and
   "policy not installed" then means "unpoliced", which is an install-time fail-open of
   exactly the class this whole build exists to remove.

## Decision

**Lane `policy`. ADR century `0500-0599`. The policy library lives in `hq`** at
`.claude/scripts/hq/lib/policy/`, with the four POL-E event validators at
`.claude/scripts/hq/lib/validate-policy.mjs`. **No `products/policy` is created this cycle.**

The one reason that carried the most weight: **an optional policy engine is a fail-open at
install time.** `hq` is the mandatory organ both consumers already depend on; putting the
library there means there is no reachable configuration in which `arc-run` exists and the
policy library does not. Dependency-graph tidiness is a real good, but it loses to fail-closed
on a build whose entire premise is that enforcement must not have an off switch.

**Evidence:** `products/engine/manifest.json` → `requires: ["core","hq"]`;
`products/hq/manifest.json` → `requires: ["core"]`; `.claude/scripts/hq/lib/validate.mjs:8-9`
imports `validate-experiment.mjs` and `validate-leads.mjs` (the precedent this follows). ADR
century occupancy derived from `docs/adr/` filenames: `00`×73, `01`×12, `02`×7, `03`×12,
`04`×15, and `05` empty — `0500-0599` is free on every ref.
**Confidence:** high — all four facts are derived from files in this tree, not recalled.
**Rejected because:** B — the validator cannot leave `hq`, so the option does not exist as
stated. C — makes enforcement an optional install, which is the failure class the build exists
to close.

## Consequences

Easier: Phase 0 starts with no manifest work and no cross-product import; `arc-run` and the
hooks import the same module by relative path; `/arc-toolcheck` and the sync path need no
change. Harder: `hq` now carries a subsystem some repos will never invoke, and the
architecture doc's placement becomes load-bearing rather than descriptive — if the separate
product is ever wanted, `products/engine` must gain a hard `requires` on it in the same change,
never a soft one. Revisited if the trigger above fires.
