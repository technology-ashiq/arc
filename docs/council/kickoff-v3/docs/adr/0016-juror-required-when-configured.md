# ADR 0016 — Juror availability contract: required-when-configured

**Status:** accepted
**Date:** 2026-07-16
**Reversibility:** one-way
**Revisit trigger:** juror-provider outages/rate-limits block ≥2 real deep runs in practice (the hard
edge hurts more than the fabrication gap it closes), or a consumer project demonstrates a legitimate
configured-but-must-skip need.

## Context
When the juror can't run (no key, offline, API down), the deep run must do something. Soft-always keeps
every run alive but lets a configured user silently skip the juror — reopening the exact ADR-0014
fabrication gap the feature exists to close. Hard-always would break arc's offline-first non-negotiable
(a deep run must work with no web and no keys).

## Options considered
1. **Required-when-configured** — `JUROR_*` env set ⇒ the juror MUST run and its artifact MUST be present
   and valid, else the verdict fails lint; env unset ⇒ the run proceeds with a named `Juror: unavailable
   (not configured)` line — pros: closes the gap whenever closable, offline-first intact; cons: a
   configured user's provider outage blocks the verdict until retried or the key is unset (an explicit,
   visible act — not a silent skip).
2. **Soft always** — cons: the juror becomes decorative; a lying Chair just "fails" it.
3. **Hard always** — cons: breaks offline-first; unusable in consumer projects without keys.

## Decision
Option 1. The verdict carries a `Juror:` line (`<model> @ <base-url host>` or `unavailable (<reason>)`);
when a juror artifact exists the line must name the model, and when the line names a model the artifact
must exist and parse. Unsetting the key to proceed is allowed but visible in the verdict — an auditable
choice, not a quiet one. The carrying reason: the fabrication gap should be closed in every run where
closing it is possible, and only there.

## Consequences
Easier: offline/CI/consumer runs unaffected; the juror's presence/absence is always explicit in the
artifact. Harder: `council-juror.mjs` needs a clear failure taxonomy (timeout, auth, rate-limit, parse)
with retry — a provider blip should name itself, not manifest as a mystery lint failure.
