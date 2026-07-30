# Design intelligence library

The compounding asset of the design system (`docs/strategy/plans/PLAN-design.md` §2.8). Every
file here records a **principle** — why something works — never a screenshot with a product
name attached. Galleries do not compound; principles do.

## Writing an entry

Copy `docs/templates/design-library-entry-template.md`, name it `<YYYY-MM-DD>-<slug>.md`, and
replace **every** `<angle-bracket prompt>` in it. Then:

```
node .claude/scripts/design/design-lint.mjs --library docs/design/library/<your-entry>.md
```

The same check runs over every file here in gate mode (`design-lint.mjs` with no arguments),
which is what the `design` gate row calls.

## The four types

| Type | What it records |
|---|---|
| `Pattern` | how experts solve a specific interaction problem |
| `Craft` | typography, density, hierarchy, motion, detail |
| `Brand` | emotional stance or visual language to emulate |
| `Anti` | right for another product, wrong for this intent — with the WHY |

## What the lint enforces, and what it deliberately does not

It **measures**: all eight tags present and non-empty, no unfilled template placeholders, closed
vocabularies for `type` / `confidence` / `platform`, both required sections present exactly once,
and enough prose in each to be a principle rather than a link.

It does **not judge** whether a principle is any good. That is an agent's call, not a script's
(ADR-0048) — eight words of filler will pass the floor. The floor exists to stop empty entries,
not to grade real ones.

## Two rules that are easy to get wrong

- **`outcome` is required, and `unknown` is a valid value.** Making it optional would erase the
  difference between "we looked and do not know" and "nobody filled it in".
- **`source` is required.** A principle with no source is an assertion, and claims about other
  products are factual claims — they need a research receipt, not a memory.

## Provenance of the first entries

The four entries dated 2026-07-29 come from arc's own Phase-02 explore run
(`docs/design/explore/hq-dashboard-v1/`) and cite its three blind juror rankings, rather than
from external references nobody here verified. That is the standard for what enters: a claim
tied to something a reader can go and check.
