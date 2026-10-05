# Handoff → growth: keep four HN fields on each candidate (ADR-1911)

Paste the block below into the growth lane's session. discover imports growth's adapter and never edits it (ADR-1901), so this widening is growth's change, merged in growth's own PR.

```
/arc-change --lane growth keep four Algolia hit fields on each HN candidate, additive only

`hnAlgoliaAdapter` in .claude/scripts/growth/lib/adapters.mjs keeps only {title, objectID, query} per hit.
The discover lane (ADR-1911) imports this adapter and needs, when present on the hit: points, num_comments,
created_at_i, story_text. Change: carry those four through to the candidate unchanged (absent stays absent,
never 0 or ""). Every existing growth consumer ignores unknown keys, so behaviour does not change; add one
growth bats arm that a recorded hit with the four fields yields a candidate carrying them, and one that a hit
without them yields a candidate without them. No other change to the adapter.
```

**Deadline:** Phase 01 day 1 (A-02). Merge check: `git log origin/main --oneline -- .claude/scripts/growth/lib/adapters.mjs` shows a commit after 2026-10-06 adding those keys. Not merged by then → discover locks the ADR-1911 fallback for the whole cycle.
