# Phase 00 — per-organ counts, named exclusions, rebuild identity

Run on the live tree, 2026-08-11, at commit `6483522` (final Phase-00 state, after both adversarial passes). The spine was read through the reader
against the **main clone** (`ARC_SPINE_ROOT=E:/Work_Hub/01_Automemory/arc/.claude/state/hq`),
because this checkout is a linked git worktree and the spine deliberately refuses to resolve
inside one.

## Two consecutive rebuilds, count blocks byte-identical

```
root: C:/Users/ashiq/orca/workspaces/arc/arc-memory
counts (parsed/indexed):
  retro-log        54/54
  trial-ledger     49/49
  learning-ledger  4/4
  adr              150/150
  decisions        21/21  (reader returned 1005 event(s) from E:/Work_Hub/01_Automemory/arc/.claude/state/hq via ARC_SPINE_ROOT)
exclusions: 48 named, 2 malformed
wrote .claude/state/memory/index.json  (278 records)
```

54 + 49 + 4 + 150 + 21 = **278**. The second run deleted `.claude/state/memory` first; the count
block and the dumped record set were identical, compared as records (doc id + content hash in
index order), never as file bytes.

## The counts that changed, and why

Three of the five differ from the numbers the kickoff wrote down. All three were **measured** by
the adapter and the adapter is right.

| Organ | Kickoff said | Measured | Why |
|---|---|---|---|
| `retro-log` | 54 pattern / 10 scoreboard / 0 malformed | **54 / 10 / 0** | unchanged — the masking rule was already correct |
| `trial-ledger` | 37 records, 31 non-ledger rows | **49 records, 19 non-ledger rows** | 49+7+10+19 = 85 exactly. The kickoff's split summed to 85 only because its two wrong numbers were wrong in opposite directions |
| `learning-ledger` | 4 | **4** | unchanged |
| `adr` | 140 | **150** | this lane wrote ten ADRs during its own kickoff. See below |
| `decisions` | N/N | **21/21 of 1005 events** | first real measurement; the kickoff had no number. The 21st is this cycle's own approval receipt |

### Why the live tree pins no absolute number

`docs/adr/` went from 140 to 150 **during this cycle**, because writing decisions is what the
company does. A builder carrying a pinned 150 would fail the next time anybody records one, and a
gate that breaks on ordinary growth gets deleted — after which it protects nothing.

So the live tree is checked against an **invariant** (`N_parsed == N_indexed`) and nothing else.
Absolute counts are pinned only in fixture trees, which are frozen by construction.

## The exclusions: 48 named, 2 malformed

Every one carries its file and its line. The full listing is in the build output; the shape is:

| Organ | Count | Kind |
|---|---|---|
| `retro-log` | 10 | scoreboard rows (9 fields) — lines 30, 31, 32, 33, 40, 56, 67, 76, 80, 93 |
| `trial-ledger` | 7 | ledger table headers (column 1 is not a date) |
| `trial-ledger` | 10 | table separator rows |
| `trial-ledger` | 19 | non-ledger table rows (3 columns; the ledger is 5) |
| `learning-ledger` | 0 | none expected, and none found |
| `adr` | **2** | **both real**: ADR-0006 and ADR-0007 each carry two `**Status:**` lines, the second under `## Amendment`, so an amendment recording a new status would never be read. Found by the adversarial pass, then confirmed against the live files |
| `decisions` | 0 | every `decision.recorded` carried a valid closed payload |

**The malformed count is printed explicitly on every run**, so "nothing was excluded" and
"exclusions were never checked" cannot look alike on screen. `malformed` is a flag the adapter
sets when it makes the call — it is never re-derived by pattern-matching the exclusion's own
English message, because a classifier that greps its own prose silently reclassifies everything
the day someone rewords it.

The two malformed rows are worth stating plainly, because they are the whole point of the line
existing. An earlier version of the ADR status rule also flagged the **14** live ADRs written
`**Status:** accepted · 2026-07-09` — house style, not a defect. A gate that cries wolf on the
normal case makes its own count worthless, and the two real findings would have been invisible in
a list of sixteen. So the rule was narrowed to the genuine ambiguity: **two different status words
in one line**, which is what "Accepted, superseded by ADR-0801" looks like.

## The row that proves the masking rule

`docs/retro-log.md:28` — the 2026-08-02 `arc-model-policy` lesson. Its prevention text contains
`` `(?:^|\n)##` ``, a literal pipe inside a code span.

- naive split: **53 pattern / 10 scoreboard / 1 malformed**
- masked split: **54 pattern / 10 scoreboard / 0 malformed**

The row that the naive split discards is the lesson **about regex parsing bugs**. And
`N_parsed == N_indexed` holds perfectly in both cases, because an excluded row sits outside
`N_parsed` — the count-verify structurally cannot see a misclassification. That is why the fixture
asserts the classification directly.

## Real-system check

`git status --short` returns **zero lines** after a full rebuild against the live tree. Memory
wrote nothing outside `.claude/state/memory/`, which is gitignored. No organ was modified; no
event was emitted; `KINDS.length` is untouched.

## The bug this phase shipped and then caught

The first run reported `decisions 0/0` and looked fine. It was reading nothing: the reader's root
is the **spine** root (`.claude/state/hq`), not the repo root, and it had been handed the repo
root. `listDays()` finds no directory, returns `[]`, and the caller gets a confident empty answer
with no error anywhere — L-002 exactly, in the very phase whose fixture had to honour L-002.

Two changes came out of it. `spine.mjs` now re-exports `spineRoot()` so a consumer can ask the
reader where the spine is instead of guessing; and the builder prints the root it actually read
plus the event count it actually saw, so `0/0` can never again mean "never looked".
