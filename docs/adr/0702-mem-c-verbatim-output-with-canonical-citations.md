# ADR 0702 — MEM-C: recall output is verbatim, prevention-first, and every row carries a canonical citation

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** a consumer needs grouped or summarized output badly enough to ask for it by
name — at which point rendering is added *beside* verbatim output, never in place of it.

## Context

The failure this module exists to prevent is recorded, twice, in arc's own history:

- **2026-08-02, `arc-model-policy`:** a bare ADR number cited across namespaces resolved to a
  **different, unrelated decision — four times in one cycle**. The cycle that wrote the warning
  about this trap then walked into it three ADRs later. The recorded prevention is explicit: *a
  citation is `<namespace> ADR-NNNN` plus a path, never a bare number.*
- **2026-07-30, `arc-design-cycle3`:** an evidence pipeline ran end to end on artifacts nobody
  looked at, because agent *descriptions* of artifacts were carried as if they were the
  artifacts. The recorded prevention: *before carrying a verdict about an artifact, open the
  artifact.*

A recall tool that paraphrases what a rule said, or prints `ADR-0026` with no path, reproduces
both failures at speed and at scale. It would be a machine for confidently citing the wrong
decision.

## Options considered

1. **Summarize/synthesize matched rules into an answer** — pros: reads nicely, fewer lines.
   Cons: reintroduces exactly the paraphrase-instead-of-artifact failure; makes the index
   non-deterministic if an LLM does the summarizing, which breaks the rebuild fixture.
2. **Verbatim rows + mandatory path-carrying citations** — chosen. Pros: what you read is what
   was recorded; every row is independently openable; deterministic, so rebuild comparison works.
   Cons: more lines on screen, and lexical search limits are visible rather than papered over.

## Decision

Every result row prints the recorded text **verbatim**, **prevention-first** (the prevention
clause leads, because that is the actionable half of a retro row), and carries a **canonical
citation that always includes the repo-relative path**. A bare number is never printed alone.

Doc-id grammar, stable across rebuilds (derived from content position and keys, never from
rowids):

```
retro:<YYYY-MM-DD>#<n>     n = ordinal among PATTERN rows of that date (scoreboard rows excluded)
trial:<YYYY-MM-DD>#<n>
learn:<L-NNN>
adr:<NNNN>                 rendered as: ADR-0026 (docs/adr/0026-spine-c-....md)
spine:decision/<ulid>
```

Adapters parse by **field count over code-span-masked text, never a naive split**. Backtick-
delimited spans are masked before splitting, then restored: a pipe inside `` ` `` is **data**, not
a separator.

This rule was written because the alternative was measured and was wrong. A naive split of
`docs/retro-log.md` reports 53 pattern rows plus "one anomalous 6-field row". That row is not
anomalous — it is the 2026-08-02 arc-model-policy lesson, whose prevention text contains
`` `(?:^|\n)##` ``. With code spans masked the file is **54 pattern rows, 10 scoreboard rows, and
zero malformed**. Treating the row as malformed would have silently walled off a real
lesson — and, precisely on point, a lesson *about regex parsing bugs*.

This is also the one misclassification `N_parsed == N_indexed` structurally cannot catch, because
excluded rows are outside `N_parsed`: moving a row into the exclusion list leaves the count-verify
perfectly true. So the exclusion set gets its own fixture and its own printed count, and a
genuinely malformed row is a **named exclusion** with file and line, never coerced into a shape it
does not have.

Three escape valves ship with the contract, because a lexical index has honest limits:

- `--grep` — raw passthrough across the organ files, no index involved. The honesty valve for
  when ranking fails.
- `--full <doc-id>` — the exact recorded text of one whole record.
- `--json` — a stable consumer contract carrying `meta.schema_version`; changes are versioned,
  never silent.

All output paths are **repo-relative with forward slashes**, on every OS. All hashing and
fixture comparison is **CRLF-normalized** — the dev machine is Windows and CI spans three OSes.

**Confidence:** high.

## Consequences

- **Easier:** any surfaced row can be verified against its source in one step, which is what
  makes the hook output (ADR-0704) safe to inject into another process's context.
- **Harder:** output is longer than a synthesized answer, and vocabulary mismatch shows up as a
  visible miss rather than a plausible paraphrase. That visibility is the point — it is what
  makes the golden set (ADR-0706) able to fail.
- No LLM runs at ingest or at query time. The index is a pure function of the organs, which is
  what lets "delete it and rebuild" be a real test.
