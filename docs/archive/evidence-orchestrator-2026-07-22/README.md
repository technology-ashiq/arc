# Archived evidence — orchestrator initiative (CLOSED 2026-07-22)

These are the sha256-pinned evidence bundles for the **orchestrator (product-monorepo)**
initiative's six phases, moved here when Cycle 2 (Receipt Spine) kicked off and began
writing its own `phase-00..04` bundles into `docs/evidence/`.

Same ADR-0017 archive pattern used for that initiative's `PLAN.md`, `PROGRESS.md`, and
`phases/` specs (`docs/archive/PLAN-2026-07-22.md`, `phases-orchestrator-2026-07-22/`) —
the evidence bundles were the one piece the kickoff instruction did not name, so they moved
here on the same principle once the phase-number collision surfaced.

Each `phase-NN/` holds the bundle exactly as `/arc-phase-done` wrote it: `manifest.json`
(the sha256 index), plus that phase's `scan-verdict.json`, `scan-result.sarif`, `reviews.txt`
/ `test-output.log` / `verification.txt`. The hashes still verify against the files here.

Active initiative's evidence: repo-root `docs/evidence/phase-NN/`.
