# ADR 0301 — EVO-A: the `evolve` manifest contract is a JSON section, strict from birth

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** two-way
**Revisit trigger:** a second module class (beyond growth-style surfaces and council) needs a
field this schema cannot express without a passthrough escape hatch.

## Context

A module must declare what may be optimized, or the runner has no bounded surface to act on.
Manifests in this repo are JSON, and `product-lint.mjs:38` closes unknown fields against a
12-entry `KNOWN_FIELDS` set — an unknown key is exit 2 today. So the contract is an extension of
an existing strict parser, not a new file format.

Zero of the 10 existing product manifests declare an `evolve` section, verified at kickoff. That
matters: strict-from-birth validation breaks no existing manifest, which is only true once.

## Options considered

1. **A separate `evolve.json` per module.** Pros: no `product-lint` change. Cons: a second
   registry to keep in sync with `manifest.json`, and drift between two files describing one
   module is the `arc-orchestrator` doc-rot pattern with a new face.
2. **A free-form `evolve` object, validated later at registration.** Cons: invalid structure
   lives in-tree until someone runs an experiment; the failure arrives far from the edit.
3. **A closed `evolve` section in `manifest.json`, validated by the same lint that already
   closes the field set.** Chosen.

## Decision

`evolve` becomes a known field in `KNOWN_FIELDS` plus a dedicated section validator carrying:

- `metrics[]` — name, source event, aggregation, `direction: higher-is-better | lower-is-better`,
  and `role: primary | guardrail`
- `experiments[]` — surface file, variant grammar, fixed split, excluded categories
- `evals` — holdout rule, per-arm floor, minimum-effect rule, **test id + α + `effect_floor`**
- `promote_via` — an exact canonical-target file allowlist; arbitrary paths are never allowed

Three enforcement levels, deliberately different:

| Situation | Behaviour |
|---|---|
| Section absent | exit 0, silent — the registration gate carries the requirement, not the lint |
| Section present but invalid | exit 2 from birth, naming the exact missing keys |
| Experiment registration without a valid contract | hard runtime refusal, naming the exact missing keys |
| A money-touching path in `promote_via` | permanent refusal at the contract layer |

Validation is added **inside the existing hostile-fixture corpus**, not beside it —
`product-lint` is parser-class, so it inherits the adversarial discipline recorded in
`docs/retro-log.md` on 2026-07-16 and re-confirmed 2026-08-02.

## Consequences

**Easier.** One file describes a module. A surface that is not declared cannot be experimented
on, which makes the money-path prohibition enforceable at the contract layer rather than by
reviewer attention.

**Harder.** Every future field is a lint change plus fixtures, by design — the schema cannot
grow by accident. And `absent = silent` means a module that simply forgot to declare `evolve`
looks identical to one that deliberately opted out; the registration gate is the only place that
distinction surfaces, so that gate's error message is load-bearing.
