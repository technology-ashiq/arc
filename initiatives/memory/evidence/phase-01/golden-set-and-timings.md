# Phase 01 — the golden set against the grep baseline, and the timings

Measured on the live corpus (278 records) on 2026-08-11, owner box, Node v24.18.0.

## The before/after table

| configuration | golden queries hitting an expected id in the top 3 |
|---|---|
| grep, pinned Phase-00 method | **1 / 12** |
| grep, ORACLE — the rarest content word, grep's best case given a searcher who already knows the recorder's vocabulary | **5 / 12** |
| **bm25 tag-weighted, no aliases** | **12 / 12** |
| bm25 tag-weighted, with a 10-row alias table | **12 / 12** |

**5 / 12 is the bar** — recorded as such in Phase 00 precisely so it could not be renegotiated
here. The module clears it at 12/12, eight of them at rank 1.

Per query, with the shipping configuration:

| # | rank | query |
|---|---|---|
| G01 | 1 | which ADR closed the spine event kind vocabulary |
| G02 | 1 | duplicate receipts silently lost idem preimage |
| G03 | 1 | can two lanes emit in parallel worktree mode B |
| G04 | 1 | author wrote breaking inputs all caught fresh agent found holes |
| G05 | 3 | exit 0 but receipts quarantined fire-and-forget |
| G06 | 1 | appetite sum warned zero slack inverted fire |
| G07 | 1 | two sessions same ADR numbers collision century |
| G08 | 1 | markdown heading regex anchored line start prose mention |
| G09 | 2 | apostrophe single-quoted shell embedded node broke |
| G10 | 2 | when is a cycle officially closed which document |
| G11 | 1 | test passed while executing nothing vacuous |
| G12 | 1 | who approves a learning promotion fresh agent owner |

## Finding 1 — the alias layer is unearned, and ships empty

The last two rows of the first table are the result worth reporting. A 10-row alias table was
written first, one row per golden query, then removed — **and nothing changed.** Not one row was
load-bearing.

ADR-0709 says a row exists because a real query missed. There are no misses, so there are no rows.
`docs/memory/aliases.md` ships with the mechanism live, fixture-tested, and the table empty, with
the measurement recorded in the file itself.

The sharpest case is **G10**. The word `officially` appears **zero times in the entire corpus** —
the cleanest vocabulary mismatch in the set, and the row the alias layer was designed around. It
hits at rank 2 regardless, because `cycle`, `closed` and `document` carry it there.

**So ADR-0709's premise is weaker than the design assumed.** Vocabulary mismatch is real — the
grep numbers prove a searcher's words differ from a recorder's — but bm25 over a tag-weighted
inverted index already absorbs it, because a query rarely misses on *all* its words at once.
Reported, not acted on: narrowing ADR-0709 is the owner's call.

**And a caution on the 12/12 itself.** The golden queries were authored by this lane at kickoff.
They were committed before any code existed, which stops them being *tuned*, but it does not stop
them having been *easy* — a query written by someone who has just read the corpus shares
vocabulary with it. The grep-oracle at 5/12 shows they are not trivially findable, but 12/12 with
no alias help suggests the set is not as hostile as the design assumed. The honest next
measurement is a golden query written by someone who has not read the answer.

## Finding 2 — REQ-07's speed premise is disproven, exactly as the ledger predicted

The assumptions ledger says: *"Wrong-low (the likely case): nothing exceeds 500ms, measured in
Phase 1 before Phase 2 opens → REQ-07's speed premise is disproven, and that is reported, not
acted on."*

| measurement | value |
|---|---|
| worst end-to-end, `node arc-recall.mjs <query>`, median of 3, all 12 queries | **199 ms** |
| mean end-to-end | 185 ms |
| index load — parsing the 0.43 MB `index.json` | 6.9 ms |
| **the search itself, worst of all 12 queries** | **0.42 ms** |

The trigger fires. Nothing comes near 500 ms, and the decisive number is the last row: **ranking
is 0.42 ms of a 199 ms wall clock.** The rest is node process startup. A sqlite accelerator would
be accelerating 0.2% of the elapsed time — it cannot make `arc-recall` meaningfully faster on this
corpus, at any level of engineering.

Per the ledger, this is **reported and not acted on**: the owner already chose on 2026-08-11 to
fund REQ-07 rather than cut it. This measurement becomes the evidence behind ADR-0701's
"delete it rather than maintain a second engine" revisit trigger a cycle from now, and the
equivalence gate remains worth building on its own merits — it is the thing that would catch a
second engine disagreeing with the reference, whether or not that engine is fast.

## The exit map, verified through real process invocations

| exit | meaning | verified by |
|---|---|---|
| 0 | ran — **zero results is a result** | a gibberish query prints "no recorded lesson matched … That is a result, not an error" |
| 2 | bad usage | `--nonsense`, `--limit abc`, `--limit -3`, `--source nope`, `--since 11-08-2026`, `--engine sqlite`, a doubled `--tag`, and no query at all |
| 3 | index unavailable and the rebuild also failed | an organ deleted after the index was removed: exits 3 naming `trial-ledger` |
| 1 | internal error | reserved; no fixture provokes it, and that is stated rather than faked |

## The ten hostile queries

Nine cross `argv`; one cannot, and says so. `NEAR(a,b)`, `*`, `-foo`, `he said "never`,
`AND OR NOT`, `a" OR "1"="1`, `../../etc/passwd`, an accented/emoji query, and a 20 000-character
query all exit 0 and are echoed back verbatim — made literal, never dropped.

The tenth is a literal NUL, which **cannot survive process creation on either platform**. It is
tested through the internal API and labelled as such, because an `argv` fixture claiming to carry
a NUL would be testing nothing — the vacuous-pass shape this repo has shipped three times.

The long query is bounded at the byte ceiling **and says so** (`note: query truncated from …`): a
silent truncation is a query nobody knows was not the one they asked.
