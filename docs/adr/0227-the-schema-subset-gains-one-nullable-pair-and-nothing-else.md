# ADR 0227 — The schema subset gains one nullable pair, and nothing else

**Status:** accepted
**Date:** 2026-09-26
**Product:** engine
**Reversibility:** two-way
**Revisit trigger:** a process needs a union that is not "one type or null". That is the draft-07 need ADR-0200 says
narrows the contract rather than growing the subset, so it comes back here before any second union is added.

## Context

ADR-0200 froze the output-contract schema at eight keywords with a single-string `type`, validated by hand in
`.claude/scripts/engine/schema-subset.mjs`. A field that is "a string, or nothing" could only be written as `type:
string` and left out of `required`. That schema says "absent is fine" but refuses `null`, and models write `null` for "no
value" as a matter of course.

On 2026-09-26 that gap cost a full attack run. The boundary surface of `attack-diff` answered with at least 12 findings, one of
them `"twin_of": null`. arc-run's contract check failed the whole answer (`$.findings[11].twin_of: expected type
string, found null`), retried once on the same tier, failed identically, and 24 minutes of model work produced no report.
Nothing else in the answer was reported invalid; the contract had no way to say "no twin" as the model did.

## Decision

1. `type` may be a list of exactly two entries, one of them `"null"` and the other one of the seven types:
   `type: [string, "null"]`, in either order. That is the ONLY union. `[string, number]`, three entries, a repeated
   entry, or an unknown name are a lint failure (`schema-shape`), and `anyOf` / `oneOf` stay rejected by name.
2. Validation: `null` satisfies the pair, and no other keyword on that node applies to it. Any other value is checked
   against the pair's one real type exactly as a plain `type` would be. `minLength`, `pattern`, `enum` and the rest
   keep their meaning for that type.
3. The keyword-applies-to-type lint reads the pair's real type, so `minLength` on `[string, "null"]` is valid and
   `minLength` on `[number, "null"]` is still the silently-unenforced error it always was.
4. Every existing schema is unchanged in meaning: a single-string `type` validates exactly as before.
5. First use: `attack-diff`'s `twin_of` is `[string, "null"]` (process 1.1.0). Its body still asks for `twin_of` only
   when a finding repeats a carried pattern.

## Consequences

- The subset's promise holds: a claimed constraint is either enforced or refused at authoring time. The pair adds one
  enforced shape, not an unenforced one.
- A model's `null` for "not applicable" no longer fails an otherwise valid answer on any field declared nullable. A
  field not declared nullable still refuses it, which is the point of declaring.
- `baseType()` is exported, so a future reader of `type` (a renderer, a doc generator) gets the real type from one
  place instead of re-parsing the list.

## Related

ADR-0200 (the frozen subset) · ADR-0226 (the attack pass) · the engine out-of-cycle bug of 2026-09-26 in
`initiatives/engine/PROGRESS.md`.
