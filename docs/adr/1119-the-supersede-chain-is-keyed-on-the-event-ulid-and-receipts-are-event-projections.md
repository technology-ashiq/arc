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

## The two-surface adversarial pass, 2026-08-16

Two fresh attackers, neither having seen the implementation reasoning, one on decision logic and
one on the encoding/OS boundary. **23 real findings.** Their overlap was two items, both of which
each had already observed fixed mid-run — which is the argument for two surfaces stated as a
measurement rather than a principle: a single attacker's blind spot is structural.

The pass changed this ADR's own claims. Three findings landed *in the fix this ADR describes*:

- **`contentIdem` collides at the UTF-8 encoding boundary.** The preimage is joined as a string and
  hashed as bytes, and that map is not injective — every lone surrogate encodes to `EF BF BD`, the
  same bytes as U+FFFD. Two different titles, two different event shas, **one idem**, second
  dropped as `DUP_IDEM`. That is the C2 loss class reproduced inside the rule written to prevent
  it, in a file whose header claims the preimage is total. The `|` defence works on the string and
  cannot see a collision that happens one layer down at the encode. Refused now in both
  `contentIdem` and `assertContent`.
- **`content_sha` was two different functions**, exactly as `content-sha.mjs` warned it must never
  be: the draft path hashed a BOM-stripped, decode-round-tripped string and the publish path hashed
  the file. The CRLF half of this was found and fixed the same day in `arc-site`; the BOM half was
  left open in the sibling reader. **Twin-fix recurrence number five in this lane.**
- **A mutant that ignores the chain entirely passed the rewritten test.** Both fixtures carried one
  slug, so array order and chain order were indistinguishable, and `heads = [last]` — the exact
  pre-fix defect — stayed green. The fixture now lists the head *before* the receipt it supersedes.

The generalisation worth keeping is narrower than "attack the tests": **a fixture with one instance
of anything cannot distinguish order from selection.** Both the sha-keyed chain and the array-order
mutant survived for the same structural reason, one round apart.

### The twin check on the surrogate collision came back CLEAN, and why that matters

The lane rule is that a fix is not applied until it has been attacked somewhere it was never made,
so the encoding collision was checked against **every other join-then-hash idem preimage in the
repo** — `leadsIdem`'s seven kinds, `decision.recorded`, `constitution.adopted`. It is not
reachable in any of them, and the reason is worth writing down rather than the result:

**`content.published.title` is the only free-form string in any idem preimage in this repo.**
Every other field that reaches a preimage is constrained to ASCII by its grammar before it gets
there — `DIMENSION_RE`, `CAMPAIGN_RE`, `LEAD_ID_RE`, `SOURCE_ID_RE`, `PAYLOAD_TS_RE`, a ULID, a
hex digest. A lone surrogate cannot enter, so the string-to-bytes step cannot lose information.
Probed rather than reasoned about — a lone surrogate in `module`, `surface`, `metric` and
`source_id` is refused `BAD_LEADS` in all four.

So the invariant that keeps the rest of the spine safe is **"no free-form field reaches an idem"**,
and `title` is the single documented exception. Anyone adding a free-form field to a preimage
inherits this defect unless they refuse lone surrogates at the same time. That sentence is the
actual deliverable of this twin check; "checked, clean" on its own would send the next person to
re-derive it.
