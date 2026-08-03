# ADR 0310 — v1 operating constants, and the six decisions the design source left open at kickoff

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** the first real client's baseline makes any constant here obviously wrong —
most likely the per-arm floor, which is derived per surface rather than set globally.

## Context

`docs/strategy/plans/PLAN-evolve.md` closes with six decisions left open at kickoff. All six are
two-way doors: config values and field lists, each changeable without invalidating replayed
history, provided the value rides the config hash where a verdict depends on it. Per the kickoff
rules, two-way doors are auto-decided and recorded rather than put to the owner.

They are grouped in one ADR because they are one decision in substance — *what the v1 defaults
are* — and splitting them into six files would make six near-empty records.

## Options considered

1. **Leave them to be chosen during implementation.** Cons: a constant chosen mid-build is a
   constant nobody reviewed, and several of these ride the config hash, so a late change silently
   changes what a verdict means.
2. **Ask the owner for all six.** Cons: they are two-way doors with defensible defaults; the
   kickoff question budget exists for one-way doors.
3. **Decide all six now, with defaults from the design source where it stated one.** Chosen.

## Decision

| # | Open decision | v1 value | Why |
|---|---|---|---|
| 1 | **α** | `0.05` | The design source's stated default. Rides the config hash |
| 2 | **`effect_floor`** | `0` (plain superiority) | Per ADR-0306: floors are derived at 80% power to *detect* MDE, so demanding bound ≥ MDE at that n makes the engine inert. Per-surface override exists, hashed |
| 3 | **Experiment TTL** | `28 days` | Two full weekly windows past the 14-day minimum, so a surface that is merely slow is not killed for being slow. Expiry archives `no-verdict` **with data** |
| 4 | **Concurrency cap** | `2` concurrent experiments per module | The design source's stated default. A cap of 1 serialises unrelated surfaces; higher multiplies interaction risk before any surface has run once |
| 5 | **Cohort split (generation : verdict)** | `50 : 50` | Both cohorts get deterministic assignment. An even split maximises the verdict cohort's power, and the generation cohort is exploratory-only so it does not need parity of precision |
| 6 | **Council outcome receipt kind** | `council.outcome` | `council.verdict` already exists in `KINDS` (0 emitted). The outcome is a distinct later fact and gets its own kind, per ADR-0304's one-kind-per-lifecycle-step rule |

**Guardrail thresholds and directions are per-metric, declared in the module's `evolve.metrics[]`
(ADR-0301), not set globally here.** A global guardrail threshold would be meaningless across
surfaces with different baselines.

**Evidence-table field freeze** — a `promotion.proposed` inbox item carries exactly: proposal id ·
experiment id · surface + target path · both arm tags · n per arm · successes per arm · point
delta · the confidence bound · α · `effect_floor` · MDE · guardrail status · window list with
`MISSING` count · cohort audit result · config hash · `base_sha` · `patch_sha` · `candidate_sha`.
No free-form commentary field: the table is the evidence, and anything not in this list is not
evidence the human is asked to weigh.

**`council.outcome` lands in Phase 4**, which is the designated cut (ADR-0307). If Phase 4 is
cut, the kind is never added — it is deliberately not part of the Phase 0 frozen eight in
ADR-0309.

## Consequences

**Easier.** Every constant a verdict depends on is decided, written and hashed before any code,
so a verdict's meaning is fixed at the moment it is computed. Implementation has no open numbers
to invent.

**Harder.** Six values chosen without a real baseline to calibrate against — the TTL and the
concurrency cap in particular are reasoned defaults, not measured ones. They are two-way and
config-carried, so the correction path is cheap, but the first real client should be expected to
move at least one of them. The per-arm floor is deliberately **not** given a global value here,
because deriving it per surface from a real baseline is the entire point of gate row 4.
