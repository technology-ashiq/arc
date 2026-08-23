# ADR 1316 — FACE-Q: L3 flips to an in-repo `face/`, because a new repo would have no CI

**Status:** accepted
**Date:** 2026-08-23
**Product:** face
**Reversibility:** two-way
**Supersedes:** the placement half of ADR-1300 (FACE-A). L2 `arc dash` in the arc repo
under product `hq` is unchanged; only L3's home moves.
**Revisit trigger:** `.github/workflows/**` becomes writable by this session, **or** an
`arc-face` repo is created with a green three-OS matrix by hand → L3 splits out under
FACE-A's Option 1, which this ADR is deliberately built to allow (see § Keeping the split
cheap).

## Context

ADR-1300 chose Option 1: L3 in its own repo `arc-face`, with an in-repo `face/` directory
recorded as Option 2 and a revisit trigger tied to cross-repo *evidence*. That trigger has
not fired. A different one has, and it is stronger than the one that was written down.

The owner's standing instruction for this cycle is explicit: **"local tests panna venam,
ellame CI la than pannanum"** — nothing is proven on this box; CI is the only gate. That is
not a preference, it is the rule the whole build runs under, and it is the same rule
`.claude/rules/testing.md` states at length.

**This session cannot author `.github/workflows/**`.** Writes to that path are denied, which
is why every gate this lane has added so far — `face-coverage`, `face-sections`, the door
suites — runs through the bats suite instead of through a workflow step. In the arc repo
that is a workable detour, because the arc repo already has a nineteen-job three-OS matrix
that executes `tests/`.

A brand-new `arc-face` repo has no such matrix, and no way for this session to give it one.
L3 would therefore be the one layer of this product with **no gate at all** — the layer with
the most code, the only build step, and the only place a rendering bug can hide. "Complete
all phases" and "everything on CI" cannot both be true through a repo whose CI cannot be
written.

Weighed honestly, FACE-A's stated cons for Option 2 have also shrunk since it was written:

- *"node_modules + a build stack inside the OS repo"* — `.gitignore` already covers
  `node_modules`, and Constitution A2's zero-dep rule binds what the **OS** needs to RUN,
  not what a sibling directory needs to build. Nothing in `.claude/scripts/**` gains a
  dependency.
- *"the sync payload needs permanent exclusions"* — measured, not assumed: `sync-to-project.sh`
  is an **allowlist**. It copies `.claude/`, `docs/templates/`, `docs/playbooks/` and a named
  set of root files. A root `face/` directory is excluded by construction, and the
  byte-identity golden confirms it: 342 rows before this ADR, 342 after.
- *"the zero-dep CI legs need exclusions"* — measured: `ci.yml` never runs `npm install` at
  the repo root. It installs `bats` globally and executes `tests/`. A `face/package.json`
  is invisible to it unless a test reaches for it deliberately.

## Options considered

1. **Create `arc-face` and build L3 there (FACE-A as written)** — pros: the arc repo stays
   free of a build stack; the face can become a public SaaS skin without a split later.
   Cons: **no CI, and no way for this session to add any**, which contradicts the cycle's
   governing rule; a second repo also needs its own review, secrets and branch protection,
   none of which is reachable from here.
2. **In-repo `face/`, split out later** — pros: one CI, one review surface, evidence local,
   and every L3 test runs in the same three-OS matrix that already catches the failures that
   actually bite here (Windows paths, BSD-vs-GNU `sed`, case folding). Cons: the arc repo
   carries a React tree; a split later costs a `git filter-repo` and a redirect.
3. **Build L3 with no tests until a repo exists** — rejected outright. It is the option that
   trades the one thing the owner named as non-negotiable for convenience.

## Decision

**Option 2.** L3 lives at `face/` in the arc repo, with its own `package.json`, its own
Vite build, and its tests driven from `tests/` so they run in the existing matrix.

The reason is narrow and worth stating plainly: **not that in-repo is better, but that the
alternative ships the largest layer of the product ungated.** A gate that cannot exist is
not a gate that warns; it is an absence, and this lane has already spent a commit this week
on what an unwatched-but-currently-correct check looks like (`face-coverage` was validating
5 of 11 inventories, all 164 unread rows correct, invisible precisely because they were
right).

## Keeping the split cheap

FACE-A's Option 1 stays reachable, and this ADR pays a small tax now to keep it that way:

- `face/` imports **nothing** from `.claude/**` at build time. Its only contract with arc is
  HTTP — the L2 door's routes — plus two generated files it reads over that same door
  (`rooms.generated.json` is served by `GET /api/rooms`, never imported from disk).
- `docs/design/system/tokens.css` is **copied into `face/src/`, not symlinked**, by a
  generator with a `--check` drift gate. A symlink would not survive a `filter-repo` split
  and would break the Windows leg besides.
- No arc script may import from `face/**`. The dependency points one way, so the split is a
  directory move plus a CI file, not an untangling.

## Consequences

- The arc repo gains a `face/` tree and a second `package.json`. `node_modules` is ignored;
  the sync payload and the golden are provably unaffected.
- L3 tests run as node probes invoked from bats, the same shape as `tests/face/dash-*.mjs`,
  so they inherit the three-OS matrix without a workflow edit.
- `PROGRESS.md`'s `depends-on: arc-face — L3 build (separate repo…)` is now false and is
  corrected in the same change. Assumptions-ledger row 6 (`/arc-phase-done` accepts
  cross-repo evidence) becomes **NOT APPLICABLE** rather than NOT YET EVALUABLE: there is no
  cross-repo evidence to accept, which is a resolution and not a dodge.
- ADR-1300's naming warning stops being a trap: the worktree `arc-face` and the L3 repo
  `arc-face` can no longer be confused, because the second one is not created.
