# REQ-06 / REQ-07 — the measured gate output, phase 02

ADR-0706 asks for the comparison table in evidence, and ADR-0701 for the equivalence verdict.
Both are pasted verbatim below from a real run, not summarized. The corpus is the repo's own,
built with `--allow-missing-spine` because this worktree carries no spine (the decisions organ
is knowingly absent and no golden row names a decisions id).

## `golden-check --gate`

```
golden-check: 12/12 anchors resolve
  G01 HIT  @1  which ADR closed the spine event kind vocabulary
  G02 HIT  @1  duplicate receipts silently lost idem preimage
  G03 HIT  @1  can two lanes emit in parallel worktree mode B
  G04 HIT  @1  author wrote breaking inputs all caught fresh agent found holes
  G05 HIT  @3  exit 0 but receipts quarantined fire-and-forget
  G06 HIT  @2  appetite sum warned zero slack inverted fire
  G07 HIT  @1  two sessions same ADR numbers collision century
  G08 HIT  @1  markdown heading regex anchored line start prose mention
  G09 HIT  @2  apostrophe single-quoted shell embedded node broke
  G10 HIT  @2  when is a cycle officially closed which document
  G11 HIT  @1  test passed while executing nothing vacuous
  G12 HIT  @1  who approves a learning promotion fresh agent owner
golden-check: 12/12 queries hit an expected id in the top 3

  surface           top-3 hits   of   source
  grep baseline              5   12   tests/fixtures/memory/golden-queries.tsv @baseline-grep-top3
  arc-recall (js)           12   12   measured this run
  delta                      7        module minus grep

  embeddings trigger (ADR-0706) needs ALL THREE:
    top-3 precision < 10/12 .......... not met  (live 12/12)
    >= 3 alias-iteration fixes ......... not met  (live 0)
    corpus >= 2x the recorded size ..... not met  (live 262, recorded 278, bar 556)
    => embeddings are NOT discussable; below the bar a miss is fixed with an alias.

golden-check: GATE PASSED -- 12/12, beating the grep baseline of 5 by 7.
```

The bar is NOT in this script. `@baseline-grep-top3 5`, `@baseline-corpus-records 278` and
`@expected-rows 12` all live in `tests/fixtures/memory/golden-queries.tsv`, so moving the bar is
a visible change to the file that records it. `@expected-rows` exists because the gate could
otherwise be passed by DELETING the row that failed (adversarial finding 4/5, 2026-08-12).

## `golden-check --equivalence`

```
equivalence: tie-break is id-ascending on equal bm25 -- two engines agree only on the same ORDERED ids, never merely the same set
equivalence: tie-break probe on js: HELD -- returned [probe:a, probe:b, probe:c], contract says [probe:a, probe:b, probe:c]
equivalence: engine(s) available: js
equivalence: only 1 engine is registered, so NOTHING WAS COMPARED. This run proves DETERMINISM (the engine returns identical ordered ids on a second call) across all 12 golden queries -- it does not and cannot show that two engines agree.
equivalence: PASSED -- 12/12 golden queries held, as determinism only, and the tie-break probe HELD on 1 engine(s).
```

`NOTHING WAS COMPARED` is the honest verdict with one engine registered: a green that cannot
tell *they agree* from *there was nothing to compare* is the vacuous pass wearing a gate's
clothes. The tie-break line above is an ASSERTION against an all-ties synthetic corpus, not a
slogan — for one commit it was a string this file printed and nothing compared against, and
inverting bm25's comparator to id-DESCENDING left both gates green at exit 0.

## Demonstrated failing before being trusted

| Mutant | Gate before | Gate after |
|---|---|---|
| One planted golden miss | red | red (live negative control in `memory-golden.bats`) |
| Delete the golden row that fails | **GREEN — the defect** | red, via `@expected-rows` |
| Invert bm25's tie-break to id-DESCENDING | **exit 0 — the defect** | exit 1, verified by applying and reverting the real mutant |
| A module that only EQUALS grep | red on its own separate condition | unchanged |
