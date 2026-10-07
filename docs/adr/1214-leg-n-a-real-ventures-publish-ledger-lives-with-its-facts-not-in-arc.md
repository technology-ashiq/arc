# ADR 1214 — LEG-N: a real venture's publish ledger lives with its facts, not in arc

**Status:** accepted
**Date:** 2026-10-07
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** a second consumer needs to read a venture's publish history from inside arc
(a cross-venture report, the face) — then arc gets a READ path into the venture's ledger, never a
copy of it.

## Context

`publish` records every publish in a ledger that `NON_MONOTONIC`, `PREVIOUS_MOVED` and the
re-publish semantic diff all read. Row 23 of the lane's defect list moved that ledger off a
caller-chosen directory and into `products/legal/published/<venture>.json`, committed with the
product, so a fresh clone could not walk a backwards effective date past it.

That fixed monotonicity for the fixtures. It breaks for a real venture, which was never rendered
before 2026-10-07:

- **arc is a PUBLIC repository.** The ledger record carries the run, and since PR #341 the run carries
  `facts_fields`: one sha256 per facts field a page prints. That includes the operator's legal name,
  phone, email and address.
- **A printed field is not public until the page is live.** Between approval and deploy — and LexOS
  is PAUSED, so that window is open-ended — a public, unsalted digest of a low-entropy value is a
  guess-and-confirm oracle. This is the `fingerprint-is-an-oracle` class (defect row 36). Its fix
  folded the UNprinted fields and left the printed ones exposed, on the assumption that the page
  shows them anyway.
- **ADR-1205 already says it.** Facts, pages, pins and receipts are venture-local, and REQ-08 asks for
  "pages + pins + receipts committed into the LexOS working tree". Only the ledger had stayed behind
  in arc.

Found while preparing the LexOS Phase 03 publish. Nothing had been published for a real venture,
so no record has leaked.

## Options considered

1. **Keep the ledger in arc, salt the prints.** The digests stop being an oracle. But the salt then
   lives outside the repo, so a fresh clone cannot recompute a diff, and the record still names a
   real venture's publish history in a public repo.
2. **Keep the ledger in arc, drop `facts_fields` for real ventures.** The re-publish diff can no
   longer name the field that moved, and that diff is REQ-06's whole point.
3. **A venture rendered from `--venture-dir` keeps its ledger in that directory**, at
   `<venture-dir>/published.json`, beside the facts it was rendered from. Fixtures keep theirs under
   `products/legal/published/`, where the suites expect it.

## Decision

**Option 3.** The ledger follows the facts. When the facts come from `--venture-dir` (or
`ARC_LEGAL_VENTURE_DIR`), `propose` and `publish` read and write `<venture-dir>/published.json`.
They never touch `products/legal/published/`. The fixture path is unchanged, and its venture name
is now checked against the venture-name grammar before it is joined into a path. That closes the
debt-ledger item on reserved device names and case variants for that call.

The venture-dir is an operator-supplied directory, exactly like `--out`, so it is not confined to
a root. It is the same directory the facts were just read from, so nothing new is trusted.

**Evidence:** `arc-legal.mjs` `publishMain` and `publishedRecord`, read on 2026-10-07. ADR-1205.
`initiatives/legal/evidence/fixed-defect-list.md` rows 23 and 36.
**Confidence:** high.
**Rejected because:** Option 1 keeps a real venture's history in a public repo, and a salt kept
off-repo breaks the fresh-clone property row 23 was fixing. Option 2 deletes REQ-06's diff for
exactly the ventures it exists for.

## Consequences

- A real venture's monotonicity now holds wherever its facts directory goes. For LexOS that is
  `~/.arc-private/legal/lexos/` until publish, then the venture repo, per the handoff. A facts
  directory that loses its `published.json` reads as a first publish. That is the same exposure the
  fixtures had before row 23, and it is now the venture's to keep, alongside its receipts.
- `products/legal/published/` only ever holds fixture records.
