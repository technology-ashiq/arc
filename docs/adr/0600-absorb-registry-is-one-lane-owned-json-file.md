# ADR 0600 — ABS-A: the technique registry is ONE absorb-owned JSON file, and it references the lock rather than copying it

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** two-way
**Revisit trigger:** the registry needs a field that only a per-lane file could carry, or JSON's
lack of comments makes a row's reason unrecordable in practice.

## Context

absorb must track every technique it has looked at — adopted, trialled, refused, retired — or it
becomes the tool-hoarding failure its own pre-mortem names as row 3. The question is where that
record lives, and how it relates to the record that already exists for *executables*.

`capability-lock.json` is live at `.claude/scripts/develop/` and its shape is confirmed by reading
it on 2026-08-09: a top-level `capabilities` array plus a `refusals` array, each capability row
carrying `name` · `registry` · `version` · `hash` · `publisher-auth` · `build-attestation` ·
`checked` · `source` · `class`. One real row exists (madge 8.0.0). So the pin/hash/provenance
discipline REQ-04 defers to is real rather than aspirational, and duplicating it would create two
places where a hash can be wrong.

A5 (one source of truth per fact) is the binding article.

## Options considered

1. **One JSON file, lane-scoped rows.** Pros: machine-checkable without a parser dependency
   (A2 zero-dep); one place to lint; diffable. Cons: no native comments — reasons must be fields.
2. **One Markdown table.** Pros: readable, comments free. Cons: a lint that must parse prose is
   the "grep instead of a parse" mistake this repo has already been burned by; status transitions
   would be unenforceable in practice.
3. **Per-lane registry files.** Pros: no cross-lane contention. Cons: violates A5 directly, and
   the ≤12-adopted cap becomes uncountable across forks — the cap is the anti-hoarding control,
   so making it uncountable removes the control.

## Decision

**One file: `products/absorb/registry.json`.** Machine-checkable JSON, its schema carried in-file
via a `$comment` key so the shape and the data cannot drift into separate documents. Lane-scoped
rows inside one file; never per-lane forks.

Row shape: `id` · `name` · `status` (`candidate|trial|adopted|retired`) · `lane` · `source`
(+ `license`) · `classification_ref` (report path) · `evidence` (links) · `attribution`
(nullable) · `decision_refs` (adopt/retire) · `review_by` (date).

**Rows reference, never duplicate.** Anything executable keeps its pin, hash, provenance and
publisher-auth in `capability-lock.json` alone; the registry row points at the lock entry. A
registry row that carries its own hash field is a lint failure, not a convenience.

Phase 0's DEV-B/C boundary audit confirms the lock's full contract before the registry's
reference format is frozen — the shape above is read from the file, but what develop *guarantees*
about it is the audit's finding, and the audit is Phase 0's first exit criterion.

## Consequences

**Easier.** The ≤12 cap is countable, so the anti-hoarding control actually works. One lint reads
one file. A technique's whole history — including refusals — sits in one diffable place (A10:
never delete).

**Harder.** JSON carries no comments, so every reason must be a named field decided up front; a
reason with no field gets lost, which is why `classification_ref` points at the report that holds
the prose. And absorb now depends on develop's lock format: if develop reshapes it, absorb's
reference format breaks. That coupling is deliberate — the alternative is two hashes for one
artifact — and it is why the audit precedes the freeze.
