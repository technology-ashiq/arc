# Phase 06 — Measured agent quality (cut-line phase)

**Goal (one line):** agent quality stops being vibes — planted-bug corpus scores reviewer/auditor precision+recall per version, and every escaped real bug becomes a permanent eval case.
**Appetite:** 2 weeks. **This is the appetite cut-line** — if the budget is blown before here, this moves to next cycle intact.

## Exit criteria (Definition of Done)

- [ ] **Planted-bug corpus v1**: ≥30 seeded cases across ≥3 categories (injection, authz bypass, N+1/perf, secrets, logic edge-case) in fixture repos under `evals/corpus/`
- [ ] **Eval harness**: runs `code-reviewer` + `security-auditor` + triage agent against the corpus, outputs precision/recall per category to `evals/results/<version>.json`
- [ ] Scores tracked per arc VERSION — regression in catch-rate blocks release (version-gate extension)
- [ ] **retro→eval loop**: `/arc-retro` gains a step — any escaped production bug is reduced to a minimal fixture + added to the corpus (the closed loop: retro feeds evals feeds prompts)
- [ ] Triage agent prompt tuned against eval data (deferred from Phase 2) — measured improvement documented
- [ ] **Pre-registered claim rule** in CHANGELOG: no public catch-rate claim below 30 bugs / 3 categories (pre-mortem #5)
- [ ] CI: eval run on release tags (not every PR — cost control)
- [ ] Live demo: corpus run produces a scorecard; deliberately weaken reviewer prompt → recall drops → release blocked
- [ ] Tracker updated

## Rabbit holes in this phase

- Corpus realism perfectionism → start with OWASP juice-shop-style known patterns + own escaped bugs; realism grows via the retro loop
- Scoring semantics (partial credit, severity weighting) → v1 is binary found/missed per planted bug

## Out of scope for this phase

- Public benchmark publication (Phase 8) · cross-model eval comparison (Phase 7 provides the models, next cycle scores them) · eval-ing qa-tester/design-reviewer (subjective outputs — needs LLM-judge design, next cycle)

## Your-setup / pending

- API budget note: one full eval run ≈ 30+ agent invocations — run on tags only
