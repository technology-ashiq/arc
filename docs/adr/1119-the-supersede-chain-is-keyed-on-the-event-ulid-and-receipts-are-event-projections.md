# ADR 1119 — The supersede chain is keyed on the event ULID, and `--receipts` takes event projections

**Status:** accepted
**Date:** 2026-08-16
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** `content.published` gains a payload field that identifies a receipt more
stably than its event id — there is no such field today and adding one would need its own ADR,
because anything in the payload is also in the idem preimage and therefore changes when corrected.

## Context

Phase 01's whole job is the domain cutover: the Phase 0 article was published to a preview host, so
its receipt carries a `site` that is no longer true, and REQ-11 requires the correction to happen
**by `supersedes`, never by editing**. Building that path surfaced two defects in code that had
already closed a phase. Both were found by running the cutover's actual shape through the existing
readers rather than by reading them, and both fail silently.

**Defect 1 — the chain was read from a field that can never exist.** `resolveSlugUrl` computed its
superseded set as `receipts.map((r) => r.supersedes)`, reading `supersedes` off a
`content.published` **payload**. That payload shape is closed to eight fields with `optional: []`,
so `assertContent` refuses the key outright. Verified directly:

```
REFUSED: BAD_CONTENT -- content.published payload has unknown key "supersedes"
```

The superseded set was therefore **always empty**, every receipt was treated as a head, and the URL
map resolved last-wins by array order. A join that answers confidently and by accident.

**Defect 2 — it compared `supersedes` against `content_sha`.** Even granting a `supersedes` value,
the comparison was `!superseded.has(r.content_sha)`. A site re-pin changes `site` and `url` and
leaves the **bytes alone**, so both receipts carry one `content_sha` — and the filter removed
**both**. Reproduced against the real cutover shape before any fix:

```
joined: 0   unjoined: 1
REPRODUCED -- a real week of clicks falls out of the feed
```

The function's own doc comment names this exact scenario: *"The Phase 1 domain cutover leaves TWO
receipts per pre-cutover slug."* It described the case it broke on.

**Why neither was caught.** The covering test used two **different** `content_sha` values, which is
the single shape in which a content_sha-keyed chain works, and put `supersedes` in the payload — a
receipt that cannot exist on the spine. A test whose fixture is impossible cannot observe the
failure it is named for. This is the vacuous pass `.claude/rules/testing.md` names, and it is the
fourth twin-defect in this lane found in a file adjacent to one already fixed.

## Options considered

1. **Add `supersedes` to the `content.published` payload.** Rejected, and the reason is the whole
   point of ADR-1101: the payload is the idem preimage. A pointer to the previous receipt would
   become part of this receipt's identity, so two corrections of the same article from different
   predecessors would be different facts about the same publication. Identity must not depend on
   history.
2. **Key the chain on `content_sha`.** Rejected — this is defect 2 restated. It is only sound when
   every correction changes the bytes, and the correction this phase exists to make does not.
3. **Key the chain on the event ULID, and require receipts to carry it.** Chosen.

## Decision

**`supersedes` names an EVENT.** It is the event-level ULID field the spine already validates
(`BAD_SUPERSEDES`, a ULID or null, self-reference refused). Nothing new is added to any payload and
no company organ changes.

**`--receipts` takes event projections, not bare payloads:** the payload fields plus the event `id`
and its `supersedes`. A receipt lacking `id` is **refused loudly** (`BAD_RECEIPT`) rather than
treated as a head, because "treated as a head" is precisely how defect 1 stayed invisible through a
phase close. This is a breaking change to a Phase 05 surface that has never had a production
caller — there are zero `content.published` receipts on the spine — so it costs nothing today and
would have cost a week of attributed traffic later.

`repinUrl` replaces **only the host** and preserves the path byte-for-byte. Re-deriving the path
from the slug was the alternative and would silently rewrite a correct URL into a well-formed 404
the moment an article is served from anywhere but `/blog/`.

## Consequences

**Good.** The chain is keyed on the only identifier that is stable under correction, which is what
a chain needs. The cutover is now provable end-to-end through the real emitter: two receipts, linked
by ULID, different idems, identical bytes, nothing quarantined. The id-less refusal converts the
worst property of both defects — silence — into a stop.

**Bad, and stated.** Anyone holding a `--receipts` file of bare payloads must regenerate it, and the
error message has to carry them, because the old file is not malformed JSON and would otherwise look
fine. It is a hard error for exactly that reason.

**The uncomfortable one.** Two defects and a test that could not see either survived a phase close
with an adversarial pass behind it. What the pass did not do was run the *next* phase's data shape
through *this* phase's readers. The cheap generalisation: when a phase's own documentation names a
future scenario, that scenario is a fixture, not a comment. `resolveSlugUrl` described the cutover
in prose and was never given one.
