# Phase 02 — Evidence-traced scoring, council on the finalists, evolve's feed

**Goal (one line):** every cluster gets a reproducible, evidence-cited score from `score.yaml`, the top-2 each get a council verdict on the fixed 90-day question, and evolve can read the verdict–outcome pair without a line of evolve or council code changing.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-01
**REQs closed here:** REQ-03, REQ-04, REQ-08
**Gated by:** the owner's port-vs-build ruling, if the Phase 00 audit memo found scoring (ADR-1908).

## Scope

- `products/discover/score.yaml` (4 weights, owner-owned per ADR-1903) + `.claude/scripts/discover/lib/score.mjs`; weights ported from the audit memo where the owner ruled port; the `ABSENT` renormalisation rule named in the score row.
- `money_signal.estimate_minor` computed here as an integer (consumed by REQ-09 in Phase 03).
- The candidate slug fixed at cluster time (owner niche + 6-hex `cluster_fp` suffix) and carried into the council question.
- Council wiring: top-2 → `council-juror.mjs` sessions with the fixed question form (ADR-1910); seats by ADR-0069 tier, skeptic present, verifier = `independent-family-verifier`; N = 0 / N = 1 / all-rejected paths.
- Reader test: discover `council.verdict` ↔ `council.outcome` by `session_id`, scored by `council-calibrate.mjs`; never-launched verdicts stay `unresolved` and are excluded.

## Exit criteria (Definition of Done)

- [ ] REQ-03, REQ-04, REQ-08 acceptance as written in PLAN, on CI per JOB; the two verdicts found by id in `events/` from the main clone
- [ ] `/arc-attack` two surfaces; closed through `/arc-phase-done 02` from the MAIN clone right after the merge

## Verification plan

- Coarse: CI bats `tests/discover-score.bats` · `tests/discover-council.bats` (fake juror), then two live verdicts from the main clone. Refined at phase start via `/arc-change`.

## Rabbit holes in this phase

- Weight perfectionism: ship the memo's or the design source's weights and tune on REQ-07's real hunt.

## Out of scope for this phase

- exporter, inbox gate, real hunt

## Non-negotiables (verbatim from PLAN)

- Miner, normalizer, clusterer and exporter are parser-class: hostile web text must never reach a shell, an eval or the yaml, proven by injection fixtures in BOTH the clusterer and the exporter (twin-fix rule).
- The `venture.yaml` is written by a serializer, never string-built, and carries exactly the LAU-J fields (ADR-1905).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/discover/fixed-defects.md`; the author is never the attacker.
- Deterministic pipeline: the same snapshot gives identical clusters, scores, order and yaml bytes on all 3 OS legs against a committed golden hash; no float, locale sort, CRLF, wall-clock or absolute path in any hashed output.
- Evidence links are preserved end to end: a score without clickable sources is invalid, and a `venture.yaml` without a linked `.hunt.md` is invalid.
- Zero new spine kinds and no edit to any council payload; reads go through the spine reader only (ADR-1906, ADR-1910).
- growth's adapter and launch's contract are imported, never copied or edited (ADR-1901, ADR-1912).
- Zero npm deps; central `tests/`; tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
- Model tiers are named by ADR-0069 tier names; no quiet `model:` edits.
