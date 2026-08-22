# Phase 06 — Rooms (bespoke panels on the template)

**Goal (one line):** all 32 rooms render real data on the template, with bespoke panels
where the generic zones are not enough — honest states everywhere.
**Appetite:** 5 days
**Depends on:** phase-05

## Exit criteria (Definition of Done)

- [ ] bespoke panels wave 1: Council · Money · Leads · Growth · Engine · Evolve · Board ·
      Spine (registered per room id, inside zones — never a new layout)
- [ ] wave 2: remaining rooms to their coverage-map spec, or explicitly generic (the
      template IS a complete room)
- [ ] honest states first-class everywhere: not instrumented / ABSENT (reason) / MISSING /
      PENDING n/floor / fixture-proven-unexercised / SIMULATED / REHEARSAL / DRILL /
      EXPLORATORY (ADR-1313) — **verified by a fresh agent** that has not seen the
      implementation
- [ ] honesty-classes fixture green: a fixture spine with real + simulated + rehearsal
      rows → no panel sums them, watermark on every non-real value
- [ ] all 32 rooms render real data in a live demo (REQ-06)
- [ ] tests green on CI per job; tracker updated

## Verification plan

One coarse line, refined at phase start via `/arc-change`: fresh-agent honest-states
report + honesty-classes fixture + 32-room live demo evidence.

## Rabbit holes in this phase

Bespoke panels for rooms the generic template already serves · charts for their own sake
· panel-level caches (pre-mortem row 2).

## Out of scope for this phase

Ask arc (Phase 07) · any new L2 endpoint (sanctioned set is closed).

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- One write path, mandatory reason, byte-parity with the CLI (E2, E1, ADR-1302).
- Reader-only over the spine; no second truth in the UI (SPINE-G/ADR-0030, A5, ADR-1301).
- Every number has *Why?* precedents; no invented numbers, ETAs, health emoji (A1, E3).
- Real vs simulated/rehearsal/drill never mixed or summed; MISSING ≠ 0; ABSENT with reason (E3, ADR-1313, ADR-1018, ADR-0416).
- Kinds, gates, lanes, ADR ids verbatim (A5); unknown kinds/profiles render generically — nothing dropped silently (E1, ADR-1306).
- Seals for every forever-human action; no button ever exists for them (E2, ADR-1303, ADR-0069 b1, ADR-0305, ADR-0110, ADR-1203).
- Localhost + token; no PII; escaped serializer (ADR-1312, ADR-0410, LED-C, SPINE-E).
- Design lane law: three theses, blind jury with reference, owner pick + prediction, two critique rounds max (ADR-1308, ADR-0034…0049).
- Every new face lint starts WARN-first in the TRIAL set and earns FAIL through the trial ledger (A1) — `face-coverage` excepted (a validator over the tree, FAIL from birth like policy-lint, ADR-1311).
- The Engine room's unlock-ladder rung indicator reads evidence only — the rung is never a control (E2).
- Tests green on CI per job; two fresh attackers per gate (decision logic + shell/HTTP boundary); attacker prompt carries the lane's fixed-defect list; vacuous-pass rule (assert it RAN before asserting what it printed).
- Zero product-code writes before explicit owner approval of this plan; L3 stack never enters the arc repo (ADR-1300, ADR-1309).
