# ADR 1326 — FV2-I: the WORK door is two-phase and has no logic of its own; the SESSION door starts `arc-run --driver`

**Status:** accepted
**Date:** 2026-09-16
**Product:** face
**Reversibility:** one-way
**Revisit trigger:** an op's no-second-path fixture cannot be made green because its CLI has no dry-run or no machine-readable output → that op does not ship (read-only badge) and the CLI gap is filed to its owning lane; or the owner asks for merge from the face → a new ADR, never an op.
**Provenance:** `docs/strategy/plans/PLAN-face-v2.md` §3 FV2-I — adjudicated 2026-09-15, LOCKED at the Cycle 16 kickoff. Holds A5 (no second logic path), E2 (forever-human seals) and the git workflow law.

## Context

The owner has asked three times for the face to DO things, not only show them. Cycle 15's
only write path is `POST /api/decide`. A door that runs work is a second write surface; once
receipts exist from it, removing it is not free — hence one-way.

## Options considered

1. **Two-phase door: `POST /api/op/:id/plan` (command line, file diff, ₹ estimate) then `POST /api/op/:id/apply` (runs and streams); each op shells the same script a hand-run calls.**
2. **Door-side implementations of each verb** — a second logic path (A5).
3. **No work door; keep the face read-only + stamp** — the owner's standing ask stays unmet.

## Decision

Option 1. Every op in the server registry calls the same script or emitter a hand-run calls;
a per-op fixture proves there is no second implementation. File-touching ops write to a
`feat/face-*` branch only, show the diff, and stop: `main` is untouchable and merge never
exists in the face. A tool's own guard refuses in its own words and the face renders that
verbatim. The SESSION door starts `arc-run --driver …`, never a harness binary; a session
whose command line names a harness fails the fixture.

## Consequences

- Per-op shipping: an op without a green no-second-path fixture does not ship; its module renders read-only with an honest badge (kill criterion, Block C).
- Every op emits a kind that already exists in `.claude/scripts/hq/lib/validate.mjs`; an op that would need a new kind is out of scope and says so (ADR-1334).
