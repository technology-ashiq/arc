# ADR 1009 — LEG-I: text quality is judged by ANSWERABILITY, and the scenario set is a fixture

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** the scenario set passes while real readers still cannot find an answer — a
support inbox repeatedly answering a question the pages are supposed to answer means the set is
measuring the wrong thing, and the pass condition is re-designed.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). Locked at the v1.1 freeze as LEG-I.

"Is this policy text good?" has no mechanical answer, and a lane that tries to score prose taste
burns its whole appetite on it (the plan names template-prose perfectionism as rabbit hole #1).

arc has the matching scar. `arc-design-cycle3` 2026-07-30: *"PASS was defined as an absence (zero
VIOLATION = broke no rule), so compliant characterless work passed five consecutive runs and no part
of the loop could report that it was simply not good enough."* A lint that only checks provenance
has exactly that shape: every clause traces to a pinned block, the page is empty of the answer the
reader needed, and nothing goes red.

## Options considered

1. **Judge prose quality** — unbounded, subjective, and the rabbit hole the plan already named.
2. **Judge provenance only** (every clause traces to a template block) — mechanical, and passes an
   empty page.
3. **Judge ANSWERABILITY against a pinned scenario set** — a closed, versioned list of real
   situations, each of which must map to the clause ID that answers it.

## Decision

**Option 3.** A pinned scenario set of **at least eight** situations, each mapped to its answering
clause ID:

refund on day N and day N±1 · cancellation path · GST-invoice request · data-deletion request ·
account termination while third-party client data is held · payment dispute · grievance escalation ·
notice-language request (s.5(3)).

- **An unanswered scenario fails the completeness lint.** This is the finding class that fails for
  *insufficiency*, not only for rule-breaking — the thing `arc-design-cycle3`'s retro said a quality
  gate must have.
- **The scenario set is part of the template set's definition of done.** A template edit that orphans
  a scenario fails completeness; new scenarios enter by reviewed diff.
- **Required-clause-ID completeness is separate and also FAILs:** a missing mandatory block is a
  failure even if every present clause traces perfectly. Provenance alone cannot pass an empty page.

**All three lints are WARN-first in TRIAL**, per the owner's kickoff instruction, and no promotion to
FAIL happens without an adversarial pass first. Promotion follows the repo's existing ritual —
`docs/trial-ledger.md` evidence, `/arc-retro` approval — not this cycle's convenience.

**And the pass condition is committed before the harness exists.** `arc-absorb` 2026-08-10: *"a
metric named only after the numbers are visible is chosen to flatter."* The scenario set and its
clause-ID mapping are written and committed in their own commit, before the completeness lint is
built.

**Confidence:** high
**Rejected because:** Option 1 — the named rabbit hole. Option 2 — passes an empty page, which is
the failure this lane exists to prevent.

## Consequences

Easier: "is the text good enough" becomes a countable question, and extending the bar is a reviewed
diff rather than an argument.

Harder: eight scenarios is a floor chosen for a 5-day appetite, not a considered coverage claim, and
a set that passes is evidence about the set. The revisit trigger above is the honest admission that
the map is not the territory.
