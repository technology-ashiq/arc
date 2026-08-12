# Adversarial pass 1 of 2 — query decision logic

ADR-0708. Fresh `general-purpose` agent, 2026-08-11, against `1e5a79e`. Not shown the
implementation; given the source, the rules it claims to enforce, the existing fixtures, this
lane's running defect list, and the instruction to walk past it. Surface: tokenization,
sanitization, BM25F, the tie-break, alias expansion, filters, result selection.

**12 findings, 11 fixed, 1 accepted with a reason.**

| # | input | expected | actual | sev | disposition |
|---|---|---|---|---|---|
| 1 | back-fill a row into `trial-ledger` dated 2026-07-22, rebuild, `golden-check --rank` | G06 must fail — `trial:2026-07-22#1` now names a fabricated row | `12/12 anchors resolve`, `12/12 hit`, exit 0 — and the fabricated row was G06's **rank-1 hit** | high | **fixed** — the ranked hit must now carry the anchor itself. `checkAnchors` used `some()` and `rank` used `includes()`, so on a multi-id row **the two checks never had to name the same record**. True on the *untouched* corpus too: G06's anchor sat on `#19`/`#28` while ranking hit `#22`. Phase 02 wires this as the CI gate |
| 2 | patch `sanitizeQuery` to DROP `near/and/or/not/a/b/foo`, replay all ten hostile fixtures | the mutant does the one thing rule 1 forbids, so they must go red | **all ten pass**, identical to the clean tree | high | **fixed** — the fixtures asserted exit 0 plus the query echoed back, and the echo is `argv`, never the tokens. They now assert the tokens the engine actually searched, and a **mutant control** proves the assertion can fail |
| 3 | `--since 1900-01-01` with G01's own query | `adr:0026` — older than every record | `5 of 103`; adr:0026 absent. `--since` kept **0 of 150 ADRs and 0 of 4 learnings** | high | **fixed** — a dateless record yields `""` and `"" >= anything` is false, so any `--since` deleted 154 of 257 records with no note. Dateless records are now counted and named |
| 4 | `--source retro-log --limit 5 "trial"`, then `--limit 50` | the matching retro-log record | limit 5: `0 of 54` + *"no recorded lesson matched"*. limit 50: it is there | high | **fixed** — ranking ran globally then filtered then sliced, so a filter could starve the set and the CLI then stated positively that nothing matched. Filtering happens **inside** scoring now |
| 5 | append a 4-cell row to `aliases.md` | named with its line, as the organ adapters do | `ALIAS ROWS 0 EXCLUSIONS 0` — silent | high | **fixed** — bare `continue`, i.e. **Phase 00's entire lesson in the one file where the fix was never made**. Both callers also discarded `exclusions`; they surface as notes now |
| 6 | `--grep "vacuous"` vs the ranked query | the escape valve should not be blind where ranking works | ranked: 3 hits. grep: **0**. 163 words live only in tags | medium | **fixed** — grep now searches tags too. Ranking weights tags at 4, and the zero-result banner sends the searcher to grep precisely when ranking has failed them |
| 7 | add an em-dash `@test` and bump the literal | the self-count should catch a dropped test | `grep -c` = 22 while one name is non-ASCII | medium | **fixed** — `bats --count` asks bats what it **registered**, instead of comparing a grep over the source to a hardcoded number |
| 8 | an unclosed fence above the alias table | should not consume the real rows | `rows=0 exclusions=0` | medium | **fixed** — the parser is scoped to the `## The rows` section, and fenced rows are named |
| 9 | `"query" --grep "other"`; `--full id --since … --source …` | honour both, or say one was discarded | the positional query and both filters vanished with no note | medium | **fixed** — the combinations are refused at exit 2 rather than silently answering a question nobody asked |
| 10 | `sanitizeQuery` on 3000 CJK characters | the printed note is a checkable claim | note says *truncated to 4096 bytes*; **8192 bytes retained** | low | **fixed** — the ceiling was checked in bytes and enforced in code points. It cuts by bytes now and prints the real figure |
| 11 | `--limit 0` | refused, or distinguishable from a miss | byte-identical to a genuine zero result | low | **fixed** — refused at exit 2 |
| 12 | two chained alias rows, in each file order | documented behaviour, either way | row order changed the expansion | low | **fixed** — expansion iterates to a bounded fixed point, so a documentation reorder cannot change results |

## Held up, and reported so they are not re-attacked

`idf` uses the Lucene form and stays positive even for a term in every document. A scan of 2014
adjacent result pairs found **71 exact ties, all correctly id-broken, and 0 epsilon ties**, so the
documented tie-break is intact on this corpus. A two-row alias cycle terminates. Repeated query
tokens are deduped and do not multiply score. Astral-plane slicing produces no lone surrogates.
