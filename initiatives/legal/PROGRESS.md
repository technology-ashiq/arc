# PROGRESS.md — arc-legal "the policy pack"

status: LIVE
cycle: arc-legal (Cycle 14, opened 2026-08-12)
phase: 00
appetite: 5d
burn: 0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/legal/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **1000–1099**; ADR-1000..1011 are locked there.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — three core pages end to end: schema, render, three lints, hash fixtures, two-surface adversarial pass, text attack panel | 2d | pending |
| 01 | The full set and its receipts — remaining four pages, scenario fixtures, completeness over seven, inbox wiring, hash-chain enforcement | 1.5d | pending |
| 02 | Guards and governance — `--verify`, generated venture CI guard, pins + `--bump-templates`, template-edit approval, checklist renderer (all rows manual — probe automation cut at kickoff) | 0.5d | pending |
| 03 | The real render — LexOS real facts, approval, commit into its tree, integration handoff, evidence bundle, retro | 1d | pending |

## Done-log

_(nothing closed yet — the cycle opens on the owner's approval of this kickoff)_

## Appetite burn

**0d of 5d used.** Phase appetites sum to exactly 5d, so there is **no calendar slack** — the slack
is scope slack, held in the pre-decided cut order (probe automation → `--verify` polish → checklist
renderer) and never taken from the adversarial passes. Kill tripwire at 2.5d if Phase 00 is not
closed.

This figure is **re-derived at every close, never carried forward** — `arc-memory` 2026-08-12 shipped
a tracker reading 55% when the truth was 75%, set before the last phase was built and never
recomputed.

## Now

**Position:** kickoff **APPROVED 2026-08-13** — `decision.recorded` `01KZVM9TR488384Q7CR8P2N271`,
verdict `approve`, verified on the canonical spine and not quarantined. The owner approved in
session and instructed the build to run all four phases without further check-ins, pushing as it
goes and merging only once every phase is closed. Phase 00 is OPEN.

`kickoff-lint` passes with one WARN (zero calendar slack, true and named). The simulation gate ran
twice: 13 blockers → 8, all eight closed in the executor contract, and **round 2's fixes are not
re-verified** because only one respawn is permitted.

**What the kickoff verified rather than assumed:**

- The Build-out Mandate is on the canonical spine — `decision.recorded` **`01KZTM348858PDH44K4HA64CVA`**
  (deciding `01KZTM2DYQXXYHVBJZC462D982`), both read out of
  `E:/Work_Hub/01_Automemory/arc/.claude/state/hq/events/2026-08-12.jsonl`, neither quarantined.
- ADR century **1000–1099** claimed, checked across all sixteen sibling worktrees (highest anywhere
  is 0914).
- **Razorpay's page list is not the six the design source recorded.** The default activation flow
  documents FIVE; a separate, conditional six-item list exists for additional e-commerce sites. The
  built set is the verified superset of SEVEN (ADR-1001), and the "card statement descriptor" claim
  was dropped as unverified.
- **DPDP Rule 3 is NOT in force.** Notice, consent, grievance and SDF duties all commence together
  on 13/14-May-2027; today only Board-institutional provisions are live (ADR-1006).
- **LexOS is not a merchant.** Its own ADR-0003 makes each law firm its own Razorpay merchant, so
  `payment_model` gained a third value `none` before any receipt exists (ADR-1011). It also has zero
  policy pages and no footer at all.

**Open, and owed to the owner before Phase 00 code:** the operator's GST-registration posture
(assumptions ledger row 3). Both branches exist either way, so it blocks Phase 03, not Phase 00.

**Kickoff receipts, emitted from the canonical clone and verified by event id in `events/` with
zero matching entries in `events/_quarantine/`:**

| kind | id |
|---|---|
| `kickoff.done` | `01KZVK87WKTN34N7HPXE8A1A3N` |
| `approval.requested` | `01KZVK8EMVQAE4ZEFB99HKGKBM` |
| `decision.recorded` | `01KZVM9TR488384Q7CR8P2N271` (verdict `approve`, decides the row above) |

**Next step:** Phase 00 slice 1 — the facts schema, the six cross-product fixture ventures, and the
red tests that must STAY red until the render and the lints are built correctly.

**Carried, not resolved:** the operator's GST-registration posture (assumptions ledger row 3).
Fixtures cover both branches, so nothing before Phase 03 depends on the answer; Phase 03 asks it or
renders `gst_registered: false` under the ledger row's trigger.
