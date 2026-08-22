# ADR 1300 — FACE-A: L2 `arc dash` lives in the arc repo; L3 the face lives in its own repo `arc-face`

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** `/arc-phase-done` or `arc-evidence.sh` refuses foreign-repo evidence (repo + SHA + CI run id hashed into the lane's bundle) → FACE-A flips to an in-repo `face/` directory with its own `package.json`, excluded from the sync payload and the zero-dep CI legs (assumptions ledger row 6).

## Context

First ADR of the century **1300–1399**, claimed at the birth of lane `face` — checked
across all 18 sibling worktrees on 2026-08-19, none holds an ADR ≥1300. The lane is born
under the owner's **Build-out Mandate** (2026-08-09), the same `decision.recorded`
**`01KZTM348858PDH44K4HA64CVA`** the ledger and executor birth-ADRs cite (A8's letter
kept). Design source: `docs/strategy/plans/PLAN-face.md` v1.0, landed by the owner
2026-08-18. It supersedes `BRIEF-dashboard.md`, already archived at
`docs/archive/BRIEF-dashboard.md` — never recreate it. The consumer this lane unblocks is
`BRIEF-chat-mcp.md` (sleeping): the face fires its trigger, and chat-mcp is the same L2
reader + the same decision path exposed as MCP tools.

The face is three layers (ADR-1301). Where does each live? Constitution A2 keeps the OS
repo zero-dep; the L3 app is React+TS+Vite (ADR-1309) — a stack the arc repo must never
carry ("L3 stack never enters the arc repo" is a kickoff non-negotiable).

## Options considered

1. **L3 in its own repo `arc-face`, root-mode arc install** — pros: arc repo stays
   zero-dep; the face is a product that may become the public SaaS skin; a consumer-repo
   precedent exists (ventures, ADR-0059). Cons: arc's first cross-repo product — lane
   evidence must reference foreign-repo proof.
2. **In-repo `face/` dir with its own `package.json`** — pros: one tree, one CI, evidence
   local. Cons: node_modules + a build stack inside the OS repo; sync payload and zero-dep
   CI legs need permanent exclusions.

## Decision

Option 1. L2 `arc dash` in the arc repo under product `hq`; **L3 in its own repo
`arc-face`** with a root-mode arc install (its own root `PLAN.md`/`PROGRESS.md`, like a
consumer repo). The arc lane `face` (`initiatives/face/`) tracks the arc-side work (L2,
`face:` schema, coverage lint, the design phases) and carries `depends-on: arc-face — L3
build` in its machine header. The board shows the lane row only — no new board section, no
passport (passports are ventures, ADR-0059). **Cross-repo evidence contract:** an L3 phase
enters the arc lane's phase-close bundle as *repo + commit SHA + CI run id*, hashed into
the bundle manifest — if the DoD gate refuses that, the revisit trigger fires.

## Consequences

Easier: the OS repo stays zero-dep forever; the face can grow toward FACE-O (SaaS skin)
without touching arc. Harder: two repos to keep in step; phase evidence crosses a repo
boundary for the first time (watched by assumptions row 6); the L3 repo must be created at
Phase 04 entry (block B), not before owner approval.
