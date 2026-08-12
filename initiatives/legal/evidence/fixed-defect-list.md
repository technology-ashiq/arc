# legal lane — running fixed-defect list

> Every hole this lane has closed, one row each. **This file is an input, not a record.**
> Each adversarial attacker's prompt carries it with the instruction: *check every entry in
> every OTHER file.* A fix is not applied until it has been attacked somewhere it was never
> made — the twin-fix pattern has recurred four times in this repo (2026-08-03, 08-04, 08-09,
> 08-10), and advisory prose failed to stop it every time.
>
> Updated in the SAME commit as the fix. A row added later is a row the next attacker did not
> get.

| # | File | Defect class | What it was | Fixed in |
|---|---|---|---|---|
| 1 | `.claude/scripts/legal/lib/yaml.mjs` | `literal-control-byte` | The NUL-byte guard and the BOM strip were each written with the LITERAL character in the source. `grep` then read the whole file as binary and reported `Binary file ... matches`, so any later pattern-based patch would have matched nothing. This is `arc-absorb` 2026-08-09 reproduced exactly — including the irony, since the file doing it is the guard against control characters. | Phase 00 |
| 2 | `.claude/scripts/legal/lib/schema.mjs` | `regex-that-cannot-match` | The two-or-more-spaces check was written `/{2,}/` — a quantifier with nothing before it. That is NOT a syntax error: Annex B reads a bare `{2,}` as the literal text `{2,}`, so the regex compiled, matched nothing, and the FREE-TEXT run-of-spaces rule would have reported clean forever. Same family as `arc-memory` 2026-08-12 (a gate that printed its contract and compared against nothing) — the check existed, ran, and could not fail. Fixed to `/[ ]{2,}/`, where the quantifier's target is impossible to misread. | Phase 00 |

| 3 | `.claude/scripts/legal/lib/lints.mjs` | `false-positive-on-correct-input` | trace-lint's branch-mismatch check fired for every NON-selected branch that listed a clause, so a clause legitimately shared by two branches reported a mismatch against a venture it described perfectly. It fired on the very first render of a correct page. The question is not "is this clause listed under some branch that was not chosen" but "is it listed under the branch that WAS". A check that is noisy on correct input teaches its reader to skip it. | Phase 00 |
| 4 | `products/legal/templates/v1/{terms,privacy}.tmpl.md` | `conditionally-required-unconditionally-emitted` | `PRIVACY.PROCESSOR`, `PRIVACY.SUBPROCESSORS` and `TERMS.PROCESSOR_ROLE` were REQUIRED only when `stores_third_party_client_data=true` but emitted with no `when=` guard at all, so three fixtures rendered a processor clause for a venture that holds nobody else's records. Completeness-lint cannot see this class — it only checks presence. trace-lint caught all three, unplanted, which is the closest thing to a real negative control this phase produced. | Phase 00 |
| 5 | `products/legal/data/vocab.json` | `two-keying-schemes-in-one-lookup` | The label tables were keyed by VOCABULARY name (`operator_type`) while the template asks for `label.<field path>` (`operator.type`). The lookup returned undefined and the render died. Two keying schemes in one file is how a lookup silently returns nothing; the file now says which one it uses and why. | Phase 00 |
| 6 | `tests/legal-probe.mjs` | `vacuous-by-construction` | The NFC-versus-NFD canonicaliser case was written as two typed literals. Typed literally, an editor or a filesystem normalises both to one form and the case compares a string with itself — passing whatever the canonicaliser does, inside the test written to prove normalisation happens. Rebuilt from `\u` escapes with a guard that refuses to run if the two inputs are equal. | Phase 00 |
| 7 | mutation controls (`prove-mutants`) | `negative-control-that-cannot-fail` | TWO of eight mutants came back green and neither was a lint hole. `branch-leak` was rendered against the gateway fixture, where an unguarded gateway clause is correct — a leak is only observable from a branch that was NOT chosen. `denylist-bypass` was rendered against a clean page, where an emptied denylist has nothing to miss; it proves something only PAIRED with a claim (red with the list, green without). Both controls were fixed rather than the green being explained away. | Phase 00 |
| 8 | `tests/fixtures/legal/ventures/**` | `fixtures-that-cannot-distinguish` | All six fixture ventures shared one domain and one operator name, so if the renderer had rendered venture A's facts under venture B's name, every email and URL on the page would still have looked correct. Found by READING a rendered page, not by any lint. Each fixture now carries its own domain, operator and refund window. | Phase 00 |

## Standing instructions to every attacker on this lane

1. Take each row above and look for the SAME CLASS in every other file in
   `.claude/scripts/legal/**`, `products/legal/**` and `tests/legal-*.bats` — not in the file
   the row names.
2. Row 1 generalises: **any** character built into a literal that a tool might read as
   structure — control bytes, BOM, non-ASCII in a `@test` name (bats silently drops the test),
   a backtick or `$` inside a double-quoted shell string, an apostrophe inside a single-quoted
   one.
3. Attack the TEST that protects a rule, not only the rule. A guard whose negative control is
   a grep has no negative control; build a mutant that RUNS and walks past it.
