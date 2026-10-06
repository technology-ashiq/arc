# ADR 1352 — FV2-T: the Org room shows who fills each role, and the owner edits a seat from the face

**Status:** accepted 2026-10-07 by the owner ("ok", after reading the routed change; scope A+B chosen in the org session, "ituhum pananum new req")
**Lane:** face (Cycle 16) · **REQ:** REQ-17 · **Phase:** 13
**Revisit trigger:** a seat edit from the face writes `main` or the owner's checkout; a role card's text outside `seat` and `binds` changes on a seat edit; `binds.tier` is ever typed by a person instead of derived; or a change `org-coverage.mjs` would fail reaches a proposal branch
**Bound by:** ADR-1601 (the role card binds, never replaces an agent file) · ADR-1626 (a process names a role and `arc-run` resolves the seat) · ADR-0069 (model tiers are law) · ADR-1629 (`org-own.mjs`, hire-to-own on one proposal branch) · ADR-1326 (branch-only writes, the work door has no logic of its own) · ADR-1343 (the company ring's ops land proposal branches)

## Context

Every role card `org/roles/<dept>/<id>.role.yaml` already says who sits it: `seat` (`agent`, `script`, `human`,
`process`, `skill`, `partial`, `vacant`), `origin`, and `binds` (`agents`, `skills`, `scripts`, `process`, `tier`).
`board-advisors` binds 12 `council-*` agents; `coo-dispatcher` is `seat: vacant` with empty binds; 24 of 71 cards are
vacant. The face never shows any of it: `face/src/modules/company/org/fold.mjs`'s `RoleRow` carries only
`{id, title, state, seat, origin}`, the View prints "state · seat", and `GET /api/org`
(`.claude/scripts/hq/lib/face/org/route.mjs`) does not pass `binds` through. The only org op is `org.lane-status`.

## Decision

**A — show.** `GET /api/org` passes each role's `binds` through as read from the card. `fold.mjs` maps them to words
under each role: the agents, skills, scripts, process and tier by name; a vacant role reads "no one sits this role";
a staffed seat with empty binds is named as a disagreement, never drawn as filled. Pure decisions stay in `fold.mjs`,
held by its node fixture.

**B — edit.** One new face op, `org.seat-assign`, shaped like `org.lane-status` and `agents.add-agent`: a plan
(`--dry-run`) the owner reads, then apply. It does not get its own script: `org-own.mjs` already rewrites one role
card on a proposal branch off `main` and emits `approval.requested`, with `--dry-run`/`--expect DIGEST`. It gains an
assign mode (`--role ROLE --seat SEAT --agents a,b` with the same pair), so the face shells the same script a hand-run
calls (ADR-1326).

- **What it writes:** only `seat` and `binds` of ONE card; every other line stays byte-identical (the card says "edit
  by hand; `org-catalog --draft` never overwrites"). A history line names the change, as `org-own` does.
- **Where:** a new proposal branch, then one `approval.requested`. Never `main`, never the owner's checkout.
- **`binds.tier` is never typed.** It is derived from the bound agents' own frontmatter, as `org-catalog` and
  `org-own` derive it. Because no person types it, a seat edit is not a tier change under ADR-0069. A derived tier that
  would differ from the card's current tier is shown in the plan and needs the owner's approval like any other change.
- **Refusals, before any file or event**, using the checks `org-coverage.mjs` already fails on in CI: a named agent
  with no `.claude/agents/<name>.md`; a card id duplicated across departments; seat and binds that disagree (a staffed
  seat with empty binds, a vacant seat with binds).

## Options considered

1. **A new `org-seat.mjs`.** Rejected: `org-own.mjs` already has the branch, the card rewrite and the receipt, and a
   second writer of role cards would be a second path to the same file.
2. **Show only (A).** Rejected by the owner: he chose A+B.
3. **Edit `binds.tier` directly from the face.** Rejected: ADR-0069 makes a tier change a reviewed diff citing it;
   deriving it keeps the edit honest.

## Consequences

- `org-own.mjs` is the org lane's file. This PR edits it under org's rules (ADR-1601, ADR-1629) and the PR names it;
  the org lane's session is told in the handoff.
- No new spine kind (ADR-0026): the op emits `approval.requested`, as `org.lane-status` does.
- A new door op is a gate-shaped surface: two fresh attackers (logic and boundary) through `/arc-attack` before the
  push, and the wiki regenerated in the same PR.
