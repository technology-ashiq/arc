# ADR 1353 — FV2-U: the plan-bound guarantee is measured, not assumed

**Status:** accepted 2026-10-07 by the owner ("ok", after reading the routed change: three phases, 14 -> 15 -> 16)
**Lane:** face (Cycle 16) · **REQ:** REQ-18 · **Phase:** 14
**Reversibility:** two-way
**Revisit trigger:** a write verb ships with no `--expect` path and the audit passes it; the allowlist grows by a row with no reason; an allowlisted verb gains a plan path and its row is not removed.
**Bound by:** ADR-1326 (the WORK door has no logic of its own) · ADR-1334 (a flow binds to real receipts) · ADR-0026 (closed spine kinds)

## Context

`core/plan-expect.mjs` holds the plan-digest guarantee: a verb plans, the owner sees a digest, and the apply refuses `PLAN_STALE` when the plan moved (`planDigest`, `staleReason`, `spineRefusal`). Phases 15 and 16 lean on it: `FIELD_UNKNOWN` refuses a plan, and an approval's `bound_to` re-derives one. Nothing today measures that every verb that writes the spine or a tracked file goes through it. A guarantee that holds "for the verbs someone remembered" is an assumption.

## Decision

1. One read-only script, `.claude/scripts/core/plan-bound-audit.mjs`, lists every verb under `.claude/scripts` that writes the spine or a tracked file as `verb · file · writes-to · plan-bound yes/no`.
2. Plan-bound means the write is reachable only after an `--expect` check (or `spineRefusal` / `staleReason`) on the same path. Where the structural read cannot decide, the verdict is `unknown` and it FAILs: a verb is never passed by default.
3. It exits non-zero on any unbound write verb not on `plan-bound-allowlist.json` beside it. Each allowlist row names the verb and a `why` (`arc-event emit` IS the writer). An empty `why` or a row for a verb that no longer exists FAILs.
4. It runs in CI from a bats suite beside `face-coverage`; `.github/` is not edited.
5. It changes no verb. Each unbound verb found becomes its own `/arc-change`, carried on the allowlist until that change lands.

## Options considered

- **A. Measure first (chosen).** Half a day; turns the next two phases' premise into a fact; finds the gaps without fixing them in a hurry.
- **B. Assume and build Phases 15–16 directly.** Saves 0.5d; leaves `FIELD_UNKNOWN` and `bound_to` resting on a guarantee no one has counted.
- **C. Audit and fix in one phase.** Mixes measurement with behaviour change; each fix touches another lane's verb and needs its own owner and attack.

## Consequences

- A new gate in CI: it must pass its own two-surface attack, and its mutants (no `--expect`, empty `why`, write-before-check) FAIL from birth.
- The allowlist is a visible debt list. Its size is the honest count of verbs that can write without a plan the owner saw.
- Phase 15's `FIELD_UNKNOWN` and Phase 16's `bound_to` cite this audit, not the assumption.
