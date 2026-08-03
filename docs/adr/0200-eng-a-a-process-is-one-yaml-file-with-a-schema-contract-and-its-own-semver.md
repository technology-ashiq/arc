# ADR 0200 — ENG-A: a process is one YAML file, with a JSON-Schema output contract and its own semver

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299 (`PORTFOLIO.md` § ADR number bands)
**Reversibility:** two-way
**Revisit trigger:** a pilot needs a YAML construct outside the frozen subset for the **second**
time. The first extension is a subset amendment; a second one means the subset was chosen wrong
and the format decision reopens.

**Locked upstream.** This ADR records ENG-A from the approved design source
`docs/strategy/plans/PLAN-engine-process-layer.md`. The fork was decided there; what this file
adds is the constraint that survives contact with arc's zero-dependency rule.

## Context

A process is the model-neutral truth of one arc command: intent, inputs, steps, the abstract
tools it needs, the shape of its output, and the fixtures that judge it. Today that truth is
fused into Claude-Code-dialect markdown under `.claude/commands/`, which is why every model
change reads as a migration.

Two constraints shape the format, and neither is negotiable:

1. **arc core is zero-dep.** There is no `package.json` and no `node_modules` in this repo
   (verified at `7abeda1`). Node's standard library has **no YAML parser and no JSON-Schema
   validator**. Choosing YAML therefore means *writing a parser*, and writing a parser in arc
   means it inherits the parser-class rule: an adversarial breaking-input pass by a fresh agent,
   holes pinned as fixtures (retro-log 2026-07-16, and 2026-08-02 where the author's own 26
   inputs found nothing and an unanchored agent then found 9 real holes).
2. **The spine already constrains the name.** `.claude/scripts/hq/lib/validate.mjs` pins
   `PROCESS_RE = /^[a-z0-9][a-z0-9._-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/` on every event's
   `process` field. `name@semver` is not a new invention this cycle gets to design — it is a
   live machine contract that every `run.completed` receipt must already satisfy.

## Options considered

1. **YAML subset, frozen and named** — pros: matches the dialect the command frontmatter already
   speaks, so a human reading a canonical file and a generated file sees one language; block
   scalars hold prose without escaping. Cons: a hand-written parser is new attack surface.
2. **JSON** — pros: `JSON.parse` is free, zero parser risk. Cons: multi-line prose becomes
   `\n`-escaped one-liners, which is exactly the content a human must review in a byte-diff; the
   format that is cheapest to parse is the one most expensive to read.
3. **TOML** — pros: unambiguous grammar. Cons: also needs a hand-written parser, with none of
   YAML's familiarity payoff, and multi-line handling is no better than option 1.

## Decision

**`processes/<name>.process.yaml`, one file per command, at the repo root.** Each file carries
`name`, `version` (semver), `intent`, `inputs`, `steps`, `tools` (abstract), `output` (a
JSON-Schema **subset** document), and `evals` (fixture refs).

The parser reads a **frozen YAML subset**, and the subset is the decision:

- block mappings, block sequences, plain/single/double-quoted scalars, and block scalars
  (`|`, `|-`, `>`), comments, and one document per file;
- **excluded, and rejected loudly rather than ignored:** anchors and aliases (`&`/`*`), tags
  (`!!`), **non-empty** flow collections (`{a: 1}`/`[1, 2]`), multi-document streams (`---`
  after the first), merge keys (`<<`), and tab indentation.

**Amendment, 2026-08-03 — the one this ADR's revisit trigger allows.** The empty literals
`[]` and `{}` are **permitted**. Phase 00's first `process-lint` run rejected `inputs: []`,
which this ADR's own worked example uses — the exclusion as first written contradicted the
format it was defining. The exclusion exists so the parser never implements flow-style
parsing; `[]` and `{}` require none, being terminal tokens with no nesting, separators or
ambiguity. `inputs: []` is also how a human plainly reads "no inputs", where a bare
`inputs:` parsing to null says the same thing far less legibly and forces the lint to treat
absence and emptiness alike regardless. Per the revisit trigger, this is the **first**
extension and is therefore an amendment; a **second** one reopens the format decision.

An excluded construct is a **parse error naming the construct and the line**, never a silent
skip. A subset that degrades quietly is a subset that lies about what it read.

The `output` contract is likewise a **frozen JSON-Schema subset** — `type`, `properties`,
`required`, `enum`, `items`, `additionalProperties`, `minLength`, `pattern` — validated by a
hand-written checker. Anything outside it is a `process-lint` failure at authoring time, so an
unsupported keyword can never be silently unenforced at run time.

`name` and `version` are constrained to satisfy `PROCESS_RE` above, and `process-lint` asserts
that directly against the imported regex rather than against a copy of it.

**Evidence:** zero-dep status verified by absence of `package.json`/`node_modules` at `7abeda1`;
`PROCESS_RE` and the closed 22-kind vocabulary read from `.claude/scripts/hq/lib/validate.mjs`;
the existing minimal frontmatter reader at `.claude/scripts/council/council-lint.mjs:52` is the
precedent this parser extends rather than replaces.
**Confidence:** high
**Rejected because:** JSON — unreviewable prose in the one artifact whose review *is* a byte-diff.
TOML — same parser cost as YAML, none of its familiarity.

## Consequences

**Easier.** One file answers "what does this command actually do", independent of who runs it.
The spine's `process` field stops being a hand-typed string and becomes a value derived from the
canonical file. Adding a target dialect never touches the truth.

**Harder.** arc now owns a YAML parser and a schema validator it did not have this morning — two
new parser-class artifacts, each owing the adversarial pass, inside a 2-week appetite. That cost
is the honest price of ENG-A and is why the subset is frozen and small rather than "YAML".

**What we'd revisit if this goes wrong.** If the subset needs a second extension, the format
choice reopens per the revisit trigger. If the schema-subset validator turns out to need
draft-07 semantics it cannot express (`oneOf`, `$ref`), the output contract narrows to "shape
plus required keys" and says so, rather than implying a conformance it does not have.
