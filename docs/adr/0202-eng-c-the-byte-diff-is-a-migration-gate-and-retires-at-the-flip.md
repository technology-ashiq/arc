# ADR 0202 — ENG-C: the byte-diff is a migration gate, and it retires at the flip

**Status:** accepted
**Date:** 2026-08-03
**Product:** `engine` — lane `engine`, ADR band 0200–0299
**Reversibility:** one-way
**Revisit trigger:** a post-flip regression reaches a pilot command that a byte-diff would have
caught and schema validation plus eval fixtures did not. That is the case for keeping a
byte-comparison alive past the migration, and it reopens this decision with a real example
instead of a fear.

**Locked upstream.** ENG-C from `docs/strategy/plans/PLAN-engine-process-layer.md`.

## Context

REQ-02 requires `arc-compile --target claude-code` to regenerate the 3 pilot command files
byte-identically to the current hand-written ones. The question this ADR settles is what that
gate is *for*, and therefore how long it lives.

A byte-diff against a hand-written file is a **migration** instrument: it proves that moving the
truth into `processes/` lost nothing. It is not a regression instrument, because after the flip
the hand-written file no longer exists to compare against — the canonical file is the source, and
"byte-identical to itself" is a tautology.

Keeping a byte-comparison alive past that point has a specific cost: it freezes the generated
output forever, so any improvement to a pilot command — a clearer step, a fixed typo — reads as
a gate failure. That is the shape retro-log 2026-07-30 names, where a normalisation added for
measurement destroyed the property being measured.

## Options considered

1. **Migration-only, retires at the flip** — pros: the gate does the one job it can actually do,
   then gets out of the way. Cons: after the flip there is no byte-level check at all.
2. **Permanent byte-lock on generated output** — pros: absolute drift detection. Cons: locks the
   pilots against improvement and turns every legitimate edit into a gate override, which teaches
   that the gate is negotiable.

## Decision

**The byte-diff is a migration gate.** It runs in Phase 1, it must pass **3/3**, and passing it is
what authorises the flip of source-of-truth from `.claude/commands/*.md` to `processes/*.process.yaml`.
After the flip it is retired from CI as a regression check.

**Post-flip regression is three things instead:** output schema validation (ADR 0200), the eval
fixtures written in Phase 0, and reviewed goldens for the codex target (REQ-03).

**Comparison is LF-normalised, and the normalisation is declared.** Both sides have `\r\n` and a
lone trailing `\r` collapsed to `\n` before comparison. **What this destroys is line-ending
information** — which is exactly what a Windows CI leg would differ on. So line endings do not go
unmeasured: `process-lint` asserts separately that every generated file is LF-only, as its own
named check with its own failure message. One instrument measures content, a different one
measures line endings; neither is asked to do the other's job (retro-log 2026-07-30).

**The baseline is pinned by hash, not by a lock.** Each canonical file records the pilot's
`sha256` and the commit it was taken from — for this cycle, **`7abeda1`**. `process-lint` recomputes
the live pilot's hash and FAILs when it has moved, naming the file and both hashes. Drift during
the 2-week window is then *detected and adjudicated*, never silently absorbed into a baseline
nobody re-read. A freeze was considered and rejected: it prevents the edit rather than surfacing
it, and a stated control is not a control until something asserts it (retro-log 2026-08-02).

**Confidence:** high

## Consequences

**Easier.** Phase 1 has an unambiguous, machine-decided exit: 3/3 byte-identical or the flip does
not happen. The kill criterion in the plan reads directly off this gate.

**Harder.** After the flip, a defect in the compiler that produces *valid but wrong* output is
caught only by schema + evals + review, which are weaker than a byte-diff. That is an accepted
risk, priced by the revisit trigger above.

**What we'd revisit if this goes wrong.** If the flip happens and a pilot's generated output
degrades in a way review misses, the answer is a recorded golden for the claude-code target too
(the same mechanism REQ-03 already gives codex), not a resurrection of the hand-written baseline.
