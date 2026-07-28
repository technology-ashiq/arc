# ADR 0047 — The runner owns the verdict AND the receipt; the critic only produces evidence

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** a later lens (code, qa, security) needs its receipt emitted by the judging agent itself for a reason this cycle did not foresee — then the split is re-argued for all lenses at once, never per-lens.

## Context

`phases/phase-00-spec.md` specified two things that cannot both hold. Exit criterion 3 says
the **critic** emits the spine receipt while the **runner** computes PASS/FAIL. Exit
criterion 7 says that receipt's payload carries `"result":"PASS|FAIL"`.

Whoever emits a payload containing `result` must know the result. So the spec as written
either moves verdict computation into the critic — the self-approval ADR-0034 exists to make
structurally impossible — or it leaves the critic emitting a field it cannot compute.

Found while building Phase 00, before the live demo baked either reading in. The
plan-simulator's round-2 pass flagged "factual path/format gaps" in this area; this is the
one that survived into the build.

## Options considered

1. **Runner emits `review.completed`; critic emits `note.logged`** — the critic produces
   findings (evidence), the runner derives PASS/FAIL from them and records the verdict.
   Con: deviates from criterion 3's letter; the critic's own receipt is a weaker kind.
2. **Critic emits `review.completed` including `result`** — matches criterion 3 literally.
   Con: the critic then computes its own verdict and publishes it. The judged party records
   the judgment, which is precisely ADR-0034's failure mode wearing a different hat; the
   mechanical read-only enforcement would be guarding writes while leaving verdicts open.
3. **Critic emits a receipt without `result`, runner emits a second** — no self-reporting.
   Con: two receipts per review, and the gate must then decide which one counts. Extends the
   closed vocabulary's meaning by convention rather than by ADR.

## Decision

Option 1. The critic writes its critique artifact and emits `note.logged` recording that a
critique happened and its finding counts. The runner counts declared `VIOLATION` findings,
defines PASS as zero, emits `review.completed` with
`{"lens":"design","target":...,"result":...,"screenshot_sha256":...}`, and stamps the review
ledger on PASS only.

The general rule this sets for arc: **an agent may produce evidence; only a deterministic
script may record a verdict.** Anchored creation, unanchored verification, deterministic
gates — the verdict belongs to the gate.

## Consequences

Easier: PASS means something checkable, because the thing being judged never writes it. The
gate matches on a `target` the runner controls, so a critic cannot make its route look
reviewed by shaping its own receipt. Harder: the critic's receipt is `note.logged`, so
"which reviews ran" and "which reviews passed" are two different queries on the spine.

Phase-00 spec criteria 3 and 7 are read through this ADR; the spec text keeps a pointer here
rather than being silently rewritten.
