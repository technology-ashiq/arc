# <one line: what was observed, not where>

<!--
  Design intelligence library entry (PLAN-design §2.8). The PRINCIPLE is the asset — a
  screenshot with no reason attached is a gallery, and galleries do not compound.

  Grammar is strict and machine-checked by `design-lint.mjs --library <file>`:
  tag lines are `- key: value` at the top level, each key exactly once, no empty values;
  the two level-2 headings below are exact and must each appear exactly once. Structure is
  parsed with code fences AND html comments stripped — including unterminated ones — so
  quoting a heading or a tag inside a ``` block or a <!-- block does not satisfy it. Every one
  of those was a real hole found by attacking this lint, and each is pinned as a fixture.

  Untagged observations do not enter. That is the whole gate: every key below is REQUIRED,
  including `outcome` — write `unknown` when it is unknown, so that saying nothing is a
  deliberate act rather than an omission nobody notices.

  REPLACE EVERY <angle-bracket prompt> below. The lint rejects them as unfilled template
  boilerplate, because four of the eight tags ship with valid-looking defaults and copying this
  file with only the prose written was how an untagged entry first got in.
-->

- type: Pattern
- domain: <product domain, e.g. legal case management>
- user: <user type, e.g. solo-practitioner lawyer>
- platform: desktop
- problem: <the interaction problem this addresses, in one line>
- confidence: medium
- outcome: unknown
- source: <where this was observed — a run, a receipt id, a route, a cited product>

<!--
  type       Pattern | Craft | Brand | Anti      (exact case, exactly one)
               Pattern — how experts solve a specific interaction problem
               Craft   — typography, density, hierarchy, motion, detail
               Brand   — emotional stance / visual language to emulate
               Anti    — right for another product, wrong for THIS intent (record WHY)
  platform   one or more of: desktop, mobile, tablet, keyboard-first, reduced-motion
             (comma-separated; same surface vocabulary as the brief's platform contract)
  confidence high | medium | low
  outcome    what happened when it was applied, or `unknown`
  source     a principle with no source is an assertion, and this build runs on evidence
             over assertion. External-product claims are factual claims: they need a
             research receipt, not a memory.
-->

## Principle

<Why it works, in prose. The test: could someone apply this to a different screen without
having seen the original? If the text only names a product or points at an image, it is not
a principle yet and the lint rejects it.>

## Do not copy

<What specifically must NOT be lifted. References are for patterns and vocabulary; copying a
specific design is slop with extra steps, and a legal risk besides. For an `Anti` entry this
is the operative half — say what would be wrong here and for whom it is right.>
