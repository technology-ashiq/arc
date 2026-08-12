# ADR 0910 — the guard is monthly and owner-started, and a clean run leaves no approval (BEN-F)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** two consecutive months with no champion `run.completed` on the spine — the
absence is the evidence, and a spend-class scheduled job becomes the recorded ask.

## Context

The champion drift guard costs money on every run. arc's scheduler v1 admits **script-class ₹0
jobs only**, so a spend-class job has no home yet. The cadence question is therefore not "how
often is ideal" but "what can honestly be committed to and detected when missed".

## Options considered

1. **Scheduled/automatic** — reliable, and there is no job class that may spend money, so it
   cannot be built this cycle without changing the scheduler's own ladder.
2. **Monthly, first working day, owner-started** — no new machinery, and its absence is
   detectable from the spine itself.
3. **Ad-hoc whenever someone remembers** — undetectable when skipped.

## Decision

**Option 2.** Monthly, first working day, started by the owner.

**A clean guard run emits ONLY `run.completed`.** No approval event exists for a no-drift run —
the spine never carries no-op approvals. `approval.requested` is created **only** by drift
findings (gate `drift`) and router proposals (gate `router-merge`).

A missed month is detectable without any new instrument: **no champion `run.completed` in that
month's spine slice**. Absence of a receipt is the signal, which is why the guard emits one even
when it finds nothing.

## Consequences

**Easier:** zero new machinery, and the inbox stays a real needs-you surface instead of
accumulating monthly no-ops that train the reader to ignore it.

**Harder:** the guard depends on a human remembering. The mitigation is that forgetting is
visible rather than silent.

**The trap this closes:** `docs/retro-log.md` 2026-08-10 (arc-policy) — *"an assumption whose
trigger is a spine COUNT can only be adjudicated by running the query; six rows sat unmarked
because nobody ran it."* This ADR's revisit trigger is a spine count, so `/arc-retro` for this
lane **runs that query before writing any status**, and a month with no data is recorded NOT
EVALUABLE rather than passed.
