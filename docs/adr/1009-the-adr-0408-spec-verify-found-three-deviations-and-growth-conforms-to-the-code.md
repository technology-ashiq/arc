# ADR 1009 — REQ-05(a) run early: the live `metric.observed` validator deviates from the frozen spec in three ways plus a fourth trap, and growth conforms to the code

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth` (with three deviations and one trap flagged back to `docs/strategy/plans/PLAN-evolve.md`)
**Reversibility:** one-way
**Revisit trigger:** PLAN-evolve's REQ-00 is amended in response to the flag-back — if it rules
the *spec* correct and the validator wrong, the encoding decided here re-keys every receipt
already emitted, so the correction must arrive before growth's first real ingest, not after.

## Context

REQ-05(a) requires growth to **verify** the landed ADR-0408 `metric.observed` validator against
`PLAN-evolve` REQ-00's frozen spec before building the feed, and to **flag deviations back, never
absorb one silently**. That verify was run at kickoff rather than at Phase 5, because a deviation
found now costs an ADR and a deviation found then costs a phase.

**It is not clean.** Three deviations plus a fourth trap, each of which would have stopped the feed dead.

### What matches

The idem preimage matches the frozen spec **field for field**:

```
spec:  sha256("metric.observed|module|surface|variant|cohort|metric|window_start|window_end|source_id")
code:  validate-leads.mjs:197-201 — identical, with opt() rendering absent optionals as literal "-"
```

`source_id` accepts the spec's `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` and `h-<hex16>` forms, plus
ADR-0408's already-flagged and sanctioned `lead_hmac_v<N>_<hex32>` widening. The closed key set
matches. That widening is **not** re-flagged here — it is on the record as deliberate.

### D1 — the window fields are timestamps in code and ISO-week strings in the spec

`validate-leads.mjs:276-277` calls `assertTs` on both bounds, and `PAYLOAD_TS_RE`
(`validate-leads.mjs:30`) demands **exactly** `YYYY-MM-DDTHH:MM:SS+05:30`, no fractional part.
`PLAN-evolve` REQ-00's own example and `PLAN-growth`'s frozen payload both carry
`"window_start": "2026-W36"`. That value raises `BAD_LEADS_TS`. **Growth's feed, exactly as
specified in its design source, cannot emit a single receipt.**

### D2 — a one-week window has equal bounds in the spec and is refused by the code

`validate-leads.mjs:278` refuses `window_start >= window_end`. The design source's example sets
both bounds to `"2026-W36"` — equal. So even after D1 is fixed, the natural encoding of "one ISO
week" is rejected.

### D4 — the fourth finding: `-` belongs to the preimage, and a payload that writes it is refused

Found by the adversarial pass, after this ADR first claimed three. The frozen spec's phrase
*"absent optionals = literal `-`"* is scoped to the **idem preimage**, and the live `opt()` helper
(`validate-leads.mjs:161`) implements exactly that. But `PLAN-growth`'s example payload writes the
literal as a **payload value** — `"variant": "-", "cohort": "-"` — and `DIMENSION_RE`
(`validate-leads.mjs:85`) is `^[a-z0-9][a-z0-9_-]{0,63}$`, which refuses a leading `-`. The
validator only checks these keys when present (`:269-271`), so the correct behaviour is to **omit
them entirely**.

This is a **trap in the plans, not a deviation in the spec** — the spec is right and its illustration
is not. It is enumerated here because a fourth surprise arriving during Phase 5 is indistinguishable
from a regression, and because the distinction (preimage vs payload) is exactly the kind that gets
read past.

### D3 — the named first surface is not a legal dimension value

`DIMENSION_RE` (`validate-leads.mjs:85`) is `^[a-z0-9][a-z0-9_-]{0,63}$` — **no dot**.
`PLAN-evolve`'s pre-kickoff gate row 1 and EVO-G, and `PLAN-growth` REQ-05, all name the surface
**`growth.title-template`**. That literal string is rejected. Every existing fixture uses a dotless
surface (`campaign`, `home-hero`), so the code has been self-consistent and only the plans carry
the illegal value.

## Options considered

1. **Growth conforms to the code; all four findings flagged back to PLAN-evolve as documentation.**
2. Change the validator to accept ISO-week strings and dotted surfaces. Con: it is leads' file
   with leads' fixtures depending on it, mid-cycle, on a shared organ two other live lanes are
   editing this week — and it would widen a grammar written to keep free text (where a person's
   name hides) out of dimension fields.
3. Absorb quietly: encode around it and say nothing. Con: forbidden by REQ-05(a) in as many words,
   and it is the exact behaviour ADR-0308 created the flag-back rule to prevent.

## Decision

**Option 1.** The **code is treated as authoritative** and growth conforms:

- **D1/D2 →** windows are encoded per ADR-1008: the seven Pacific-time days the range-match guard
  verified, converted to their IST instants, half-open. Legal spelling, distinct bounds, and the
  bound describes exactly the data that produced it rather than a same-named IST week ~12.5h away.
- **D3 →** `module: "growth"`, `surface: "title-template"`. The namespace already lives in
  `module`; `growth.title-template` survives as **prose**, never as a payload value.
- **D4 →** absent optionals are **omitted from the payload entirely**. The literal `-` is a preimage
  rendering, never a value growth writes.

**Flagged back to `docs/strategy/plans/PLAN-evolve.md`** (REQ-00 and EVO-G), by writing this ADR
and naming it in `PLAN.md` § External dependencies — not by editing another lane's plan file from
this lane.

**Structural note, deliberately not acted on.** `metric.observed`'s validator lives in
`validate-leads.mjs` although the kind belongs to no lane. ADR-0308 warned precisely that "the
shared spec should move into evolve (or into hq) and be consumed, rather than re-implemented per
client", and growth is now the second client reading a leads file. Moving it is **out of scope for
this cycle** — it would touch 27 leads fixtures mid-cycle for zero behaviour change. Recorded as
debt with a trigger: **the third client**.

**The spec-verify is re-run, not assumed, at Phase 5** — as an executable diff whose expected
output is exactly these four findings. A new one appearing, or a known one disappearing, is a
phase blocker. A verify that is only ever run by hand once is a claim, not a gate.

**Evidence:** `validate-leads.mjs:30` (`PAYLOAD_TS_RE`), `:74` (`SOURCE_ID_RE`), `:85`
(`DIMENSION_RE`), `:150-153` (closed key set), `:197-201` (idem preimage), `:265-282` (per-field
asserts) · `PLAN-evolve.md` REQ-00 + gate row 1 + EVO-G · `PLAN-growth.md` § Payload schemas,
REQ-05 · `docs/adr/0308-*` (flag-back rule, and the re-implementation warning) · `docs/adr/0408-*`
(the sanctioned `lead_hmac_v1_` widening, not re-flagged) · existing fixture surfaces `campaign`,
`home-hero`.
**Confidence:** high — every deviation is a regex on disk read against a quoted line of a frozen
spec, and each was confirmed against the fixtures that already exercise the validator.
**Rejected because:** option 2 edits a shared organ mid-cycle to widen a grammar that exists to
exclude free text; option 3 is explicitly forbidden and is the failure ADR-0308 was written against.

## Consequences

Easier: Phase 5 starts with a known, enumerated deviation list instead of discovering on ingest day
that no receipt validates. Harder: growth's receipts will not match the payload example printed in
its own design source, so anyone reading `PLAN-growth.md` alone will see a shape that never shipped
— which is why the deviation list is reproduced in `PLAN.md` rather than living only here.
