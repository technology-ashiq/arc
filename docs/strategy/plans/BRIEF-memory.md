# BRIEF — memory v1 (playbooks + recall)

> **Trigger (pull):** playbooks/rules outgrow grep (finding a past lesson takes >2 min),
> OR ≥2 workflows need recall in-process. **Prereqs:** spine (decisions/retros as events);
> retro culture already writes rules — this module makes them FINDABLE.

**Goal:** the company's long-term memory — markdown playbooks (git-versioned, human-
readable) indexed by SQLite FTS5, one recall CLI any process can call, and decision
history queryable — so lessons stop being re-learned.

**REQs (measurable):**
1. `playbooks/` format: one rule per entry (id, rule, why, evidence links, date, source-
   retro) — existing retro-log/trial-ledger entries migrated without loss (count-verified).
2. `arc recall <query>` returns ranked rules + past decisions in <1s; FTS index derived
   (delete → rebuild from files+spine → identical results, fixture-proven).
3. In-process hook: kickoff and review load relevant playbook rules for their context
   (path/topic match) — proven by a fixture kickoff that surfaces a planted rule.
4. Decision memory: `decision.recorded` events queryable by pattern ("all rejects with
   reason containing X") — feeds evolve's taste-learning later.
5. Dedup/conflict surfacing: two contradicting rules on the same topic → flagged for
   human merge (never auto-resolved).

**Appetite:** 4 days.
**Phases sketch:** 0 playbook format + migration + FTS index (derived-only) → 1 recall CLI
+ in-process hooks → 2 decision queries + conflict surfacing + retro.

**Non-negotiables/no-gos:** files are truth, index derived (A5) · reader-only spine access
· no embeddings v1 (FTS first; embeddings = pull-trigger: recall precision demonstrably
insufficient, and then via engine drivers) · no auto-rule-writing (rules come from retros/
humans; evolve proposes, human merges) · no knowledge-graph ambitions.

**Pre-mortem top-3:** (1) write-only memory nobody queries → in-process hooks make recall
automatic, not optional; (2) index drifts from files → derived-only + rebuild fixture;
(3) rule sprawl/contradictions → conflict surfacing REQ + retro merge ritual.

**Open decisions at kickoff:** playbook taxonomy (by module vs by theme) · migration scope.

**Kickoff prompt:**
```
/arc-kickoff memory v1 — playbooks + recall
Design source: docs/strategy/plans/BRIEF-memory.md (trigger: recall pain is real).
Expand to full PLAN; files-are-truth + derived-index locked. STOP after PLAN + specs
for my approval.
```
