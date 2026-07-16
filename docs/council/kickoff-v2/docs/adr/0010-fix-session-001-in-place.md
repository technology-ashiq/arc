# ADR 0010 — Session 001 is corrected in place; no grandfathering machinery

**Status:** accepted
**Date:** 2026-07-15
**Reversibility:** one-way
**Revisit trigger:** a second pre-v2 session surfaces (there is exactly one today), or the one-off correction is later judged to have altered the historical record beyond the CONFIDENCE cap + dated note (git diff of the correction commit is the arbiter).

## Context
v2's model-knowledge confidence discipline (offline verdicts cap CONFIDENCE at Medium) makes the
only saved session — `docs/council/sessions/001-…md`, model-knowledge mode with `CONFIDENCE: High`
— fail the tightened `--verdict` lint. The eval harness wants a "lint all saved sessions" check.
Something must give: fix the file, version-branch the lint, or scope the rule to new sessions.

## Options considered
1. **Fix 001 in place** — cap CONFIDENCE to Medium + a dated correction note — pros: no lint branching, no permanent schema field, sessions stay uniformly lintable, git history preserves the original; cons: edits a historical artifact (mitigated by the note + git).
2. **Grandfather via version marker + lint branch** — pros: history untouched; cons: permanent `Council: v1|v2` schema field + forked lint logic + 001 special-cased in the eval harness forever — heavy machinery for exactly one file.
3. **Scope the rule to post-v2 sessions only** — pros: zero migration; cons: "lint all saved sessions" becomes impossible, and the known-bad file stays certified-looking forever.

## Decision
Option 1: one commit caps 001's CONFIDENCE to Medium and appends a dated correction note naming
this ADR. The carrying reason: it is the only pre-v2 session in existence — permanent
grandfathering machinery to protect one file is structure for structure's sake, and the fix turns
the documented hole into the documented example of the fix.

## Consequences
Easier: council-lint stays one code path; the eval harness can sweep `sessions/` unconditionally;
the v2 PR carries a live before/after demo. Harder: this is the ONE sanctioned edit of a saved
verdict — the non-negotiable "past verdicts are append-only" names it as the sole exception, and
any future correction needs its own ADR.
