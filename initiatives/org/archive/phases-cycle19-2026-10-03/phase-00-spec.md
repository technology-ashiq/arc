# Phase 00 — The route and the roles on screen

**Goal (one line):** the door serves `GET /api/org` from org's own producers, and the org room shows all 71 roles by department.
**Appetite:** 1.25 days
**Depends on:** none
**REQs closed here:** REQ-01, REQ-02

## Scope
- `.claude/scripts/hq/lib/face/org/route.mjs`: `orgBody(repo, root, inject)` returns `{ schema: 1, chart, teams, scorecards }`;
  The route calls `readSpine(ctx.repo, ctx.root)`, never `spineRoot()`; a missing spine refuses `scorecards` (`SPINE_UNAVAILABLE`) with `chart` served; torn/unreadable counts served as `scorecards.spineDamage`; `unattributed` and `conflicts` from `placeAll` served too.
  `apiOrg(ctx, url)` answers through `reads.mjs answer()`, no query, one in-flight computation per repo (ADR-1625).
- arc-dash route table: `{ method: "GET", path: "/api/org", mutates: false, spineEffect: "none" }`; `face/src/lib/door.mjs` gains `"/api/org": read()`.
- `company/org` (a section of the existing room, ADR-1624): `module.mjs` routes add `/api/org`; `fold.mjs` adds a `roles` section (departments → role rows, counts); `View.tsx` renders it below the band map.
- `room-copy.json` "org" sentence/lede name roles as well as lanes; `face-sections` regenerated; `products/hq/manifest.json` lists route.mjs; sync golden + wiki regenerated.

## Exit criteria (Definition of Done)
- [x] `GET /api/org` serves the chart model end-to-end and the room renders 71 roles
- [x] tests added & green on CI (`tests/face/org-door.mjs`, `tests/face/org-fold.mjs`, dash-doors arm)
- [x] live demo run + output checked
- [x] verified against the real system: the route over the main clone's spine
- [x] contract tests: n/a — no external dependency
- [x] `/arc-attack` two surfaces (route/decision logic; door/shell boundary) once on the local commit before push, with the lane fixed-defect list
- [x] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan
- **Test command:** `node tests/face/org-door.mjs && node tests/face/org-fold.mjs` (run by `tests/face-dash.bats` / `tests/face-l3.bats` on CI)
- **Expected failure first:** before the route exists, `org-door.mjs` fails at its import: `ERR_MODULE_NOT_FOUND ... lib/face/org/route.mjs`; before the fold section, `org-fold.mjs` fails `roles section missing: folded.roles is undefined`.; and `org-fold.mjs` fed a refused scorecards payload renders a refusal sentence, never `no evidence` for every seat.
- **Live demo scenario:** `node .claude/scripts/hq/arc-face.mjs` → open Org → under the band map, the served departments and one row per role; counts line `<roles> roles · <staffed> staffed · <partial> partial · <seated-unlegitimised> seated, not yet legitimised · <human> human · <vacant> vacant`, every number from the served `chart.counts`.
- **Real-system check:** `curl` with the session token `/api/org` on the main clone; `chart.counts` equals `org/chart.json` counts.
- **Expected evidence:** CI per-JOB conclusions for the head SHA, the two fixtures' RAN lines, the route's counts line.

## Rabbit holes in this phase
- `spineRoot()` refuses a worktree: the route takes the spine dir the door resolved, never calls it.
- `org-review.mjs` runs `main()` at import? It is guarded; A-01 checks it in the fixture.

## Out of scope for this phase
Scorecard and team sections in the View (Phase 01); the route already serves them.

## Your-setup / pending
None.

## Non-negotiables (verbatim from PLAN)

- Every number the room shows comes from an org producer through `/api/org`; the face counts nothing itself.
- A seat with no placed receipt reads `no evidence`, never 0 or a percentage.
- The route is GET-only, takes no query, writes nothing, and refuses whole on a wrong shape.
- The lane roster and ADR band map in the org room keep working unchanged.
- Tests run on CI, never on this box; a test asserts it RAN before asserting what it printed.
