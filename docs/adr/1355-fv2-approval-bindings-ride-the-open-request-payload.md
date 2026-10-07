# ADR 1355 — FV2-W: an approval carries `bound_to`, `depends_on` and `decision_key` on its open payload

**Status:** accepted 2026-10-07 by the owner ("ok", after reading the routed change: three phases, 14 -> 15 -> 16)
**Lane:** face (Cycle 16) · **REQ:** REQ-20 · **Phase:** 16
**Reversibility:** one-way
**Revisit trigger:** (one-way because an `approval.requested` carrying the fields stays in the append-only spine, so the profile can only grow) the inbox re-derive writes any file, lock or event; a STALE state is ever recorded as an event; two `decision.recorded` exist for one `decision_key`; `decision.recorded` gains a field.
**Bound by:** ADR-0026 (closed spine kinds) · ADR-0030 / SPINE-G (the inbox is a reader-only fold) · ADR-1916 (new data rides the open `approval.requested` payload, not `decision.recorded`) · ADR-1305 (Tape as-of replay) · ADR-1353 (the plan-bound audit) · ADR-1354 (`unknown`)

## Context

`decision.recorded` already refuses a second decision on one request, and `plan-expect` already refuses a stale apply. The inbox sees neither. A child of a rejected parent lists OPEN; one decision raised by two lanes lists twice; an approve whose plan moved looks approved until the apply answers `PLAN_STALE`. The owner reads the inbox as the truth, and it is not.

## Decision

1. No new kind. `decision.recorded` stays `decides · verdict · reason`. Three optional fields ride `approval.requested`, validated as a profile in `validate.mjs`:
   - **`bound_to: { kind: "plan-expect", expect: "<64hex>" }`** — `arc-inbox inbox` re-derives the plan dry-run (the `spineRefusal` pattern, zero side effects) and shows `STALE(plan-moved)` on a mismatch; `approve` refuses `PLAN_STALE`; the decided view shows `approved · stale · re-plan needed` for an approved request whose plan moved.
   - **`depends_on: [<approval.requested ULID>...]`** — at most 8, no self, no cycle, each a request ULID. Parent open → `WAITING(<ulid>)`, approve refuses `PARENT_OPEN`; parent rejected → `STALE(parent-rejected)`, approve refuses `PARENT_REJECTED`; parent approved → OPEN.
   - **`decision_key: "<lane>:<subject>:<stable-id>"`** — exact, never normalised. A second OPEN request with the key is `DUPLICATE_OF <earlier>`; deciding either resolves both in the fold, with one `decision.recorded`.
2. Every state is derived from the spine at read time. Nothing is stored outside it; a wiped derived index rebuilds byte-identically; Tape replay reproduces WAITING and STALE.
3. The inbox line ends in its state; OPEN only by default, `--all` for every state.
4. The face Inbox room renders the same fold as badges. It never folds a second time, and an unevaluable binding is ADR-1354's `unknown`.
5. Sub-order: `bound_to` first (highest owner value), then `depends_on`, then `decision_key`.

## Options considered

- **A. Optional fields on the open request payload (chosen).** No kind, no change to the closed decision, the ADR-1916 precedent.
- **B. A new `approval.bound` kind.** Cleaner to read, but breaks zero-new-kinds (ADR-0026, ORG-C, LAU-H).
- **C. Record STALE as an auto-reject.** Writes decisions the owner never made; refused.

## Consequences

- `validate.mjs` is a shared organ: its recent history is read before the edit, and a profile change there is reviewed by the lanes that emit `approval.requested`.
- Every lane that raises a request may opt into the fields; none must.
- A wall-clock `expires_at` stays out; time-based staleness would need its own decision.
