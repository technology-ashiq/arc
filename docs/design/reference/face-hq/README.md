# `docs/design/reference/` — designs the OWNER brings, not ones the machine explored

This directory holds design work that arrives from **outside** the explore/jury machinery
and carries the owner's authority directly. It is not a variant, it is not a candidate,
and it is not judged against anything — **it is the target.**

## Why this directory exists

`docs/design/explore/` holds what the machine tried; a jury ranks those and the owner
picks one. That loop ran twice for the face and produced work the owner scored **18/100**
("very basic") and then a second round he judged the same way. His verdict on the loop
itself is on the record: the arc design lane produces work that would not survive a
world-class designer looking at it, and `design-lint` cannot tell — every rejected variant
passed it. That is ADR-0049's BELOW-BAR failure, still live in this lane: a gate whose only
pass condition is "broke no rule" is blind to mediocrity.

So the owner supplies the design. That is a **stronger** input than a jury pick, not a
weaker one, and it is recorded as its own decision rather than dressed up as an explore
result.

## What goes in `face-hq/`

Any form. Ranked by how exactly it can be reproduced:

| Form | What I can take from it |
|---|---|
| HTML + CSS (a coded mockup, a template, a v0/Lovable export) | exact tokens — colours, type scale, spacing, radii, shadows, motion |
| A Figma file or link | tokens, components and screenshots pulled directly through the Figma bridge |
| A live URL | computed styles read off the running page |
| Screenshots (PNG/JPG) | the system rebuilt by eye — faithful in look, approximate in exact values |

More than one form is better than one. Drop the files in `assets/` (or paste a link into
`SOURCE.md`) — no naming convention to follow, no lint to pass.

## What happens to it

1. It is read in full — the pixels themselves, not a report about them.
2. Its system is extracted into canonical `docs/design/system/tokens.css` + core components.
3. It is mapped onto the face's **meaning contract** — the four reserved signals
   (needs-you · real money · incident · non-real), "no number without a receipt", the
   hollow zero, and arc's vocabulary. Where the reference and the contract collide, the
   collision is reported to the owner with both options named. Neither is silently dropped.
4. That system, not an explore variant, becomes the input to Phase 04 and the L3 repo.

## What this directory is NOT

Not a dumping ground for inspiration. One reference per surface, and the surface is named
by the directory. `face-hq/` is the arc face. A second surface gets a second directory.
