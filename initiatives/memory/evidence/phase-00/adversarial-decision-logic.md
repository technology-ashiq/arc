# Adversarial pass 1 of 2 — decision logic

ADR-0708. Fresh `general-purpose` agent, 2026-08-11, against commit `eb62094`. It had not seen the
implementation being written and was given the source, the rules the code claims to enforce, the
existing fixtures, this lane's running list of already-fixed defects, and the instruction to walk
past it. Surface: field splitting, code-span masking, row classification, exclusion decisions, the
doc-id grammar, the count-verify. Paths, CRLF, quoting and OS differences were the other agent's.

**16 findings, 15 real, 1 rejected.** Every `actual` column below was observed by running the
input, not reasoned about.

| # | input | expected | actual | severity | disposition |
|---|---|---|---|---|---|
| 1 | `2026-08-02 \| arc-portfolio \| …` — markdown's own pipe escape, on a copy of the live organ | indexed, or a named exclusion | `retro-log 53/53`, `exclusions: 46 named, 0 malformed`, **exit 0**. The lesson is in neither list. `N_parsed == N_indexed` perfectly true | high | **fixed** — candidate accounting: any line carrying an unmasked pipe is a candidate, and every candidate is indexed or named. Fixture `a piped row that is not a lesson is NAMED, never skipped` |
| 2 | same shape in trial-ledger (leading pipe lost) and learning-ledger (`### learning:`, `####learning:`, `#### Learning:`) | a named exclusion — the file's own header promises it | all four: `records: 0  exclusions: 0` | high | **fixed** — same rule in all three adapters; the learning heading guard is now case-insensitive and `#{1,6}`. Fixture `a documented example…` and the loose-heading exclusion |
| 3 | build, then add `docs/adr/0999-brand-new.md`, then `--status` | `stale: YES` | `stale: no (manifest matches)` | high | **fixed** — the directory LISTING is a manifest input now. Fixture `an ADDED ADR makes the index stale` |
| 4 | an ADR carrying a template block: `**Status:** Proposed` inside a fence, real `**Status:** Superseded` below | the real status | indexed as `Proposed`; and a fenced `# ADR-XXXX: template heading` became the record's title | high | **fixed** — fence tracking on both scans, and a second `**Status:**` line is NAMED rather than silently ignored. **This one is live**: ADR-0006 and ADR-0007 each carry two Status lines under `## Amendment`, and the index now says so |
| 5 | insert one back-filled row at the top of 2026-08-02's block | the golden ids keep naming the same lessons, or the drift is caught | `retro:2026-08-02#6` and `#9` silently repointed at unrelated lessons. The gate still passes: the id still exists | high | **fixed** — `golden-queries.tsv` gains an `anchor` column of verbatim text, and `golden-check.mjs` asserts the resolved record contains it |
| 6 | `memory-expect.json` holding `[]`, `null`, `{}`, `5` | the pinned counts still fail the build | `exit 0` for all four, with no `expect` annotation printed at all | medium | **fixed** — the expectation file is a gate input, so every way of being unusable is exit 2. Fixture `a malformed expectation file is refused, never silently disarmed` |
| 7 | `\| 2026-8-11 \| appetite-sum \| … \|` (one-digit day) | indexed, or excluded as **malformed** | excluded as `expected`, with the reason "table header" — which was also untrue | medium | **fixed** — unknown is `malformed` in both adapters now; only the three shapes the file genuinely contains are `expected` |
| 8 | a 9-field scoreboard row with one code span covering four separators | a named `expected` exclusion; §B forbids bending a row to the nearest shape | indexed as a lesson with its cells scrambled, `exclusions: 0` | medium | **fixed** — an odd backtick count means the mask is a guess, so the row is refused rather than reshaped. Live corpus: 0 of 149 rows carry one |
| 9 | `… \| shell, \`sed -i, awk\`, parsing` | three tags | `["shell","\`sed -i","awk\`","parsing"]` | medium | **fixed** — **this is the twin-fix this lane's own pre-mortem named.** The pipe split was masked and the tag split one line below it was not. Fixture `a comma inside a code span is data too` |
| 10 | a fenced example row in trial-ledger and a fenced block inside a learning | documentation is not evidence | an invented gate run indexed as a recorded run; a fenced example supplied a learning's tags and links | medium | **fixed** — fence tracking in all three text adapters |
| 11 | `decision.recorded` with no `decides`, and with extra payload keys | the payload is CLOSED | both indexed; `decides` was read as `?? null` and extra keys were dropped in silence | medium | **fixed** — closed-key check, ULID check, self-decide check |
| 12 | `verify()` on a build whose spine was never read | a build with an unread organ is not a success | `failures: []`, exit 0, index written | medium | **fixed** — `unavailable` fails the build unless `--allow-missing-spine` |
| 13 | a learning block with a repeated key, and one with a wrapped value | a named defect; verbatim value | first value silently discarded; continuation line dropped | medium | **fixed** — repeated key is a named exclusion, continuation lines are appended |
| 14 | `**Status:** Accepted, superseded by ADR-0801` | not tagged `accepted` | tagged `accepted` | low | **fixed** — two known status words in one line is named. Deliberately does NOT flag `accepted · 2026-07-09`, which is house style on 14 live ADRs; an earlier version of the fix flagged all of them, and a gate that cries wolf on the normal case makes its own `0 malformed` line worthless |
| 15 | `0902-other.MD`, `docs/adr/archive/0903-sub.md`, and a directory named `0904.md` | named, not invisible | all silently absent from index and exclusions alike; the directory crashed with a bare `EISDIR` naming no path | low | **fixed** — case-insensitive match, `lstat`, every reject named, and every read failure names its file |
| 16 | `maskCodeSpans("a ``` b \| c ` d")` | CommonMark: no span, the pipe is a separator | the whole run masked | low | **rejected as its own finding** — real divergence from CommonMark, but every field-count-changing case it can produce is already refused by the odd-backtick rule from #8. Recorded here rather than fixed twice |

## What this pass says about the module

The masking rule was correct and the thing around it was not. Nine of the fifteen fixes are the
same sentence: **a line the parser did not understand left no trace.** The count-verify cannot see
that class at all, by construction — an excluded row sits outside `N_parsed`, and a row that was
never even considered sits outside both. `N_parsed == N_indexed` was true in every single one of
findings 1, 2, 7, 8 and 10.

Finding 9 is the one to keep. This lane's pre-mortem row 2 predicted the twin-fix shape *inside
this cycle* and named the two hooks as the likely site. It happened four lines apart in one file
instead — the masked pipe split and the raw comma split, in the same function, in the same commit.
The author read that function many times.
