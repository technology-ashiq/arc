# Phase 00 — the auth token path

**Goal (one line):** a committed fixture phase whose blast radius, area and ADR citation are all
known by construction, so a Context Pack assembled over it can be asserted exactly.

Serves **REQ-05**, **REQ-06**. Governed by ADR-0900.

The files this phase touches are `src/auth/alpha.js`, `src/auth/beta.js`, `src/auth/gamma.js`
and `src/auth/delta.js`.

## Exit criteria (Definition of Done)

- [ ] the auth token is verified before the handler runs
- [ ] the token cache is invalidated on logout
- [ ] the four auth files carry a regression test each

## Non-negotiables

- Every retrieval states which source it actually used, including when it fell back to grep.

## Verification plan

bats, over this fixture tree.
