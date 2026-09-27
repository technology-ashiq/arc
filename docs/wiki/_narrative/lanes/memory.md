<!-- facts: appetite=cefdf849 blocked-on=a68c9074 burn=f72cb1a4 cycle=a1a957d1 depends-on=a68c9074 hasPlan=b5bea41b phase=43817889 status=4c1abf59 title=08c5f829 -->

# memory — playbooks + recall

## In plain words

A company that keeps every hard lesson it ever paid for in a filing cabinet nobody can search still
pays for each one again, one folder at a time. <!-- plain -->

`arc-recall` gives any session — human or process, in arc or any root-mode install — the company's
relevant recorded lessons, decisions and rules in under a second, verbatim and with canonical
citations, delivered automatically to the kickoff and review processes, so a lesson arc has already
paid for is never re-learned because nobody could find it. <!-- src: initiatives/memory/PLAN.md -->

### What it is building

Memory builds `arc-recall`, a search tool over five existing company organs it never edits —
`docs/retro-log.md`, `docs/trial-ledger.md`, `docs/develop/learning-ledger.md`, `docs/adr/`, and the
spine's own `decision.recorded` events — plus the index builder behind it and two additive hooks
landing as steps in `processes/kickoff-plan.process.yaml` and `processes/review-diff.process.yaml`.
<!-- src: initiatives/memory/PLAN.md#recompiled -->

It mattered because, measured on 2026-08-11, those organs already held 54 retro-log
pattern rows, 49 trial-ledger records, 4 learning-ledger blocks and 150 ADR files — real, true, and
not findable enough — with the only existing recall mechanisms being a manual whole-file read at
kickoff, one-hop typed links in develop's own Context Pack, and grep. <!-- src: initiatives/memory/PLAN.md -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| `arc-recall` | the search command | Takes a query and returns bm25-ranked, verbatim rows with a path-bearing citation on every one, in under a second. <!-- src: initiatives/memory/PLAN.md --> |
| adapter | one organ's reader | A pure function turning one company organ into indexable records; there are five, one per organ, each count-verified. <!-- src: initiatives/memory/PLAN.md --> |
| count-verify | nothing silently dropped | Every indexed row is checked (`N_parsed == N_indexed`), and every excluded row is named with its file and line rather than quietly skipped. <!-- src: initiatives/memory/PLAN.md --> |
| golden query | the twelve questions that must always work | Twelve queries and their expected answers, committed before any tuning begins, so the people grading recall cannot retune the grade. <!-- src: initiatives/memory/PLAN.md; ADR-0706 --> |
| root-mode | memory works with no lane at all | `lane` is provenance metadata only; the module proves a zero-lane fixture rather than assuming every install has lanes. <!-- src: initiatives/memory/PLAN.md; ADR-0707 --> |
| equivalence gate | two engines must agree | The canonical JS engine and the optional sqlite accelerator are checked against each other on the twelve golden queries, skipping visibly rather than silently wherever `node:sqlite` is unavailable. <!-- src: initiatives/memory/PLAN.md; ADR-0701 --> |
| near-duplicate check | a human decides, not a merge | Two or more shared tags plus a word-overlap threshold of 0.5 makes `/arc-retro` surface a possible contradiction before it appends a new rule; nothing auto-resolves. <!-- src: initiatives/memory/PLAN.md; ADR-0705 --> |
| alias layer | teaching the search different words for the same thing | A small hand-curated table of vocabulary substitutions, with no stemming and no embeddings. <!-- src: initiatives/memory/PLAN.md; ADR-0709 --> |

## How the work was planned

Appetite: five days, raised from an original four by the owner on 2026-08-11, once the
storage decision added a second engine to a cycle that was already fully committed at four days —
the kickoff's own recommendation was to keep four days and cut that engine first, and the owner chose
to fund it instead. <!-- src: initiatives/memory/PLAN.md; initiatives/memory/PROGRESS.md -->

Kill criteria: at fifty percent burn (2.5 days), if Phase 0 was not yet closed, a scope-cut
conversation became mandatory; at one hundred percent, cut or kill, never silently extend — and
because the appetite had already been raised once, a second extension would be a kill conversation
rather than a third number. <!-- src: initiatives/memory/PLAN.md -->

| REQ | User outcome | Phase | Status |
|---|---|---|---|
| REQ-01 | Every recorded lesson is in one searchable index | 0 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-02 | The right lesson in under a second | 1 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-03 | Kickoff receives recall without being asked | 1 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-04 | Past decisions are queryable, not archaeological | 2 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-05 | Contradicting rules meet a human, not a merge bot | 2 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-06 | Recall quality is a number, not a vibe | 2 | validated <!-- src: initiatives/memory/PLAN.md --> |
| REQ-07 | The fast engine is proven to agree with the reference | 2 | dropped <!-- src: initiatives/memory/PLAN.md --> |
| REQ-08 | Review receives recall without being asked | 2 | validated <!-- src: initiatives/memory/PLAN.md --> |

Three phases, risk-ordered: Phase 0 is the steel thread — the index exists and is honest; Phase 1 is
recall people can trust, with the CLI, sanitization, aliases and the kickoff hook; Phase 2 is
decisions, conflicts and proof, including the equivalence gate. <!-- src: initiatives/memory/PLAN.md -->

## The phases, one by one

Phase 0 — the index exists and is honest, 1.5-day appetite. It set out to build five adapters,
count-verified with named exclusions, an atomic rebuild, the twelve golden queries committed up
front, and the grep baseline measured before any claim to beat it. It closed 2026-08-11, one day
against its 1.5-day line: 31 of 31 memory tests green on all five OS-and-node combinations, live
counts of 54/49/4/150/21 = 278 records across the five organs, and two rebuilds with the index
deleted between them producing byte-identical record dumps. <!-- src: initiatives/memory/PROGRESS.md#dumps -->

Inside that same phase, two fresh-agent adversarial passes found 37 findings with exactly one
overlap between the two surfaces. <!-- src: initiatives/memory/PROGRESS.md#overlapped -->

Phase 1 — recall people can trust, 1.75-day appetite. It set out to ship the CLI, sanitization,
aliases, citations, sub-second answers on three operating systems, a root-mode fixture and the
kickoff hook. It closed 2026-08-11, 0.75 days against its 1.75-day line: the golden set scored 12 of
12 in the top three against a recorded bar of 5 of 12, and two fresh-agent adversarial passes found
27 findings with zero overlap, the worst being that the direct-invocation guard's own exact-URL check
failed under a symlinked path and let all three CLIs exit 0 doing nothing. <!-- src: initiatives/memory/PROGRESS.md#renegotiated -->

Phase 2 — decisions, conflicts and proof, 1.25-day appetite. It shipped `--decisions`, the
write-time conflict check, the golden-set CI gate, the equivalence contract and harness (the
sqlite engine itself was cut), and the review hook. It closed 2026-08-12, 1.0 day against its
1.25-day line: two adversarial passes
returned 30 findings and all 30 were fixed, with nothing accepted on a written reason instead. <!-- src: initiatives/memory/PROGRESS.md#highs -->

The sqlite engine itself was cut on its own measurement — the search it would accelerate took 0.42
milliseconds of a 199-millisecond wall clock — while the equivalence contract and its test harness
still shipped. <!-- src: initiatives/memory/PROGRESS.md#circular -->

## What it decided

| # | Decision |
|---|---|
| 0700 | MEM-A: index the organs in place; never create a second rule store. <!-- src: initiatives/memory/PLAN.md; ADR-0700 --> |
| 0701 | MEM-B: the pure-JS index is canonical; `node:sqlite` FTS5 is an optional accelerator behind an equivalence gate — re-decided at kickoff once measurement showed the module exists on only one of five OS-and-node combinations in CI. <!-- src: initiatives/memory/PROGRESS.md; ADR-0701 --> |
| 0702 | MEM-C: verbatim, prevention-first output; every row carries a path-bearing citation. <!-- src: initiatives/memory/PLAN.md; ADR-0702 --> |
| 0703 | MEM-D: reader-only; memory emits zero events and needs no policy rows. <!-- src: initiatives/memory/PLAN.md; ADR-0703 --> |
| 0704 | MEM-E: hooks are additive process-file steps, at eight results and a 1200-token budget. <!-- src: initiatives/memory/PLAN.md; ADR-0704 --> |
| 0705 | MEM-F: conflicts are surfaced at write time at a 0.5 threshold; semantic detection is out of scope. <!-- src: initiatives/memory/PLAN.md; ADR-0705 --> |
| 0706 | MEM-G: the golden set gates the build; the surfaced-to-cited rate stays observational forever. <!-- src: initiatives/memory/PLAN.md; ADR-0706 --> |
| 0707 | MEM-I: root-mode first; `lane` is provenance metadata only. <!-- src: initiatives/memory/PLAN.md; ADR-0707 --> |
| 0708 | MEM-J: two fresh-agent adversarial passes per parser surface, run inside the phase that ships it. <!-- src: initiatives/memory/PLAN.md; ADR-0708 --> |
| 0709 | MEM-K: a curated alias layer fixes vocabulary mismatch; no stemming, no embeddings. <!-- src: initiatives/memory/PLAN.md; ADR-0709 --> |

## Where it stands now

Status: IDLE. The cycle (arc-memory, Cycle 11) closed 2026-08-12, merged to `main` as `9581011`,
with 3 of 3 phases closed, 7 of 8 REQs validated and 1 cut, at a burn of 3.75 of 5 days (75%). <!-- src: initiatives/memory/PROGRESS.md -->

What is still open, in writing: the named per-job CI legibility for REQ-06's gate is deferred by an
owner ruling, since editing `.github/workflows/**` is denied on purpose; Phase 02 has no
`develop.started` or `slice.done` receipts and they were deliberately not backfilled; and the alias
layer ships empty and unearned — ten rows were written, then removed, because nothing measurable
changed. <!-- src: initiatives/memory/PROGRESS.md -->

The module has never run in a consumer repo — everything proven so far is proven on arc's own
corpus, and that limit is stated as the honest edge of this cycle's evidence. <!-- src: initiatives/memory/PROGRESS.md -->

## The bigger loop

### What went wrong and what was learned

- A gate printed its own contract and compared it against nothing: `TIE_BREAK` was just an exported
  string, so inverting the ranking comparator to id-descending left both `--equivalence` and `--gate`
  green at exit 0. <!-- src: docs/retro-log.md#TIE_BREAK -->
- A scanner could not tell having scanned clean apart from having failed to scan at all: an unquoted
  loop variable fed `awk` two nonexistent paths, and a planted bypass exited 0. <!-- src: docs/retro-log.md#awk -->

### How it connects to the rest of arc

- Memory reads the spine only through the existing reader library, and writes nothing to it —
  `KINDS.length` stays at 44 throughout the whole build. <!-- src: initiatives/memory/PLAN.md; ADR-0703 -->
- Two of its hooks land inside `processes/kickoff-plan.process.yaml`
  and `processes/review-diff.process.yaml`, both changed only through the generated-command
  discipline, never by hand-editing the compiled command. <!-- src: initiatives/memory/PLAN.md -->
- Landing the review hook required retiring another lane's migration proof — the engine lane's
  per-file byte-identity check — which this lane wrote as ADR-0207 in the engine's own ADR band, with
  the owner's explicit approval, because retiring it was that lane's decision to make, not this one's
  to assume. <!-- src: initiatives/memory/PROGRESS.md -->
- The Context-Pack-to-recall integration that `develop` might eventually want is explicitly named as
  a future `/arc-change` to the `develop` lane, not something this cycle touches. <!-- src: initiatives/memory/PLAN.md -->

## Glossary

- **adapter** — A pure function turning one company organ into indexable records; there are
  five adapters, one per organ. <!-- src: initiatives/memory/PLAN.md -->
- **count-verify** — The check that every parsed row was indexed and every excluded row is named by
  file and line. <!-- src: initiatives/memory/PLAN.md -->
- **golden query** — One of twelve committed queries with an expected answer, used to gate ranking
  quality before any tuning begins. <!-- src: initiatives/memory/PLAN.md; ADR-0706 -->
- **equivalence gate** — The check that the canonical JS engine and the optional sqlite engine return
  the same ordered results. <!-- src: initiatives/memory/PLAN.md; ADR-0701 -->
- **near-duplicate check** — The write-time comparison, on shared tags and word overlap, that
  surfaces a possible contradiction to a human rather than resolving it automatically. <!-- src: initiatives/memory/PLAN.md; ADR-0705 -->
- **root-mode** — Working with no lane at all; `lane` is recorded only as provenance, never
  required. <!-- src: initiatives/memory/PLAN.md; ADR-0707 -->
- **alias layer** — A hand-curated alias file that drives deterministic query expansion, fixing the
  vocabulary mismatch between a query's words and the organs' own words. <!-- src: initiatives/memory/PLAN.md; ADR-0709 -->
