# ADR 0007 — Mechanical verification contract (POINT-IDs the lint can check)

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** two-way
**Revisit trigger:** the POINT-ID cross-reference proves too rigid (members game it with padded points) or the lint's ID-matching produces false failures on well-formed runs.

## Context
All three kickoff attack passes converged on one hole: the plan claimed a "verified-only verdict" but the
only test surface is a zero-dep *structural* lint, which cannot tell a real argument from a well-formed but
fabricated or empty one. "Every KEY REASON traces to a Supported/Plausible point" was a semantic claim no
declared tool could check, and DISSENT could be satisfied by a Chair-authored strawman. Without a
mechanical contract, REQ-02's trust claim rests on the Chair's self-report.

## Options considered
1. **Prose contract only** — pros: simplest; cons: unverifiable — exactly the hand-wavy failure the tool exists to fix.
2. **Semantic similarity check** — pros: catches meaning drift; cons: needs an LLM/embeddings dependency, not zero-dep, non-deterministic.
3. **POINT-ID cross-reference** — pros: deterministic, zero-dep, greppable; cons: members must tag points and the Chair must cite IDs.

## Decision
Option 3. Every member numbers its KEY POINTS with IDs (e.g. `P1`, `P2`); the verifier rates points **by
ID** (Supported/Plausible/Weak/Contested); the Chair's KEY REASONS and the DISSENT bullet must each **cite
a POINT-ID** the verifier rated Supported/Plausible; `council-lint.mjs` mechanically checks that every
cited ID exists and was rated ≥Plausible, and flags any run where the verifier rated 0 points
Weak/Contested (a rubber-stamp signal). Chosen because it makes "verified-only verdict" deterministically
checkable with no new dependency.

## Consequences
Easier: REQ-02/REQ-03 become mechanically gradable; rubber-stamping and strawman-dissent are caught.
Harder: members and the Chair carry an ID-discipline; the lint must parse IDs — mitigated by fixtures that
prove the lint fails red before it passes green (phase-01 verification).
