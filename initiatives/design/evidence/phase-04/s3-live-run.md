# Phase 04 S3 -- EXP-A1 live run (lexos-case-workspace-expa1)

Text only, per the owner ruling of 2026-09-16: the HTML and PNGs stay local under the gitignored
`docs/design/explore/` and `.claude/state/design/`. Decision: [ADR-1421](../../../../docs/adr/1421-exp-a1-composer-seat-stays-balanced-workhorse-inside-the-new-regime.md).

- Explore: `lexos-case-workspace-expa1`, base `17044b62`, brief `docs/design/briefs/lexos-case-workspace/brief.md`
- Seal: [`seal-lexos-case-workspace-expa1.json`](seal-lexos-case-workspace-expa1.json), 10 bundle files, ADR-1416 prediction, sealed 2026-10-05T07:16:04.249Z, before any composer armed
- `seal-check` after the run: **10 file(s) match the seal** (exit 0). The failing control (one byte flipped) is pinned on CI in `tests/design-expa1.bats`, green at `8f0e39be` (19/19 jobs)
- Divergence call (director): structure 6 of 7 dimensions, art direction 3 of 4 axes -- PASS
- Gates on all six variants: surfaces, coverage, self-review (8 rows), `check` -- all PASS

## Composer invocations (tier and pairing, checked by hand per the debt-ledger row on 67551f8 B2)

| variant | thesis | tier (arm) | how the tier was set |
|---|---|---|---|
| a | command center | balanced-workhorse | ui-composer's own `model:` (sonnet) |
| b | guided workflow | balanced-workhorse | ui-composer's own `model:` (sonnet) |
| c | narrative record | balanced-workhorse | ui-composer's own `model:` (sonnet) |
| d | = a (sha `4d4a0c6a799810ac`) | high-judgment | per-invocation override `model: opus` |
| e | = b (sha `2f22ff4907783383`) | high-judgment | per-invocation override `model: opus` |
| f | = c (sha `936f96604f5e7dbd`) | high-judgment | per-invocation override `model: opus` |

Every composer got the same prompt, differing only in the variant letter.

## Deviations, logged

1. **First dispatch armed six composers at once.** The read boundary allows one; all six were
   refused before writing anything, and the run restarted serially. No output was lost.
2. **The first prompt omitted the brief text and the surface markers.** variant-a's first build
   failed the surface gate and got a markup-only fix (no render); b-f had the line up front.
3. **variant-c carried one colour literal** (`.btn:hover{background:#000}`), caught by `check`
   and moved to tokens; the iter-3 render hashed identical to iter-2.
4. **The gates did not judge d/e/f** until `c9094cd0` (found live: compose-done printed "3 of 3").
   d was gated by the fixed script before the jury; all six pass after the fix.
5. **Two jurors, not three.** `design-jury-hj` was refused by the session's permission
   classifier and was not worked around.

## Jury (N=7, seed 20261005, key sha `3e276c11...`; `jury-check`: 2 rankings, 0 deviations)

| juror | ranking, unblinded (best first) |
|---|---|
| 1 | f > c > d > e > a > b > reference |
| 2 | f > d > c > e > a > b > reference |

## Owner blind score (2026-10-05T11:21:12Z, `note.logged` receipt)

| item | source | score |
|---|---|---|
| e | variant-a (balanced-workhorse) | 59 |
| g | variant-d (high-judgment) | 58 |
| b | variant-e (high-judgment) | 48 |
| d | reference | 40 |
| f | variant-b (balanced-workhorse) | 35 |
| a | variant-f (high-judgment) | 27 |
| c | variant-c (balanced-workhorse) | 25 |

## `exp-a1` output

```
thesis 4d4a0c6a799810ac -- balanced-workhorse 59, high-judgment 58 -> balanced-workhorse
thesis 2f22ff4907783383 -- balanced-workhorse 35, high-judgment 48 -> high-judgment
thesis 936f96604f5e7dbd -- balanced-workhorse 25, high-judgment 27 -> high-judgment
high-judgment won 2/3 pairs, mean gap 4.7 (high-judgment 44.3 vs balanced-workhorse 39.7)
formula gain half NOT MET; no promotion
```

**Prediction (ADR-1416, session-authored): HIT** -- "balanced-workhorse holds; no material
owner-visible gain; no promotion".

## Signals worth carrying

- **Thesis dominated tier**: 58-59 for command center, 25-27 for narrative, against a 4.7 tier gap.
- **The jurors ranked the owner's 27 first** (variant-f) and the reference last; the owner put the
  reference above four variants. Second run in a row where agent taste diverged from the owner's.
- **Single-gallery-bias read (PLAN successor row):** read both rankings (local, gitignored). No
  reason names the pack, its gallery or a house style. Juror 1 ranked the reference last because
  it does "a different job" (no case, hearing or overdue concept), while calling its restraint and
  spacing better than the lowest variants -- a judgment from the brief's job, not from the
  gallery's look. **Not FIRED.** The reference, chosen as on-brief, still read to a juror as
  off-job: a project panel is not a case.
