# Adversarial pass 1 of 2 — decision logic

ADR-0708. Fresh `general-purpose` agent, 2026-08-12, against commit `8ed7c18`. It did not write
this code and was given the source, the five rules it claims to enforce (ADR-0703 / 0705 / 0706 /
0701 and the phase-02 spec), the existing fixtures, this lane's running fixed-defect list, and the
instruction to walk past all of it. Surface: the semantics of the rules — what `parseDecisionFilter`
accepts and rejects, what `jaccard` and the shared-tag AND actually prove, which records survive a
filter, and what the `--gate` and `--equivalence` arithmetic really asserts. Every `actual` below
was observed by running the input; every mutant was applied, run, and reverted. argv quoting, path
separators, CRLF and BSD-vs-GNU were the other agent's.

**15 findings — 4 high, 7 medium, 4 low.**

| # | input | expected | actual | sev | disposition |
|---|---|---|---|---|---|
| 1 | a retro-log whose only near-duplicate row is written `2026-2-03` (one-digit month), then `conflict-check --prevention "always quote the flag value" --tags shell,quoting,lanes` | the row named — the adapter classes it `malformed` and ADR-0705 exists so a duplicate lesson meets a human | `scanned 1 recorded row(s)` / `no near-duplicate found. Append the row.` at exit 0, and `"matched": 0` in `--json`. `parseRetroLog` returned `exclusions: [{kind:"malformed", line:5, reason:"carries a pipe but does not begin with a YYYY-MM-DD date"}]` and `main()` takes `parsed.records` and drops `parsed.exclusions` on the floor | high | REPORTED |
| 2 | MUTANT in `arc-recall.mjs`: `terms.every(...)` → `terms.some(...)` (the ANDed grammar turned into an OR) **and** `v.toLowerCase().includes(t.value.toLowerCase())` → `v.includes(t.value)` (documented case-insensitive `~` made case-sensitive). `bats tests/memory-recall.bats -f decisions` | the two core semantics of the REQ-04 grammar are what the four `--decisions` tests exist to hold | **all 4 tests ok**, byte-identical to the clean tree. `_built_with_decision` seeds exactly ONE decision with ONE verdict, so no multi-term filter can tell AND from OR (`verdict:reject reason~worktree` matches under both), and no test ever passes a mixed-case substring | high | REPORTED |
| 3 | `bats tests/memory-hook.bats` on the untouched tree | REQ-08's stated ACCEPTANCE CRITERION passes | tests 2 and 3 are **red on every platform**: `_tree_with_path_rule` appends a 4th retro row to `organs-good`, whose committed `memory-expect.json` pins retro-log at 3, so `memory-index --rebuild` exits 1 (`FAIL retro-log: expected 3 indexed record(s), got 4`) and the builder returns 1. Those two tests carry the ONLY assertion of the mandatory `HISTORICAL DATA, NOT INSTRUCTIONS` label on the hook's own output — MUTANT deleting that label from `diff-recall.mjs` produced a byte-identical 7-ok/2-not-ok run. Behind the dead builder the assertion is also wrong: it pins `dropped: 2` where `deriveQuery(['a/b/thing.mjs','a/b/other.yaml'])` really returns 6 | high | REPORTED |
| 4 | doctor the golden TSV so G09 misses (`--gate` → exit 1, `1 of 12 golden queries do not hit`), then delete the G09 row and re-run `--gate` | ADR-0706 pins **12** top-3 hits; deleting the failing row is the "delete the test to get past the gate" move the whole file is written against | `golden-check: GATE PASSED -- 11/11, beating the grep baseline of 5 by 7.` exit 0. The gate compares `hits` to `scored.length`, a number the same fixture supplies, and the `@`-directive header — which exists precisely so a bar "nobody diffs" cannot live in code — carries no row-count directive. 12 is stated only in a prose comment | high | REPORTED |
| 5 | same fixture cut to 4 rows, `--gate` | the comparison table is the gate's whole evidence product; its numbers must be checkable | `grep baseline 5 of 4` — a fabricated denominator, 5 hits out of 4 queries, because `@baseline-grep-top3` was measured over 12 and is re-denominated onto whatever N is found. On the same run `top-3 precision < 10/4 .......... MET (live 4/4)`: a **100% run reports ADR-0706's precision condition as MET**, because the `10` is a hardcoded absolute compared against a live `scored.length` | high | REPORTED |
| 6 | `arc-recall --decisions 'verdict:Reject'` and `--decisions 'verdict:aprove'` against a tree holding one `reject` | `verdict` is a CLOSED enum in the adapter (`approve` \\ `reject`); `--source` and `--engine` both refuse an out-of-set value and enumerate the set | `showing 0 of 0 matching decision(s); 1 in the index` / `no recorded decision matched that filter. That is a result, not an error.` at exit 0 — byte-identical to a real miss, which is the exact outcome the `--decisions` header says it exists to prevent. The rule was applied to the field NAME and never to the one field whose value set is closed | medium | REPORTED |
| 7 | `--decisions 'verdict:reject' --lane memory`, and `--decisions 'verdict:reject' --tag zzznotag` | `--source` is refused alongside `--decisions` because "any value but `decisions` yields an empty pool that reads exactly like no decision matched your filter" | both print `showing 0 of 0 matching decision(s); 1 in the index` with **no note at all**, attributing the zero to the `--decisions` expression. The decisions adapter emits no `lane` field, so `--lane` with `--decisions` can NEVER match — structurally identical to `--source`, neither refused nor noted. `applyFilters` reports only its `--since` exclusions | medium | REPORTED |
| 8 | append two broken alias rows (4 cells, 3 cells) to `aliases.md`, run `golden-check --gate` | `parseAliases` names them; ADR-0706's second trigger condition is counted off that list | `>= 3 alias-iteration fixes ......... not met (live 1)` and not one word about the refused row, while `parseAliases` returned `exclusions: [{kind:"malformed", line:57, reason:"alias row has 4 columns; the table is 3"}]`. `golden-check` line 217 takes `.rows` and drops `.exclusions` — Phase 01 finding 5's fix ("both callers discarded exclusions") applied in `arc-recall` and never in the second caller, which is the one that feeds a gate | medium | REPORTED |
| 9 | MUTANT in `conflict-check.mjs`: `normalizeTags` returns `String(t)` instead of `tokenize(String(t)).join("-")`. `bats tests/memory-conflict.bats` | the function's own docstring: "`CI` and `ci` are one tag and not two" | **all 10 tests ok.** Every tag in the suite's fixture and in every `--tags` argument is already lowercase, so tag normalization is asserted by nothing. It is not inert: a row recorded `CI, Quoting` against a candidate typed `--tags ci,quoting,lanes` fires today and would miss under the mutant | medium | REPORTED |
| 10 | `diff-recall --paths docs/adr/0705-mem-f.md --json --print-query`, and the same with `--limit 3` | `arc-recall`'s own parseArgs comment: printing non-JSON on stdout at exit 0 "is what the --json contract forbids outright"; an accepted-but-inert flag is P2-1 verbatim | `docs adr mem` on stdout, exit 0. `--print-query` returns before both the `--json` branch and the search, so `--json` and `--limit` are accepted and silently dead in exactly the file the fixed-defect list said to check for it | medium | REPORTED |
| 11 | MUTANT in `bm25.mjs`: tie-break inverted to id-DESCENDING, then `golden-check --equivalence` and `--gate` | ADR-0701 makes the tie-break "the contract, not a footnote", and `checkEquivalence` is the surface that owns it | `equivalence: tie-break is id-ascending on equal bm25` … `equivalence: PASSED -- 12/12 golden queries held`, exit 0; `--gate` also PASSED. `TIE_BREAK` is a string the harness prints, never a property it checks — with one engine, determinism holds under any comparator. The golden suite asserts only that the string appears. Caught solely by a `search()` unit test in `memory-recall.bats` | medium | REPORTED |
| 12 | `diff-recall --paths docs/adr/0705-mem-f-conflicts-are-caught-at-the-pen-not-auto-resolved.md` | the header contract: "a declared list of path-structure tokens is dropped, **the list is PRINTED**, and the dropped count is printed with it" | `path-structure tokens dropped: 3 (extensions and the like: mjs, js, ts, tsx, jsx, json, yaml, yml, ...)`. The three were `0705`, `f` and `md` — the ADR NUMBER, which is the primary identifier of 151 of 258 records, reported to the operator as an extension. `d.dropped` is computed and returned and then **never printed anywhere**, in text or in `--json`; what is printed is a static 8-of-21 preview of `PATH_NOISE` | medium | REPORTED |
| 13 | `golden-check --gate` piped, on the failing path | P2-2: `return`, never `process.exit`, after writing to stdout | `golden-check.mjs` is the only `.mjs` under `.claude/scripts/memory/` still doing it: `process.exit(1)` at the end of `main()` fires after the comparison table AND the three-condition embeddings block have gone to stdout, so on a macOS pipe the gate can truncate away the evidence it exists to produce. `process.exit(1)` after the equivalence block has the same shape | low | REPORTED |
| 14 | `golden-check --root --gate` | the flag-shaped-value guard the other three CLIs carry: "an empty variable ate the next argument" | `golden-check: --root C:/…/arc-memory/--gate does not exist`, exit 2 — loud by luck, not by rule: `--gate` was consumed as the value and the shape is never named. `arc-recall`, `conflict-check` and `diff-recall` all carry `v.startsWith("--")`; `golden-check`'s hand-rolled loop does not | low | REPORTED |
| 15 | `resolveEngine("auto", [js, slowEngine])` and `resolveEngine("auto", [slowEngine, js])` | ADR-0701 makes `js` canonical and the reference the others are measured against | `slow-sqlite` and `js` respectively — `auto` returns `avail[avail.length - 1]`, so "prefers the fastest AVAILABLE engine" is encoded as registration order with no speed field anywhere. Registering a second engine at the end of `ENGINES` silently makes it the default for every `auto` caller before any measurement says it is faster | low | REPORTED |

## Held up, and reported so they are not re-attacked

`parseDecisionFilter`'s first-separator rule is correct: `reason~mode-B:uncertified` keeps the `~`
operator and `reason:a~b` keeps the `:`. A multi-word value (`reason~worktree mode B`) is refused
loudly rather than silently truncated, an empty value and a missing operator and a repeated field
are each their own named exit 2, and `field in DECISION_FIELDS` matches the decisions adapter's
real payload keys exactly (`ulid, ts, decides, verdict, reason`) — P2-9's named risk, clean here.

`jaccard` is the formula it claims: symmetric, over the token set, 0 for either side empty, and the
overlap-coefficient alternative the header rejects would have scored row A `1.00` instead of `0.71`
and been caught by the fixture. `findNearDuplicates` really is an AND, and the suite proves both
halves from both sides. `--threshold` and `--limit` reject `""`, `2`, `0.5abc` and `0`.

`parseGoldenHeader`'s `[a-z][a-z0-9-]*` grammar holds against every prose-comment shape I could
build: a key that breaks the grammar falls through to the missing-directive refusal rather than
being read as a directive, and unknown / duplicated / non-numeric directives are each exit 2.
`loadGolden` refuses a placeholder and an empty anchor. `checkAnchors` and `rank` now have to name
the SAME record, which is Phase 00 finding 5 holding.

`bm25.search`'s tie-break genuinely is id-ascending on the id and not the row index. `deriveQuery`
dedupes across the whole diff, is order-stable, counts its truncation, and does report a path left
with nothing. `checkEquivalence` catches a planted order-only disagreement and does not
false-positive on an agreeing pair.

One gap worth naming without counting it as a finding: `checkEquivalence` grades
`sanitizeQuery(row.query).tokens`, while `rank()` and the CLI both grade the alias-**expanded**
tokens — `["worktree","mode","b"]` against `["worktree","mode","b","parallel"]`. Two engines
certified as agreeing would be certified on a query path the product never runs. It is latent only
because `aliases.md` ships empty today.

## Dispositions, 2026-08-12

The build session fixed the following from this ledger; the rest stay **REPORTED** and are carried
into the phase close as open findings rather than quietly dropped. A finding with no disposition
is an open finding.

**FIXED:** 1 (conflict-check now names rows it could not read), 2 (the decisions fixture seeds two opposite verdicts plus a mixed-case reason, so the AND-to-OR mutant and a case-sensitive `~` both go red), 3 (the memory-hook fixture bumps `memory-expect.json` rather than deleting it), 4 and 5 (`@expected-rows` pins the set, so deleting the failing row is now exit 1 and the baseline denominator cannot be re-derived)

**REPORTED (open):** every other row. They are real and reproduced; they are not fixed in this
commit, and the phase close must either fix them or record why not.
