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

| # | defect | where it was fixed | check it against | sweep (command + count) |
|---|---|---|---|---|
| P2-1 | An accepted-but-inert flag: the operator believes it took effect. (`--full-text`, Phase 01.) | `--decisions` refuses every argument it would otherwise drop in silence — a positional query, `--grep`, a contradicting `--source`, `--full` | `conflict-check.mjs`, `diff-recall.mjs`, `golden-check.mjs`: is there ANY flag combination where one argument is silently ignored? | `grep -rn "engineGiven" .claude/scripts/memory/` → **4 modes audited, 3 refusals added** (`--grep`, `--decisions`, `--full`) |
| P2-2 | `process.exit(0)` after writing stdout truncates on macOS pipes. The file's own closing note warned of it and **three branches did it anyway**. | `arc-recall.mjs` `--full` miss, `--grep --json`, and the new `--decisions --json` all `return` now | every `.mjs` in `.claude/scripts/memory/` — and the same class in `hq`/`evolve` scripts this lane touched | `grep -rn "process.exit(" .claude/scripts/memory/` → **31 sites found, 31 converted, 0 remaining** (incl. `memory-index.mjs`, the file the finding did not name) |
| P2-3 | A directive key grammar of `[a-z0-9-]+` matched the prose comment `@-directives` written directly above the directives it documents, so the fixture's own documentation refused the whole gate at exit 2. | `golden-check.mjs` keys must start with a letter | every other regex in this lane that parses a marker out of free text: the retro-log adapter's row grammar, `parseAliases`, the `--decisions` term splitter | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-4 | A lint token banned by proxy (`\.jsonl` = "raw spine access") fired on a file that was obeying the rule. Sanctioned **at the token, never at the line** — a `grep -v` on the filename would also mask a real bypass mentioning it on the same line. | `spine-reader-lint.sh` | any other allow/deny list in the lane: does it exempt a FILE where it should exempt a TOKEN, or a LINE where it should exempt a MATCH? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-5 | GNU-only shell in tests: `sed -i` takes a mandatory backup suffix on BSD, and `\t` in a sed regex is GNU-only. Passed on ubuntu and windows, failed on macOS alone. | `tests/memory-golden.bats` — rewritten with node | `memory-conflict.bats`, `memory-hook.bats`, `memory-recall.bats`, `memory-index.bats`, and any `.sh` this lane added | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-6 | A test pinned a hand-written sentence (`"sqlite arrives in Phase 2"`) that a later decision made false. | the `--engine` refusal enumerates the REGISTRY, which cannot go stale that way | every other assertion in this lane that pins prose rather than a derived value | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-7 | A new script not declared in `products/memory/manifest.json` is not synced, and the byte-identity gate only catches it on CI. | `conflict-check.mjs`, `diff-recall.mjs`, `lib/observe.mjs`, `lib/engines.mjs` all declared | is every file this phase added declared, and is every declared file present? | `grep -c "diff-recall.mjs" processes/review-diff.process.yaml .claude/commands/arc-review.md` → **2 and 2**; the twin (`conflict-check` in `/arc-retro`) re-checked at **1** |
| P2-8 | A new test file with no `tests/shard-timings.json` entry silently rides `_default_weight` 16. | all three new files measured at birth from their own CI run | any file added later in this phase | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-9 | Two hand-kept lists of the same names drift, and the one that drifts is the one the operator types against. | `--engine` names derive FROM `lib/engines.mjs` | `SOURCES` in `arc-recall.mjs` vs the adapters actually registered in `memory-index.mjs`; `PATH_NOISE`; `DECISION_FIELDS` vs the decisions adapter's real payload keys | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-10 | A gate that transforms what it measures must declare what the transform destroys. | `diff-recall.mjs` prints its dropped-token list and count, and reports paths left with nothing | `conflict-check.mjs` (no stoplist — is that stated?), `sanitizeQuery`, `tokenize` | — not swept: this class is not greppable, and saying so is the point of the column |

## Added after Phase 02's two passes — 30 findings, 30 fixed (2026-08-12)

The next pass in this lane carries these too. Every one below is a CLASS, and the question is
always the same: **was it fixed in the OTHER files?** Three of the thirty were literally P2-1,
P2-2 and P2-7 recurring in the file next door, which is the third twin-fix recurrence in this
lane and the reason this list exists at all.

| # | defect | where it was fixed | check it against | sweep (command + count) |
|---|---|---|---|---|
| P2-11 | **A printed contract that nothing asserts is a comment.** `TIE_BREAK` was a string the harness exported and printed; inverting bm25's comparator to id-DESCENDING left `--equivalence` and `--gate` both green at exit 0. | `checkTieBreak` / `tieBreakProbe` in `lib/engines.mjs`, asserted against an all-ties synthetic corpus whose build order is deliberately not its sorted order | every other sentence this lane PRINTS as a guarantee: the "reader-only" claim, the "resolves nothing" claim, the mandatory `HISTORICAL DATA` label, `sanitizeQuery`'s promises. Which of them does a test actually check? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-12 | **A closed set enforced on the field NAME and not on the field's VALUES.** `verdict:Reject` returned a confident zero byte-identical to a real miss, in the grammar whose header says it exists to prevent exactly that. | `DECISION_ENUMS` in `arc-recall.mjs` | every other enum-valued input in the lane: `--source` values (guarded), organ names, `kind` filters, alias table columns | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-13 | **A filter that can never match, neither refused nor noted.** `--lane` with `--decisions` is structurally impossible — the adapter emits no lane — and printed "showing 0 of 0", blaming the expression. | refused in `arc-recall.mjs`, while `--tag` was checked and deliberately left legal | every `applyFilters` field against every organ's real `fields` shape. Which filter/organ pairs are structurally empty? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-14 | **A count with no list.** `dropped` was computed, returned and printed nowhere; the operator saw a STATIC preview of the noise list, so an ADR number was reported as "an extension". | `diff-recall` prints the real tokens grouped by the reason each went | every exclusions/dropped/skipped count in the lane. `memory-index` prints its exclusions; do `conflict-check`, `golden-check` and the adapters print theirs, or only count them? (Two did not.) | `grep -rn "exclusions" .claude/scripts/memory/*.mjs` → **4 callers, 2 were dropping them** (`golden-check`, `conflict-check`); both now print |
| P2-15 | **SCANNED CLEAN and COULD NOT SCAN reported as the same answer.** An unquoted `for f in $FILES` fed awk two nonexistent paths and the pipeline's status was never read, so a planted bypass exited 0. | `spine-reader-lint.sh` — quoted read loop, per-file status checked, unscannable files are their own FAIL | every other scanner/gate in the repo that builds a report and treats "empty" as "clean" | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-16 | **An environmental failure reported as operator error.** A base git cannot resolve — a shallow checkout, a `master`-default repo — arrived as exit 2, "fix this", in a step ADR-0704 says can never block a review. | `diff-recall` returns exit 3, the WARN | every exit-code map in the lane: which codes mean "you typed it wrong" and which mean "your environment is like this"? Are they ever confused? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-17 | **A subprocess with no `cwd`** inherits `process.cwd()` while the data comes from `--root`, so two different repositories can be read in one run at exit 0. | `changedPaths(base, cwd)` | every `execFileSync` / `spawnSync` / `git` call in the lane and in the scripts it touches | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-18 | **The only test of a code path passes `--paths` while production passes `--base`.** Deleting the whole git subprocess left the suite byte-identical. | `_git_tree` in `memory-hook.bats` | for every CLI: which argument does the COMPILED command actually pass, and is that the one the suite drives? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-19 | **Speed encoded as registration order.** `auto` returned `avail[avail.length - 1]` under the words "prefers the fastest available". | `resolveEngine` prefers `canonical`, or a declared+measured `fasterThanCanonical` | every other "prefers"/"best"/"primary" selection in the lane. Is the preference a measurement or a position in a list? | — not swept: this class is not greppable, and saying so is the point of the column |
| P2-20 | **A tag/name normalizer asserted by nothing**, because every fixture value was already in normal form. The `String(t)` mutant passed all ten tests. | `_log_mixed_case` in `memory-conflict.bats` | every normalizer in the lane — `tokenize`, `sanitizeQuery`, `normalizeTags`, id grammars. Does any fixture exercise the form the normalizer exists to fold? | — not swept: this class is not greppable, and saying so is the point of the column |

## The sweep column — added by the Cycle 11 retro, 2026-08-12

Twin-fix has now recurred **five times across four lanes** (2026-08-03 engine, 08-04 evolve, 08-09
absorb, 08-10 absorb, 08-12 memory — the last one three times in a single phase). `CLAUDE.md`
already carries "grep the pattern, not the file"; a sixth written line would be the fourth
re-phrasing of a rule the retro-log holds four copies of, which is how a log stops being read.

So this is not another rule. The **"check it against"** column below is prose — an intention. It
gains a sibling that is a **command and a number, filled in at fix time**:

| check it against | sweep (command + count, filled AT FIX TIME) |
|---|---|
| every `.mjs` under `.claude/scripts/memory/` | `grep -rn "process.exit(" .claude/scripts/memory/` → **31 sites found, 31 converted, 0 remaining** | `grep -rn "process.exit(" .claude/scripts/memory/` → **31 sites found, 31 converted, 0 remaining** (incl. `memory-index.mjs`, the file the finding did not name) |

What actually closed the three recurrences in this phase was exactly that: running the grep across
the whole directory, converting every site in one pass, and re-verifying each CLI's exit codes end
to end — not checking the files one at a time and remembering to look next door. A blank that has
to be filled with a count is harder to skip than a sentence that has to be remembered.

**Honest limit:** this is a template change, not a mechanism. Nothing enforces it, and a determined
session can still write "checked" with no command. It is proposed because a mechanism that would
have caught P2-1 (a flag accepted-and-inert in three of four modes) does not exist — that one is
not greppable — and saying so plainly is worth more than a rule that pretends otherwise.

## The three surfaces this phase ships, which the passes must attack

1. **`--decisions` filter grammar** — `arc-recall.mjs`, `parseDecisionFilter` / `matchesDecision`.
2. **The near-duplicate detector** — `conflict-check.mjs`, `jaccard` / `normalizeTags` /
   `findNearDuplicates`, and its `/arc-retro` step 3b wiring.
3. **The diff-derived query** — `diff-recall.mjs`, `deriveQuery` / `parseArgs` / `changedPaths`.

Plus the two gates shipped alongside them: `golden-check --gate` (including `parseGoldenHeader`)
and `lib/engines.mjs`'s `checkEquivalence`.
