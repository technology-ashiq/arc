# ADR 0908 — drift is two comparability axes, three alert tiers, and a per-class floor (BEN-D)

**Status:** accepted
**Date:** 2026-08-12
**Product:** `bench`
**Reversibility:** two-way
**Revisit trigger:** a false alert fires in a real guard run — the retro recalibrates the
threshold that fired, by amendment, with that run as evidence.

## Context

`bench --champion` re-runs current champions to catch silent provider drift. A single
"did the score move" comparison fails in two opposite directions: a **price change** can blind
the quality guard by making the baseline "incompatible", and a **quality-compatible** run can
hide a price hike behind that same word.

## Options considered

1. **One comparability rule** — simple, and either axis can veto the other.
2. **Two independent axes** — quality and cost compared separately, each with its own
   compatibility requirement.

## Decision

**Option 2.**

**Quality comparability** requires all of: fixture/eval-pack revision · process version ·
driver version · model id · request settings.
**Cost comparability** requires: token usage present **and** a comparable cost source
(ADR-0904). Cost deltas are **classified** — `provider-rate change` · `token-use/output-length
change` · `unknown/mixed` — so a price rise is never reported as a usage change or hidden
behind an incompatible baseline.

**Three alert tiers:**

1. Any **new schema failure** in a previously-clean champion → immediate inbox item.
2. Assertion drop **≥ 10pp AND ≥ 2 fixtures fail** → inbox item.
3. Cost increase **> 20%** → **REPORT-ONLY**, never an inbox item.

Alerts fire only where the class ships **≥ MIN_FIXTURES = 5** for that task class, and only
where the drop exceeds the recorded baseline variance band. **This cycle that means alerts are
live for `commit-msg-draft` only** (ADR-0905); the other two classes are explicitly
alert-silent, and the report says which classes are muted and why, every run.

**Baseline re-pin causes are enumerated and closed.** A baseline re-establishes when a
quality-compatibility component changes, OR when a routing change is merged. **The receipt
states the compatibility-breaking reason. A score movement is NEVER a re-pin cause** — the
anti-goalpost clause. Baseline refresh is a measured observation, not an approval gate; human
approval exists only for routing changes.

## Consequences

**Easier:** a price hike and a quality regression are independently visible, and the guard
cannot be silenced by an unrelated change on the other axis.

**Harder:** two axes mean two compatibility records per comparison, and a run can legitimately
report "quality comparable, cost not" — which reports must render as a real state rather than
an error.

**Deadlock this avoids:** owner review round 2 found that a merge-only re-pin rule froze the
guard permanently on the first eval-pack bump. Enumerating both causes is the fix.

**The trap this closes:** `docs/retro-log.md` 2026-07-30 — *"a normalisation added for
measurement destroyed the property being measured"* (a font pinned for hash stability deleted
the typography being judged). Every normalization bench applies before comparing — key
ordering, whitespace, absent-field handling — is recorded next to the comparison with the
signal it removes, and Phase 2 checks that signal is not the one being judged.
