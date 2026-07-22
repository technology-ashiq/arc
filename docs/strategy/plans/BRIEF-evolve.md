# BRIEF — evolve v1 (the self-improvement engine)

> **Trigger (pull):** ≥1 venture/module with 4+ weeks of real metrics on the spine.
> **Prereqs:** spine · at least one module with an `evolve:` manifest section worth
> optimizing (growth's title templates are the natural first client) · council calibration
> seed (`council-calibrate.mjs`) exists.

**Goal:** the generalized retro — weekly scoreboards per module from the spine, bounded
champion/challenger experiments on declared surfaces, and **propose-only** promotion diffs
with statistical floors — so every module improves on evidence, and nothing ever changes
silently.

**REQs (measurable):**
1. `evolve:` manifest contract enforced by product-lint (WARN-first): metrics / experiments
   / evals / promote_via — a module without it can't register experiments.
2. Scoreboard: `arc evolve board` renders per-module weekly metrics from the reader only;
   reproducible from replay.
3. Experiment runner: challenger variant tagged in every run event (`process@ver+variant`);
   traffic split bounded (config); **sample floors enforced in code** — no verdict below
   n=<floor>, fixture-proven.
4. Promotion path: winner → a DIFF against the canonical file (process yaml / template),
   posted to the inbox with the evidence table; merge is human-only; loser archived with
   data. **Holdout rule:** verdict evals ≠ generation data, structurally.
5. Auto-rollback: post-promotion watch window; champion metric degrades past threshold →
   auto-revert + `incident.raised` + that experiment class demoted to L1 — fixture-proven.
6. Council calibration wired as the first instance: verdict predictions vs real outcomes →
   juror hit-rates on the board (weight changes = proposed diffs, human-approved).

**Appetite:** 1 week.
**Phases sketch:** 0 contract + lint + scoreboard → 1 experiment tagging + floors (adversarial
pass on floor/rollback enforcement) → 2 promotion diffs + inbox + rollback → 3 first real
experiment (growth titles) run to a verdict + retro.

**Non-negotiables/no-gos:** propose-only, NEVER self-merge (Constitution A6) · never
touches the Constitution (machines may cite, never amend) · floors/thresholds in config,
enforcement in code · no experiments on money-touching surfaces (pricing etc. — forever
out) · no ML/bandit algorithms v1 (fixed split, counted honestly).

**Pre-mortem top-3:** (1) noise-chasing on tiny samples → floors in code + holdouts;
(2) silent prompt drift → diff-only path, generated-file lint; (3) rollback never fires
when needed → fixture proves the trigger path, watch window is config not vibes.

**Open decisions at kickoff:** first experiment surface + floor values + watch window.

**Kickoff prompt:**
```
/arc-kickoff evolve v1 — self-improvement engine
Design source: docs/strategy/plans/BRIEF-evolve.md (trigger: <module> has 4+ weeks of
metrics). Expand to full PLAN; propose-only + floors + rollback are locked non-negotiables.
STOP after PLAN + specs for my approval.
```
