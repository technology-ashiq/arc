# Recall aliases — the searcher's word, mapped to the recorder's

ADR-0709. A curated, hand-maintained layer. **No stemming and no embeddings**: both would make
recall a thing nobody can explain, and every entry here is a decision somebody can read and argue
with.

## This table is deliberately EMPTY, and that is the finding

Every row must exist because a **real query missed**. Measured on 2026-08-11, against the full
12-query golden set and the real corpus:

| configuration | golden queries hitting an expected id in the top 3 |
|---|---|
| grep, pinned method (Phase 00 baseline) | **1 / 12** |
| grep, ORACLE — the rarest content word, i.e. grep's best case | **5 / 12** |
| bm25 tag-weighted, **with** a 10-row alias table | **12 / 12** |
| bm25 tag-weighted, **with no aliases at all** | **12 / 12** |

The last two rows are the point. A 10-row alias table was written first, one row per golden query,
and then removed — **and nothing changed.** Not one row was load-bearing. Under ADR-0709's own
rule that a row exists because a query missed, none of them had earned its place, so none of them
ships.

The interesting case is **G10**, `when is a cycle officially closed which document`. The word
`officially` appears **zero times in the entire corpus** — the cleanest vocabulary mismatch in the
golden set, and the row this file was designed around. It hits at rank 2 anyway, because
`cycle`, `closed` and `document` carry it there without help.

**So ADR-0709's premise is weaker than the design assumed.** Vocabulary mismatch is real — the
grep numbers prove a searcher's words do not match a recorder's — but bm25 over a tag-weighted
inverted index already absorbs it, because a query rarely misses on *all* its words at once. That
is reported here rather than papered over with rows nobody needs, and it is the owner's call, not
this cycle's, whether ADR-0709 should be narrowed.

## What puts a row in

A golden query, or a real query someone actually ran, that misses the top 3 **and** whose miss is
traceable to a single vocabulary gap. The row is written beside the miss, with the miss named in
the `why` column. A row added speculatively is a row nobody can ever retire — which is precisely
what happened to the first ten.

## Format

One row per alias group. `terms` is a comma-separated list of the searcher's words; `expands-to`
is a comma-separated list of tokens added when any term matches. Matching is on tokens, after the
same lowercasing and diacritic folding the index uses — so `DUP_IDEM` here and `dup idem` in a
query are the same thing.

Expansion is **additive**: the searcher's own words are always kept. An alias can only bring more
candidates in, never take the literal query away, so a wrong alias degrades ranking and can never
make a term unfindable. That property is what makes a hand-maintained list safe to depend on.

## The rows

| terms | expands-to | why |
|---|---|---|
