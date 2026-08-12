# Phase 06 — Real week

**Goal (one line):** honest operation, not a demo — the cluster ships through the real loop and the
counts are read off the spine.
**Appetite:** 1.25 days of effort across **≥7 elapsed days** — blown appetite = cut scope or kill,
never extend silently.
**Depends on:** phase-04, phase-05

Serves **REQ-09**. The elapsed-time floor is deliberate: a drip cadence compressed into one sitting
is a demo, and the review-fatigue failure this cycle is most exposed to only shows up across real
days.

## Exit criteria (Definition of Done)

1. The cluster drip-publishes at **2–3 per week** through review packs — each one a real approval,
   not a batch rubber-stamp.
2. The weekly ingest ritual runs at least once against a real Search Console export.
3. The unedited-approval counter accumulates and is recorded at its **honest value**. It reaches at
   most 10 of the 20 ADR-1007 requires, so **this cycle cannot earn an L2 promotion by
   construction** — that limit is written into `PROGRESS.md`, not left to be inferred.
4. **Production counts are read from the spine by the closing session itself** — the number of real
   `content.published` and `metric.observed` receipts, located in `events/` and confirmed absent
   from `events/_quarantine/`. Never inferred from CI, fixture counts, or what the plan intended.
5. **Count honesty (ADR-1011):** if the quality gates forced rework past appetite, the cycle closes
   **cluster-complete** — pillar plus ≥5 spokes — and records the honest number with its reason
   beside it, so it reads as a decision rather than a shortfall.
6. ≥1 COMPLETE metric window, **or** the MISSING states shown loudly with the reason. A window that
   is MISSING because the Search Console property was verified nine days ago is a correct result,
   not a failure.
7. The runbook exists: the weekly ritual, in order, including which Pacific-time date range to set
   before exporting.
8. `/arc-retro` runs. Every assumption trigger in the ledger is **adjudicated by running its
   measurement**, not by judgment — a trigger nobody can evaluate is recorded as NOT EVALUABLE, never
   scored green.

## Verification plan

Coarse at kickoff, refined via `/arc-change` when the phase starts: the REQ-09 evidence bundle
carries a full receipt chain per published article — keyword evidence → approved cluster →
draft → review-pack approval → merge → `content.published` — and the spine-read counts in
`PROGRESS.md` are reproduced by re-running the same query at review time.

**The re-verify that closes the cycle:** Phase 05's spec-diff against `PLAN-evolve` REQ-00 is
**run again here**. `validate-leads.mjs` belongs to the leads lane, which may edit it mid-cycle, and
a conformance proof is only true on the day it ran.

## Rabbit holes in this phase

Publishing faster to reach ten · lowering the POV floor because an article is nearly there ·
tuning content off two weeks of near-zero traffic · adding a dashboard · starting the next cluster
before this one's retro · re-reading the A/B arms for a signal that cannot exist at this volume.

## Out of scope for this phase

The second cluster · any evolve work · any promotion of any capability.

## Your-setup / pending

The owner's weekly export and his 2–3 review-pack approvals per week are the cycle's real cadence.
Nothing here compresses them.

## Non-negotiables (verbatim from PLAN)

- **E2 · Human Sovereignty (Tier E, unamendable):** the machine writes branches and drafts; a human merges every publish, every asset swap, every template change. E2 names *"publishing under Ashiq's name"* itself. Enforced in the command by a module-graph parse plus a running mutant — never by convention (ADR-1002).
- **E3 · The Truth Law:** no fabricated numbers, benchmarks, case studies or testimonials; a source link on every claim-of-fact; arc's own results cited only where a receipt exists; simulated always labelled simulated (ADR-1011).
- **A9 · Appetite over estimate:** 10 days is a cap. Blown means cut or kill.
- **A2 · Boring tech before clever tech** — the site choice names the boring alternative it beat (ADR-1004).
- **A5 · One source of truth** — metrics live on the spine as receipts; no metrics database.
- Exactly **two recurring human gates** (ADR-1012). Lints are **negative-only** (ADR-1010).
- Total-preimage idems everywhere · **MISSING ≠ zero** · corrections `supersedes`, never overwrite · no raw URLs or PII on the spine · reader-only spine access · every emit verified in both `events/` and `events/_quarantine/`.
- Official APIs only · **no cold email anywhere in this module** (that is leads', with its own caps and PII law) · no paid ads.
- **Fixture-proven ≠ live-validated** — the tracker records which one each REQ closed as.
- **Shared-organ edits are conflict-checked, never assumed clear:** before any commit touching `KINDS` in `validate.mjs` or `hq.policy.yaml`, run `git log origin/main --oneline -5 -- PATH` — bench, engine and leads are three other LIVE lanes editing these same company organs this week, and `.claude/rules/lanes.md` records two real collisions already. At the merge take the STRONGER version, never the earlier one, and re-derive any measured value (`KINDS.length`) on the merged tree rather than trusting either branch's count.
