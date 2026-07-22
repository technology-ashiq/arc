# BRIEF — bench runner (the model market)

> **Trigger (pull):** ≥2 drivers in real use AND they disagree on quality/cost for some
> task class — OR a new model's arrival makes re-evaluation worth a day. **Prereqs:**
> engine v1 (drivers + router.yaml + eval fixtures per process).

**Goal:** `arc engine bench --model X` runs every process's eval fixtures on a candidate
driver/model, scores contract-compliance + quality + cost, and emits a **proposed
router.yaml diff** — so a new model becomes a same-day, receipted upgrade instead of a
migration project.

**REQs (measurable):**
1. Bench run = per-process pass-rate (output-schema + eval assertions), median cost, and
   latency for the candidate — reproducible (same fixtures, same config → same scores).
2. Router proposal: scores → a DIFF against router.yaml (task-class reassignments with
   the evidence table inline) — human merges; bench never edits the live table.
3. Regression guard: benching the CURRENT champion model monthly detects silent provider
   drift (score drop > threshold → needs-you item).
4. Budget honesty: a full bench run's own cost is capped and reported (`run.completed`
   with cost) — benching can't silently burn money.
5. One real event: a genuinely new model benched end-to-end → router diff → merged (or
   rejected with reason) — the full loop evidenced.

**Appetite:** 4 days.
**Phases sketch:** 0 runner over existing fixtures + scoring (deterministic) → 1 router
diff generation + evidence table → 2 champion-drift guard + one real bench + retro.

**Non-negotiables/no-gos:** propose-only (human merges the routing change) · fixtures are
the same eval packs processes already ship (no bench-only fixture forks) · scores from
deterministic checks, not LLM-judges-LLM v1 · no auto-scheduling (human-started until a
scheduler exists) · no public leaderboard ambitions.

**Pre-mortem top-3:** (1) eval fixtures too weak to discriminate → strengthen the
process's own evals first (that value flows back to everything); (2) bench cost surprise
→ REQ-4 cap; (3) scores trusted blindly → diff carries raw evidence, human judgment stays
in the merge.

**Open decisions at kickoff:** score weights (pass-rate vs cost) · drift threshold ·
monthly guard cadence.

**Kickoff prompt:**
```
/arc-kickoff bench runner — the model market
Design source: docs/strategy/plans/BRIEF-bench.md (trigger: <drivers disagree / new model
X>). Expand to full PLAN; propose-only + deterministic scoring locked. STOP after PLAN +
specs for my approval.
```
