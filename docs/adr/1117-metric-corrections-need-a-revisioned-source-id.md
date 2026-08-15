# ADR 1117 — Metric corrections carry a revisioned `source_id`, and the emitter's idem asymmetry is flagged back

**Status:** accepted
**Date:** 2026-08-14
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** the emitter starts folding `supersedes` into the leads idem the way it already
does for experiments — then the revision suffix becomes unnecessary and this ADR is superseded by
deleting it.

## Context

REQ-05 and ADR-1108 both require that a re-ingest yielding different numbers **lands as a new
receipt with `supersedes`, never an overwrite** — the correction path is called out as
load-bearing rather than defensive decoration, because Search Console backfills for days and a
re-read is expected rather than exceptional.

**It does not work.** Found at the Phase 05 close by probing the live code rather than reading it:

```
leadsIdem("metric.observed", {...week, value: 12})  ->  b9ccf00dbc5493ec…
leadsIdem("metric.observed", {...week, value: 19})  ->  b9ccf00dbc5493ec…   IDENTICAL
```

The idem preimage is `kind|module|surface|variant|cohort|metric|window_start|window_end|source_id`.
**`value` is deliberately not in it** — and that is correct, because the preimage should identify
*which measurement this is*, not what it said. But the emitter then derives the key with

```js
idem = safeLeadsIdem(kind, payload)                                  // arc-event.mjs:183
```

while the experiment family two lines down derives it with

```js
idem = safeExperimentIdem(kind, payload, venture, flags.supersedes ?? null)   // :189
```

So an experiment correction gets a distinct key and lands; **a metric correction collides on
DUP_IDEM and is silently dropped.** The asymmetry is invisible from either file alone: the
validator is correct, the preimage is correct, and the bug lives in which arguments one call site
passes.

This is a fifth deviation, in a surface ADR-1109 never examined — that ADR diffed the payload
GRAMMAR against the frozen spec, and this is the emitter's key derivation.

## Options considered

1. **A revisioned `source_id` for corrections; the emitter asymmetry flagged back, not fixed here.**
2. Change `arc-event.mjs:183` to pass `supersedes` into the leads idem. Con: `validate-leads.mjs`
   and that call site are **company organs the leads lane owns**, with seven other kinds and 27
   fixtures riding on the current key derivation. Changing how every leads receipt is keyed,
   mid-cycle, from a growth branch, to fix growth's correction path is exactly the shared-organ
   edit `.claude/rules/lanes.md` and ADR-0308 warn against — and it is the same shape as ADR-1109's
   rejected option 2.
3. Overwrite the original receipt. Con: forbidden outright. Corrections supersede; they never
   overwrite.
4. Put the correction count in `variant` or `cohort`. Con: those are evolve's experiment
   dimensions, and growth stuffing a revision counter into them would corrupt the meaning of a
   field another lane reads.

## Decision

**Option 1.** A correction re-ingest emits with `source_id = gsc-<ISO-week>-r<N>`, N starting at 2
for the first correction. The original stays `gsc-<ISO-week>`.

- `source_id` **is** in the idem preimage, so the corrected receipt gets a distinct key and lands.
- It satisfies the live `SOURCE_ID_RE` first alternative (`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`) with no
  grammar change anywhere.
- The correction still carries `supersedes` pointing at the receipt it replaces, so the chain is
  intact and the reader that resolves supersedes-heads picks the newest.
- **Re-ingesting the SAME export is still idempotent**: same week, same revision, same key, DUP_IDEM.
  Idempotence and correction are different operations and now have different keys, which is the
  property that was missing.
- The revision is honest rather than cosmetic: a corrected week genuinely comes from a *different
  read* of the export, and the id says so.

**Flagged back, not absorbed.** The emitter asymmetry is written here and named in `PLAN.md` §
External dependencies, in the same way ADR-1109 flagged its four findings back to PLAN-evolve
rather than editing another lane's file. The **spec-verify gate probes it**, so if leads ever fixes
the call site the gate reports a finding that disappeared and this ADR gets revisited instead of
quietly rotting.

**Evidence:** `arc-event.mjs:183` vs `:189` (the two call sites) · `validate-leads.mjs` idem
preimage (`value` correctly absent) · probe output above, run against the live modules ·
ADR-1108 (the correction path is load-bearing) · ADR-1109 (the flag-back rule, and its rejected
option 2) · `.claude/rules/lanes.md` § shared organs.
**Confidence:** high on the defect (probed, not read); medium on the revision suffix being the
right shape rather than the emitter fix, which is why the revisit trigger names the emitter.
**Rejected because:** option 2 re-keys another lane's seven kinds mid-cycle; option 3 is forbidden;
option 4 corrupts a field evolve owns.

## Consequences

Easier: corrections land, and the mechanism needs no change to any file growth does not own.
Harder: a reader counting distinct weeks must group by window rather than by `source_id`, because
one week can now have several ids — which is why `feed.mjs` counts windows and not source ids, and
why the completeness check compares against expected WEEKS.
