# Phase 03 — Promotion safety

**Goal (one line):** A winner and a rollback both arrive as evidence on an unbroken four-hop SHA
chain, and the canonical file is provably untouched by the machine at every hop, in both
directions.

**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] **Hop 1 → 2:** diff generated against the sealed `base_sha`; seal moved ⇒ proposal
      impossible; target must be on the `promote_via` allowlist — arbitrary paths refused;
      **two live experiments sealed against the same `base_sha` on the same target** is a
      fixture — whichever proposal reaches hop 3 second, after the first has merged, REFUSES on
      `candidate_sha` mismatch rather than landing against bytes the first already changed
      (REQ-03's concurrency cap is not scoped to distinct files)
- [ ] `promotion.proposed` carries `proposal_id` + `patch_sha` + `base_sha` + `candidate_sha` and
      the frozen evidence table (ADR-0310) into the inbox
- [ ] **Hop 3:** `experiment.promoted` emitted ONLY if the observed merged-file SHA ==
      `candidate_sha`; mismatch → receipt REFUSED with the exact reason
- [ ] **Hop 4:** the watch window runs ONLY while the current file SHA == `candidate_sha`, where
      "current" is read from wherever the target is actually SERVED — for any `promote_via`
      target with a deploy step, a working-tree match with no confirming deploy receipt does not
      start the watch (otherwise the watch passes while watching bytes nobody is running)
- [ ] Post-promotion drift → `incident.raised` + surface FROZEN + **`manual intervention required`**
      carrying expected vs observed SHA and the archived champion reference — and **no machine
      revert patch is generated**
- [ ] Clean-case revert proposal binds `applies_to: candidate_sha` + `restores: champion base_sha`
- [ ] Degradation past threshold (own observation floor met) → incident + class demoted L1 +
      surface frozen + urgent SHA-bound revert diff to the inbox
- [ ] **Canonical target byte-unchanged in every fixture**, forward and backward, until a human
      merge · healthy watch window → zero false positives · human-rejected proposal → champion intact
- [ ] **Negative control per hop:** each SHA check has a fixture proving it can FAIL, not only pass
- [ ] **Adversarial pass by a FRESH agent** on the lineage and watch path
- [ ] tests added & green in CI · live demo run + output checked · tracker updated

**Cut from this phase by ADR-0300:** "first real experiment OPENED on the chosen surface". No
client, no surface, no traffic — recorded as banked, not delivered.

## Verification plan

One coarse line, refined via `/arc-change` when the phase starts: every promotion and rollback
fixture in the design source's fixture manifest goes red before green, and the phase does not
close until each of the four SHA hops has both a passing fixture and a negative control that
proves the hop can refuse.

## Rabbit holes in this phase

Lineage over-engineering — four SHA hops are enough; no merkle trees. Re-arguing machine-revert:
ADR-0305 closed it, and re-opening needs an L2+ surface plus an adopted Constitution plus a new ADR.

## Out of scope for this phase

Council receipts and calibration (Phase 04) · the operational runway, where a real verdict and a
real merge happen — that is calendar-bound and outside this cycle's appetite by design.

## Your-setup / pending

None for the fixture-proven scope. The banked "first real experiment" needs a live venture
surface with traffic, which does not exist.

## Non-negotiables (verbatim from PLAN)

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to promote,
  not to revert (Constitution A6, no exceptions, no carve-outs).
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits live in config; **enforcement lives in code**. A
  FRESH agent that has not seen the implementation runs the adversarial breaking-input pass on
  the manifest validator, every receipt validator, and floor + cohort + seal + lineage + watch
  enforcement — bound to the section that ships each gate, never deferred to the phase close.
- No experiments on money-touching surfaces (pricing, payments, revenue) — permanently refused
  at the contract layer, with a fixture.
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
  replay-identical board, config-hash-carrying verdicts, SHA-bound lineage at every hop. If
  replay cannot re-derive it, it does not count.
- Absent data is `MISSING`, never zero. Corrections supersede, never overwrite. No raw URLs or
  PII on the spine.
- Reader-only spine consumption; standard emitter for every receipt; real and simulated never
  mixed. Zero-dep Node + POSIX.
