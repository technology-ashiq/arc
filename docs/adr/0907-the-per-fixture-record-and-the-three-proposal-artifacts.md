# ADR 0907 — the per-fixture record and the three proposal artifacts (BEN-C)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a consumer (the dashboard brief, or a second bench client) needs a field
the record does not carry — added by amendment, never by an ad-hoc column.

## Context

Bench produces two kinds of output: a normalized record per fixture attempt (the raw evidence)
and a proposal (the reviewable artifact a human acts on). REQ-02 requires **three** artifacts
per proposal, and the non-negotiable is that **the diff never travels without the table**.

## Options considered

1. **One report artifact** — a human-readable table only. Cheap, and nothing downstream can
   read it, so the dashboard brief later re-parses prose.
2. **Record + report + machine manifest + pinned diff** — more surface, but each consumer reads
   the artifact meant for it.

## Decision

**Option 2.**

**Per-fixture normalized record** (one per fixture attempt, K per fixture):
process + task class · fixture ID + input SHA · eval-pack revision · `subject` block +
`fingerprint` block (ADR-0903) · schema pass/fail · assertion pass/fail **with per-assertion
ids** · latency · token/provider cost when reported (ADR-0904) · `failure` ∈ {`transport`,
`budget`, `schema`, `assertion`, `timeout`} · redacted artifact ref.

**Three artifacts per `--propose` run**, under `initiatives/bench/evidence/`:

1. **Human evidence table**, per task class: current champion · candidate · contract result ·
   quality result · cost Δ (classified per ADR-0908) · latency Δ · recommendation.
2. **Machine-readable results manifest** — the records above plus the run's provenance, so a
   later reader never re-parses the prose table.
3. **A stable unified diff pinned to the exact router SHA the run read.** Stable means: same
   inputs → byte-identical diff, keys emitted in a fixed order, no timestamps inside the diff
   body.

A class at `NO PROPOSAL` produces artifacts 1 and 2 **and no diff at all** — never an empty or
commented-out diff, which would read as a proposal that happens to be blank.

## Consequences

**Easier:** the dashboard brief and any future reader consume the manifest, not the prose; the
diff is reviewable in isolation and its provenance is inside it.

**Harder:** three artifacts must stay consistent with each other, so Phase 1 pins a test that
the table and the manifest agree on every recommendation.

**The trap this closes:** `docs/retro-log.md` 2026-08-04 (arc-evolve) — a non-total encoder in
a hash preimage gave two opposite gate states one hash. The manifest and the replay proof both
depend on canonical serialization, so the encoder is **total and type-tagged**: it refuses
`undefined`, `NaN`, `±Infinity`, `BigInt` and cycles rather than coercing them. Absent fields
are absent keys, never `null` — because `null` and "the driver did not report it" are different
facts (ADR-0904).
