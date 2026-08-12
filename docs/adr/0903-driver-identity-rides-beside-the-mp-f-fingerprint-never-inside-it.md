# ADR 0903 — driver identity rides beside the MP-F fingerprint, never inside it

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** one-way
**Revisit trigger:** the executor lane lands its amendment making the RUNTIME part of the model
seat — bench then migrates the sidecar fields into the fingerprint and deletes them here, in
one recorded change, forward-only.

## Context

BEN-B's load-bearing claim is that **the same model id reached through a different driver is a
DIFFERENT bench subject** — which is why `--driver` is mandatory for a candidate run.

The MP-F fingerprint (ADR-0068, restated as ADR-0069 block (e)) has **nine fields**: provider ·
exact model id · agent role · agent-file/prompt commit SHA · input/brief SHA · timestamp ·
wall-clock duration · effort if visible · statusline cost if visible.

**None of them is a runtime or a driver.** `PLAN-bench.md:59` expects the executor lane's first
act to amend ADR-0069 so the runtime becomes part of the model seat, and `:120` tells this
kickoff to "verify the executor amendment's runtime-in-the-seat state".

Verified 2026-08-12: **not amended.** There is no executor lane (`initiatives/` has none), no
executor ADR, and the one ADR that answers 0069's revisit trigger explicitly declines to amend
it (`ADR-0204:62-65`). `PLAN-ops.md:78` still lists the amendment as pending.

So bench's subject identity cannot be expressed by the fingerprint it is required to reuse —
while `PLAN-bench.md:66` forbids "inventing a parallel vocabulary".

Worse in practice: **no `run.completed` receipt on the machine carries a model id at all** —
all read `model: null`. `arc-run.mjs:261-262` writes `unpinned` only when a tier is set, and
only `claude-code` has pinned models in `engine/router.yaml`.

## Options considered

1. **Add `driver` / `driver_version` to the MP-F fingerprint** — amends ADR-0069 from inside
   this cycle, which the no-gos forbid outright, and pre-empts the executor lane's own decision.
2. **Record driver identity as sibling fields alongside the fingerprint**, leaving MP-F's nine
   fields byte-for-byte as ADR-0068 defines them.
3. **Drop driver from the subject** — collapses BEN-B's rule, makes "same model, two drivers"
   one subject, and silently mixes two things bench exists to tell apart.

## Decision

**Option 2.** A bench provenance record contains:

- `fingerprint` — the MP-F nine fields, unchanged and unextended.
- `subject` — bench's own sibling block: `driver`, `driver_version`, `router_sha`,
  `eval_pack_revision`, `process_version`, `request_settings`.

Two things are true at once and the record says both: the **model** is identified by MP-F, and
the **bench subject** is identified by MP-F *plus* the driver. This invents no vocabulary
because it extends no closed set — `subject` is a payload field on an existing kind
(`run.completed`, ADR-0911), not a new fingerprint and not a new event kind.

Marked **one-way** because every receipt written under this shape is append-only and cannot be
rewritten when the executor amendment lands; the migration is forward-only, exactly as
ADR-0068 rule 1 requires.

## Consequences

**Easier:** bench can distinguish its subjects today without touching model policy, and the
executor lane's future amendment stays unprejudiced.

**Harder:** for one cycle, two records describe overlapping things, and a reader must know that
`subject.driver` is bench's and `fingerprint.*` is MP-F's. The migration is a real, named
follow-up, not a hope.

**Consequence bench must absorb, not hide:** because no driver reports a version today
(ADR-0902 adds it) and no receipt carries a model id, `subject.driver_version` and
`fingerprint.model_id` will be **absent** on any run against a driver that does not supply them.
Absent stays absent — never `unknown`, never a placeholder, never estimated (ADR-0069 b(5),
Constitution E3). A comparison missing either field is not eligible (ADR-0906), which is the
honest outcome rather than a silently weaker one.
