# The lane's running fixed-defect list — input to Phase 02's adversarial passes

ADR-0708 and the PLAN non-negotiable: *"each pass carries the running list of defects already
fixed in this lane, to be checked against every other file."* A fix is not applied until it has
been attacked somewhere it was never made. Twin-fix recurrence is the single most-recorded shape
in `docs/retro-log.md`, and it has already bitten this repo twice in two days.

## The four prior ledgers — read these in full, they are the bulk of the list

| Pass | File | Findings |
|---|---|---|
| Phase 00 · decision logic | `initiatives/memory/evidence/phase-00/adversarial-decision-logic.md` | see file |
| Phase 00 · shell/OS | `initiatives/memory/evidence/phase-00/adversarial-shell-os.md` | see file |
| Phase 01 · query logic | `initiatives/memory/evidence/phase-01/adversarial-query-logic.md` | 12 (11 fixed) |
| Phase 01 · CLI/OS | `initiatives/memory/evidence/phase-01/adversarial-cli-os.md` | see file |

Every row's **disposition** column states the fix. For each one, the question for this pass is
not "was it fixed?" but **"was it fixed in the OTHER files too?"** — the three new Phase-02
surfaces, and the older files the fix was never applied to.

## Fixed during Phase 02 itself, and therefore in no ledger yet

These were found and fixed in this phase, before any adversarial pass ran. They are the freshest
patterns and the most likely to exist un-fixed one file over.

| # | defect | where it was fixed | check it against |
|---|---|---|---|
| P2-1 | An accepted-but-inert flag: the operator believes it took effect. (`--full-text`, Phase 01.) | `--decisions` refuses every argument it would otherwise drop in silence — a positional query, `--grep`, a contradicting `--source`, `--full` | `conflict-check.mjs`, `diff-recall.mjs`, `golden-check.mjs`: is there ANY flag combination where one argument is silently ignored? |
| P2-2 | `process.exit(0)` after writing stdout truncates on macOS pipes. The file's own closing note warned of it and **three branches did it anyway**. | `arc-recall.mjs` `--full` miss, `--grep --json`, and the new `--decisions --json` all `return` now | every `.mjs` in `.claude/scripts/memory/` — and the same class in `hq`/`evolve` scripts this lane touched |
| P2-3 | A directive key grammar of `[a-z0-9-]+` matched the prose comment `@-directives` written directly above the directives it documents, so the fixture's own documentation refused the whole gate at exit 2. | `golden-check.mjs` keys must start with a letter | every other regex in this lane that parses a marker out of free text: the retro-log adapter's row grammar, `parseAliases`, the `--decisions` term splitter |
| P2-4 | A lint token banned by proxy (`\.jsonl` = "raw spine access") fired on a file that was obeying the rule. Sanctioned **at the token, never at the line** — a `grep -v` on the filename would also mask a real bypass mentioning it on the same line. | `spine-reader-lint.sh` | any other allow/deny list in the lane: does it exempt a FILE where it should exempt a TOKEN, or a LINE where it should exempt a MATCH? |
| P2-5 | GNU-only shell in tests: `sed -i` takes a mandatory backup suffix on BSD, and `\t` in a sed regex is GNU-only. Passed on ubuntu and windows, failed on macOS alone. | `tests/memory-golden.bats` — rewritten with node | `memory-conflict.bats`, `memory-hook.bats`, `memory-recall.bats`, `memory-index.bats`, and any `.sh` this lane added |
| P2-6 | A test pinned a hand-written sentence (`"sqlite arrives in Phase 2"`) that a later decision made false. | the `--engine` refusal enumerates the REGISTRY, which cannot go stale that way | every other assertion in this lane that pins prose rather than a derived value |
| P2-7 | A new script not declared in `products/memory/manifest.json` is not synced, and the byte-identity gate only catches it on CI. | `conflict-check.mjs`, `diff-recall.mjs`, `lib/observe.mjs`, `lib/engines.mjs` all declared | is every file this phase added declared, and is every declared file present? |
| P2-8 | A new test file with no `tests/shard-timings.json` entry silently rides `_default_weight` 16. | all three new files measured at birth from their own CI run | any file added later in this phase |
| P2-9 | Two hand-kept lists of the same names drift, and the one that drifts is the one the operator types against. | `--engine` names derive FROM `lib/engines.mjs` | `SOURCES` in `arc-recall.mjs` vs the adapters actually registered in `memory-index.mjs`; `PATH_NOISE`; `DECISION_FIELDS` vs the decisions adapter's real payload keys |
| P2-10 | A gate that transforms what it measures must declare what the transform destroys. | `diff-recall.mjs` prints its dropped-token list and count, and reports paths left with nothing | `conflict-check.mjs` (no stoplist — is that stated?), `sanitizeQuery`, `tokenize` |

## The three surfaces this phase ships, which the passes must attack

1. **`--decisions` filter grammar** — `arc-recall.mjs`, `parseDecisionFilter` / `matchesDecision`.
2. **The near-duplicate detector** — `conflict-check.mjs`, `jaccard` / `normalizeTags` /
   `findNearDuplicates`, and its `/arc-retro` step 3b wiring.
3. **The diff-derived query** — `diff-recall.mjs`, `deriveQuery` / `parseArgs` / `changedPaths`.

Plus the two gates shipped alongside them: `golden-check --gate` (including `parseGoldenHeader`)
and `lib/engines.mjs`'s `checkEquivalence`.
