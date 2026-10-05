# ADR 1803 — MPP-D: the Settings page stays the face lane's; a profile's cost, "used by" and remove guard are filed there

**Status:** accepted
**Date:** 2026-10-05
**Product:** `model-policy` (a cross-lane boundary with `face`)
**Reversibility:** two-way
**Revisit trigger:** —

## Context

The face lane is building on the same surfaces in parallel. Phase 11 edits a model in place (PR #332, ADR-1350
Amendment 3), and Phase 12 adds a Keys section and makes `generic-api` read its key through a keys store (ADR-1351). Those
change `ModelsPanel.tsx`, `talk.mjs`, `door.mjs`, `arc-dash.mjs`, `models.mjs` and `drivers/generic-api.mjs`. The owner
asked this cycle to work around that session rather than through it (2026-10-05).

The owner's profile also carries an optional cost ("cost if needed"). The store's record schema is closed
(`checkRecord` refuses an unknown field), so a cost field is a change to `models.mjs` and its Settings form. Both are
face files.

## Options considered
1. **This cycle edits the Settings page and the store schema.** Rejected: it collides with three in-flight face phases on
   the same files.
2. **This cycle stays on the engine side and on the read-only model-policy room; Settings work is filed to the face lane.**

## Decision

**Option 2.** This cycle does not modify `ModelsPanel.tsx`, `talk.mjs`, `door.mjs`, `arc-dash.mjs`, `models.mjs` or
`drivers/generic-api.mjs`. It writes `router-row.mjs`, `arc-run.mjs`, `router.yaml` comments, `face/lib/face/reads.mjs`'s
router reader, and the model-policy room's `fold.mjs` and `View.tsx`.

Filed to the face lane as one `/arc-change` prompt, delivered at Phase 01 close:
- **Cost** on a record (optional, per-million-token price). Any receipt use of it is labelled `cost_source: declared`,
  never `measured` (ADR-0069 block b: absent data is never estimated).
- A **"Used by"** column on Settings → Models, listing the router classes and tiers that name each record.
- A **remove guard**: removing a record that `router.yaml` names is refused, naming the rows.

## Consequences

- Phase 00 and 01 merge without touching any file the face session holds open.
- Until the face lane builds the three items, the model-policy room is the only place that shows which class reaches
  which profile. Removing a routed record is caught at run time by ADR-1801's refusal instead of at the Settings page.
