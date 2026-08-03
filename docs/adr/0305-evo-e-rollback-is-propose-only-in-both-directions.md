# ADR 0305 — EVO-E: rollback is propose-only, in both directions

**Status:** accepted
**Date:** 2026-08-03
**Product:** `evolve`
**Reversibility:** one-way
**Revisit trigger:** a surface actually reaches L2+ autonomy **and** a Constitution amendment
adopting machine-initiated canonical writes has been adopted. Re-opening machine-revert needs
both, plus its own ADR — not a judgement call in a hot incident.

## Context

The originating brief said rollback was automatic — and in the same document locked propose-only
as a non-negotiable. The two conflict. The owner resolved toward propose-only in the review of
2026-08-02, and that resolution is recorded in the design source as a deliberate deviation from
the brief's letter.

The argument for auto-revert is real and should be stated: a degraded champion keeps serving
until a human acts. The argument against is that "the machine may write canonical files, but only
to undo" is a carve-out, and a carve-out is a code path — the same path, differently motivated.

There is a sharper case that decides it. After a promotion, a human may hand-edit the file. The
machine now holds a patch computed against a base that no longer exists. Applying it would
silently destroy the human's edit. So even a revert-only write cannot always be safe.

## Options considered

1. **Automatic revert on breach.** Pros: bounded exposure without waiting for a human. Cons: a
   machine canonical write exists in the system; the post-promotion-drift case makes it unsafe
   precisely when it would be most wanted.
2. **Automatic revert only when the file still hashes to `candidate_sha`.** Pros: closes the
   drift hole. Cons: still a canonical write path, and the interesting failures are the ones
   where the precondition is false.
3. **Propose-only in both directions; detection stays automatic.** Chosen.

## Decision

**The machine NEVER writes canonical files — not to promote, not to revert.** Constitution A6,
no exceptions, no carve-outs.

What stays fully automatic is everything up to the write:

- degradation past threshold (with its own observation floor met) → `incident.raised`
- experiment class demoted to L1
- **surface FROZEN** — no new proposals until the revert proposal is resolved
- an urgent, SHA-bound revert diff posted to the inbox

The revert proposal is itself SHA-bound: `applies_to: candidate_sha` + `restores: champion
base_sha`.

**When post-promotion drift makes a machine patch unsafe** — the current file no longer hashes to
`candidate_sha` — the system does **not** generate a patch. The inbox item enters
**`manual intervention required`**, carrying expected vs observed SHA plus the archived champion
artifact reference. Restorability is the recovery path; the machine never patches an unknown base.

## Consequences

**Easier.** There is exactly one rule to verify — no canonical write path exists anywhere in
evolve — instead of a rule plus its exceptions. Fixtures can assert the canonical target is
byte-unchanged across every scenario, forward and backward, which is a far stronger property than
"unchanged except when reverting".

**Harder, and accepted with eyes open.** A degraded champion lives until a human merges. This is
bounded rather than dismissed: v1 surfaces sit on L1 modules whose publishes are inbox-gated
anyway, and a breach freezes the surface and raises an incident immediately. The exposure is
real, it is written down here, and it is the price of the guarantee.
