# ADR 1339 — The flagship six are option A, and every verb in the design works, not six

**Status:** accepted
**Date:** 2026-09-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** Phase 05 reaches its day 5 (burn 9d) without the door and the flagship six green on CI → the
remaining rings' BIG-GAP verbs become named residue rows filed to their lanes (the ADR-1338 pattern), with no
extension; or an owning lane rejects an additive change this ADR allows → that verb becomes a residue row.
**Provenance:** the owner, 2026-09-19, answering PLAN-face-v2 §13 item 4 and widening the scope in the same message:
"A pannu machi, enaku ella products realtime la work aganum machi ... engine la koda check pannen like readonly maari
tha iruku, enaku full working product venum machi". Routed through `/arc-change --lane face`. Amends REQ-07 and REQ-08,
adds REQ-11, and moves Block C's appetite; supersedes nothing.

## Context

PLAN-face-v2 §13 item 4 asked which six ops the work door ships first. The 2026-09-18 read of the proposed six found
four with no CLI or no receipt, and recommended a swapped six (option A). The owner chose A, then said six is not the
point: every room should work, live, and the engine room he opened is read-only.

He is right about today's surface. Of 36 modules, 0 declare an op (`ops.mjs` is empty in all 36) and 31 read their
data once and never again (5 poll every 45 s, `face/src/lib/registry.mjs` `POLL_MS`). The only verb that works is the
inbox stamp.

The day-1 probe (`initiatives/face/evidence/phase-05/cli-probe.md`) measured all 46 verbs §5.2 names against the real
tools: **2 READY · 15 SMALL-GAP · 14 BIG-GAP · 15 SESSION · 0 NEEDS-KIND**. So a full product is possible without a
new spine kind, but not without touching the tools in the lanes that own them. The Phase 05 spec forbade that
("these CLIs belong to other lanes and are never modified from this phase"), and under that rule even option A fails:
four of its six have no plan mode or no receipt as they stand.

## Options considered

1. **Six ops only, as planned** — the door ships A's six; 40 buttons stay absent. Leaves the surface the owner
   rejected.
2. **Every verb, through the owning lanes' tools** — the face builds the door once, then fills every room ring by
   ring; the gaps are closed in the owning lane's own script, additively; sessions go through the session door.
3. **Every verb, with logic in the door** — faster, and breaks ADR-1326 (no second brain): the face would compute
   what the lanes compute.

## Decision

Option 2.

- **The flagship six** are `bench-a-model` · `close month` · `growth publish` · `ledger criteria` · `capture-idea`
  · `develop checkpoint`. The Block C gate binds these six: if they cannot all be made green, the door does not ship.
- **Every work verb ships (31):** the 2 READY and 15 SMALL-GAP verbs, and the 14 BIG-GAP verbs as thin CLIs over
  code the owning lane already has. Phase 05 carries them in ring PRs after the door-plus-six PR, as Phase 03 did.
- **Every session verb ships (15)** through the session door, `arc-run --driver`, in Phase 06.
- **Additive changes in owning lanes are allowed from Phase 05** — a plan/dry-run flag, `--json`, a receipt of an
  existing kind, a thin CLI over the lane's existing library, and a bug the probe found. Each is its own commit; the
  current behaviour is pinned by a fixture BEFORE the change, so "additive" is measured rather than claimed; a LIVE
  lane's file is checked with `git log origin/main -5 -- <path>` first; and no change weakens that lane's own
  non-negotiables.
- **Some verbs are proposals by design, and stay so.** `engine/router.yaml` and `hq.policy.yaml` change only by
  reviewed diff, so driver switch, terminate and cap proposal write a branch, show the diff and raise
  `approval.requested`; the owner's stamp in the inbox completes them. Ops a lane requires a human to run (close
  month, the leads send, growth publish, the legal stamp) apply only on the owner's click — never from Ask, a
  schedule or a replay.
- **The rooms are live (REQ-11):** when the spine or a file a room reads changes, the open room re-reads within 5 s,
  and an op's receipt appears in its room without a reload. No module reads once and stops.

## Consequences

- REQ-07's acceptance becomes every §5.2 work verb; REQ-08's becomes every §5.2 session verb; REQ-11 is added
  (6 active of the 10-REQ cap).
- Block C takes 9 of the 12 days Blocks A and B banked: Phase 05 4d → 10d, Phase 06 2d → 5d. Planned spend is 21d of
  24d (4 spent + 10 + 5 + 2 dogfood). The closed phases' spec appetite lines now record their actual spend, so the
  plan's arithmetic counts each day once.
- Assumptions-ledger row 6 FIRED at the probe: four of the six flagship ops lacked a plan or a receipt as they
  stand. This ADR's additive-change rule is the routing; REQ-07 and the Block C gate were load-bearing on it.
- `note.logged` is ruled an honest receipt for `develop checkpoint`, `design open brief` and `absorb pin source`
  (each is a note that something was captured, not a state change); if a reviewer disagrees, those three become
  residue, never a new kind.
- Work lands in lanes that did not plan it (hq, engine, policy, evolve, bench, absorb, develop, design, core, council,
  ledger, growth, leads, legal, scheduler). The face lane owns the change and its fixtures; the owning lane's tests
  must stay green on the same PR.
