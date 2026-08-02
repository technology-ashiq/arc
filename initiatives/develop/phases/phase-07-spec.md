# Phase 07 — Quality intelligence: prior art on decisions, alternatives on risky slices

**Goal (one line):** a real product decision gets prior art with a verdict attached, and a risky
slice gets two or three approaches weighed before code rather than one approach defended after.
**Appetite:** 0.75 days
**Depends on:** phase-00, phase-05

Serves **REQ-09** (pattern mining), **REQ-10** (approach sketches).

**This phase is the pre-decided scope cut.** If the 3.0-day checkpoint fires with Phase 05 not done,
this goes in full and the cycle closes at 06. Its two halves are independent, so a partial cut works
too: sketches (REQ-10) are cheaper and land first.

## What this phase actually builds

- **`.claude/agents/pattern-miner.md`** — decision-triggered, max 3 in parallel, never ambient.
- **Approach sketches** in the slice loop, gated by the same risk globs Phase 03 already computes.

### Pattern mining runs on a declared decision, or not at all

Not "trend research", not a background crawl. It runs when a slice records a genuine
product / UX / architecture / external-API decision. Source hierarchy, in order:

**primary documentation > engineering blogs of the products studied > teardowns > trend commentary.**

External API usage is verified against current docs with versions. Output is a **Pattern Annex** of
≤20 lines on the brief. **Every row carries a source and an adopted-or-rejected verdict — a row
without a verdict is lint-invalid**, because a list of what others do, with no decision attached, is
research theatre that reads as diligence.

### Approach sketches, with economics that are not invented

A risk-glob slice requires 2–3 sketches, ~10 lines each: approach · trade-offs · blast radius ·
economics. One is picked, and the pick is recorded with a `rejected-because` line.

**Economics fields are qualitative or computed, never durations:**

| field | form |
|---|---|
| maintenance burden | in words — "touches 3 call sites, no new pattern" |
| operational surface | **computed counts** — deps, services, config keys added |
| deletion opportunity | what does this let us delete? |

**Invented cost durations are lint-rejected.** "~6 months of maintenance" is the same trap as a
confidence score: it reads as measurement and is a vibe. Long-run economics are earned from the
outcome data Phase 04's ledger accumulates, not guessed at the sketch.

Sketch-level comparison only. Never parallel full implementations — the design source rejected that
outright at 3× cost for marginal gain.

## Exit criteria (Definition of Done)

- [ ] `pattern-miner` runs only on a declared decision; a slice without one gets no annex and no
      agent is spawned — asserted, not assumed
- [ ] a Pattern Annex row missing a source or a verdict is lint-invalid, named by row
- [ ] the annex is capped at 20 lines and the cap is enforced, not requested
- [ ] a risk-glob slice without 2–3 sketches WARNs; a non-risk slice is untouched
- [ ] a sketch carrying an invented duration is lint-rejected; a sketch with computed counts passes
- [ ] the pick is recorded with `rejected-because` for each losing option
- [ ] every new check has a negative control proving it can fail
- [ ] the adversarial pass is run by a fresh agent that has not seen the code; holes pinned
- [ ] tests green on all 3 CI legs · `tree-manifest.txt` regenerated · tracker updated

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats over the annex and
sketch validators against committed fixtures — a valid annex, one missing a verdict, one missing a
source, one over the line cap; a risky slice with sketches, one without, and a sketch carrying
"~6 months" that must be rejected.

## Rabbit holes in this phase

- **Letting the miner browse freely.** Decision-triggered, source hierarchy enforced, ≤20 lines.
- **A cost model.** Counts and words. The moment a duration appears, the lint takes it.
- **Sketching everything.** Risk globs only. Sketches on every slice is the process tax the design
  source ranks as risk #1.
- **Three full implementations to compare.** Explicitly rejected in the design source's §11.

## Out of scope for this phase

- design-critic checkpoints at route/component boundaries — they need a UI target, and this cycle
  has no UI REQ. Carried to the debt ledger with its trigger rather than half-built. **This means
  design-source layer 4 is NOT finished by this cycle** — §13.4 names pattern mining, design-critic
  checkpoints AND full Context Pack retrieval together, and only two of the three ship here. The
  PLAN header states the carve-out; do not let it drift back to "layer 4 done".
- The suggestion engine, the calibration record, the outcome metrics and the tag vocabulary. **They
  are not this phase's to cut: they have no REQ anywhere in this cycle.** Phase 04's out-of-scope
  list said they land here; this list said they go with Phase 04. Both were wrong and the effect was
  that nobody owned them — they are now named in the PLAN header as open against the design source.

## Your-setup / pending

Nothing.

**Tripwire:** this phase IS the cycle's cut target. If it starts with under 1.0 day left, ship
approach sketches only and record pattern mining as debt with its trigger.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion — this cycle builds the promotion machinery and is bound by it.
- Nothing is installed from the internet without a pinned version, a hash, recorded provenance and a content scan; a write-capable capability additionally needs Ashiq's recorded OK.
- A learning candidate is never graded by the context that authored it.
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in any ledger row is a lint finding.
- Any gate, lint or parser this cycle ships gets an adversarial construct-a-breaking-input pass run by a FRESH agent that has not seen the implementation, with every hole pinned as a fixture.
- Every retrieval states which source it actually used, including when it fell back to grep.
