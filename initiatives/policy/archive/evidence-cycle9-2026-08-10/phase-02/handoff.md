# Phase 02 — handoff

## What Phase 02 delivered

| Piece | Where |
|---|---|
| Four authority receipts, vocabulary 40 → 44 | ADR-0508 · `lib/validate-policy.mjs` · wired into `validate.mjs` |
| The emitter branch that makes them writable | `arc-event.mjs` — derives `policyIdem`, **refuses a caller-supplied `--idem`** |
| Promotion chain: request → decide → apply | `lib/policy/promotion.mjs`, decided through `arc-inbox` and nothing else |
| Automatic demotion on an overreach | `lib/policy/incident.mjs`, called from `policy-hook.mjs` |
| Interactive enforcement, both ADR-0501 layers | `.claude/hooks/PreToolUse.d/40-policy.sh` + `policy-hook.mjs` + 24 static `permissions.deny` entries |
| Brief and inbox rendering | `arc-brief.mjs` groups + `arc-inbox.mjs` promotion detail line |

## The one-way door

**A spine kind is permanent once emitted.** ADR-0508 has no revisit trigger that removes a kind —
the receipts referencing it outlive any decision to stop using it, and ADR-0026's closure is what
makes "the vocabulary is closed" a checkable claim rather than a habit. A **fifth** policy kind is
a new ADR, and the bar is a genuinely distinct truth source, not a variant of an existing fact.

## What the next phase inherits

- **The hook is armed by `ARC_POLICY_HOOK=1` and is inert without it.** That is deliberate:
  installing it live blocked the session that wrote it, on its own chaining rule, inside one
  command. Turning it on for real is a decision with a blast radius, not a default.
- **`arc-brief` is 22 kinds behind the closed vocabulary** — `develop.*`, `slice.*`,
  `experiment.*` and the leads pipeline all land in the `ungrouped` catch-all. Naming their
  groups belongs to those lanes, not this one.
- **`arc-event` now has four idem families** (leads, experiment, policy, default). A fifth kind
  family will need its own branch, and the failure mode when it does not have one is silent:
  every receipt rejected and quarantined while the emitter exits 0.
- **Phase 03's birth rule is still open.** Every pair is born at L1; nothing inventories which
  pairs exist. Phase 02 deliberately did not guess.

## Nothing needed from the owner

No keys, no accounts, no infrastructure. Arming the hook (`ARC_POLICY_HOOK=1`) is the only
outstanding operational choice, and it is intentionally left to a moment when someone is watching.
