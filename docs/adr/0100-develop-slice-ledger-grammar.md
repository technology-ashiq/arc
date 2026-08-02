# ADR 0100 — The slice ledger is a `key: value` block per slice, not a table

**Status:** accepted
**Date:** 2026-08-02
**Product:** `develop`
**Reversibility:** one-way
**Revisit trigger:** a consumer outside arc needs the ledger as structured data (an adapter, a
dashboard, a second runtime), or a slice legitimately needs a field that cannot be expressed as one
`key: value` line — either reopens the format and forces a migration of committed rows.

## Context

`phases/phase-NN-tasks.md` holds the Build Brief and the slice ledger. Three consumers parse it:
`develop-lint.mjs` (the gate), `/arc-develop status` (cold reconstruction), and the `spec-fidelity`
pass. Once real slices are committed in a format, changing it means rewriting the parser *and*
retrofitting every committed row in every lane.

The constraint that decides this is arc's own defect history, not taste. Four retro-log rows —
2026-07-16 (×3, council v2/v3) and 2026-08-02 (portfolio) — record the same class: markdown-contract
parsing bugs. First-match where a section legitimately repeats; case-insensitive match then exact
compare; `$` under `/m` read as end-of-string; and the cosmetic-variant attack, where a line a human
reads as meaningful an exact-match regex misses, letting a doctored artifact display legitimacy while
dodging the gate. A slice ledger is exactly that kind of artifact.

## Options considered

1. **Markdown table, one row per slice** — compact and scannable, matches the `PROGRESS.md` phase
   table. But a slice carries id, title, risk, proof type, tier, command, result, commit, context
   sources, micro-decision and typed links; eleven columns is unreadable, and pasted proof output is
   multi-line, which a table cell cannot hold.
2. **Fenced `key: value` block per slice** — matches the `PROGRESS.md` machine-header precedent
   already in this repo, diff-friendly one field per line, extensible without breaking old rows,
   and multi-line proof output fits in a nested fence.
3. **JSON or YAML sidecar** — machine-perfect, but the ledger stops being readable in the tracker
   and truth splits across two files that can disagree. The plan's durable-truth table (§3) puts the
   brief and the ledger in the same committed markdown file on purpose.

## Decision

Option 2 — a delimited `key: value` block per slice, in the same file as the Build Brief: a
`### slice: NN` heading opens each block, `key: value` lines carry the fields, and multi-line proof
output sits in a fence under `result:`. The worked example that binds the writer and the parser is in
`initiatives/develop/phases/phase-00-spec.md`.

The one reason that carried the most weight: this repo already has a proven machine-readable markdown
contract in the `PROGRESS.md` header, and the board reads it without incident. Reusing that shape
means the parser is a known quantity rather than a new invention.

Parsing follows the retro-log's prescription verbatim, from the start rather than after the first
bug: **tolerant detection, strict grammar.** Detection tolerates bullet, emphasis, whitespace and
heading-level variants as one thing; the value grammar is exact and near-misses fail closed. Repeated
sections take all-of, never first-of. Line regexes are anchored, never `$` under `/m`.

## Consequences

Easier: adding a field later is additive and old rows stay valid; a human can read and hand-repair a
ledger; `git diff` on a slice shows one changed line, not a rewritten table row.

Harder: the parser must be written defensively up front, and REQ-06 pays for that with an adversarial
breaking-input pass and pinned fixtures before Phase 01 closes.

What we would revisit if this goes wrong: if the block grammar proves ambiguous under adversarial
input in a way tolerant-detection cannot fix, the fallback is a strict fenced block with a declared
schema version line — a narrowing of this format, not a move to option 3.
