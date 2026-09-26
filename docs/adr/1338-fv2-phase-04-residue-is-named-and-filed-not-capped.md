# ADR 1338 — Phase 04's residue is named and filed, not capped at three routes

**Status:** accepted
**Date:** 2026-09-18
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** a lane named in `initiatives/face/evidence/phase-04/residue.md` ships the data or the importable parser its row says is missing, and the panel is still NOT SERVED a phase later → the residue has become a parking lot rather than a list of gaps, and the route is served in the next face change that touches its room.
**Provenance:** the owner's ruling on the Phase 04 residue, 2026-09-18, choosing option A of the two put to him after the build measured it: "un recommand A pannu machi". Amends REQ-06's acceptance in `initiatives/face/PLAN.md`; supersedes nothing.

## Context

REQ-06 read: "the union of the 5 `NOT SERVED` lists drops to 0, or to a residue of at most 3 routes, each naming
the lint parser that does not exist yet and the lane it is filed to, and each approved by the owner". The bound of
three carried an assumption the ledger never wrote down: that every route Phase 03 named has an importable parser in
the lane that owns its file, so the residue would be a handful of parser gaps.

Phase 04 measured it. Of 22 route strings and 50 panels, 18 routes and 35 panels are served, each through its lane's
own parser. The residue is 15 panels on 10 routes, and they are not parser gaps of one kind:

- **Data no file or receipt records** -- a venture's base rate, revenue model and price; a verdict per council juror;
  a lane on the spine envelope; what a recall costs; the legal hash chain, which lives in each venture's own repo; the
  money milestones, which are prose in a strategy document. No parser could serve these without inventing them.
- **A parser that exists only inside a lint that exits at import** -- ADR reversibility (`kickoff-lint.mjs`), the
  passports (`board-lint.sh`'s awk), agent frontmatter (`council-lint.mjs`, private), the design studio's counts
  (bash), the egress allowlist (the egress proxy, in Python). Making each importable is surgery on another lane's
  gate, most of them LIVE in their own sessions.

## Options considered

1. **Accept the residue as named and filed** -- every residue panel stays NOT SERVED in the room, with the gap and
   the owning lane written into its own sentence and into `residue.md`; the owner approves the list as a whole.
2. **Refactor the other lanes' lints to be importable** -- reaches perhaps three or four more routes, touches gates in
   LIVE lanes, and still leaves six or seven routes whose data does not exist.
3. **Hold Phase 04 open until the residue is three routes** -- needs other lanes to start recording new data, which
   is their scope, not this cycle's.

## Decision

Option 1, the owner's ruling. REQ-06's acceptance becomes: every route the union named is served read-only,
allow-listed and through its owning lane's parser, OR its panel is a residue row in `residue.md` naming the gap and the
lane it is filed to, and the owner approves the residue as a whole. The count is not capped; it is named.

## Consequences

- `residue.md` is a derived list: `tests/face/module-frame.mjs` holds it equal to the folds both ways, and requires
  every panel Phase 03 named to be either there or in `served.md`, so a residue row can neither vanish nor be invented.
- Each residue panel's sentence says why it is not served and which lane owns the gap, so the owner reads the reason
  in the room, not only in the evidence.
- The gaps are filed to their lanes (engine, ledger, plan, evolve, memory, design, legal, spine); none is face work.
  When a lane closes one, the face serves the route in its next change -- the revisit trigger above holds it to that.
- REQ-06 is validated at `/arc-phase-done 04` against this acceptance, with the residue approval recorded there.
