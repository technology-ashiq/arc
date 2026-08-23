# ADR 1415 — The composer's iron law gains an explicit read-path allowlist

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a composer is found reading something inside the allowlist that leaks
another variant's work — the allowlist is then too coarse and narrows to per-variant paths.

## Context

`.claude/agents/ui-composer.md` iron law 1 reads: **"Your directory only.** Never read or write
another variant's dir, the matrix, the brief file, or any product file. Your write surface is
`variant-<x>/`."

Design v2 requires the composer to read two things that live outside `variant-<x>/`:
its **own rendered PNG** at `.claude/state/design/renders/`
([ADR-1401](1401-dsv-b-the-composer-sees-its-own-work.md)) and the **reference pack** at
`.claude/state/design/refpacks/<brief>/` ([ADR-1404](1404-dsv-e-reference-packs-cache-images-commit-provenance.md)).

This lane has already paid for this exact shape once. Its retro row for 2026-07-30 records that
the director wrote the canonical content fixture into `matrix.md` while iron law 1 forbade
composers from reading `matrix.md` — so three composers invented three different cases, and the
only one that matched had broken the rule. The lesson recorded then: *when a rule forbids
reading a file, check every consumer of that file has another way to get what it holds.*

Here there is no other way. The brief's **text** can be inlined into the composer's prompt, and
is. A **screenshot cannot be** — the composer must open the image itself to read it with vision.
So the choice is not between two delivery mechanisms; it is between amending the law and having
the composer either refuse or break it.

## Options considered

1. **Leave the law and inline the images** — pros: no change / cons: not possible; the
   orchestrator cannot paste pixels into a subagent prompt.
2. **Relax iron law 1 to "do not read another variant"** — pros: simple / cons: silently
   re-permits the brief file and product files, undoing two separate earlier decisions.
3. **Keep the law and add an explicit allowlist of read-permitted paths** — pros: the
   prohibition stays exactly as narrow as it was, and the new permission is enumerated /
   cons: the law is longer.

## Decision

Option 3. Iron law 1 keeps every existing prohibition and gains an enumerated read allowlist:
`.claude/state/design/renders/` (this variant's own session only) and
`.claude/state/design/refpacks/<brief>/`. Reading another variant's dir, the matrix, the brief
file and product files stays forbidden, verbatim.

The renders allowlist is **session-scoped**, which is only meaningful because
[ADR-1402](1402-dsv-c-the-renderer-is-session-safe-before-anything-runs-in-parallel.md) makes
sessions unique per run+variant — without that, "its own PNG" is not a well-defined path and
this allowlist would hand every composer every other composer's renders.

## Consequences

Easier: the composer can do the job design v2 gives it without breaking its own contract, and
the blindness that makes the panel worth anything is preserved by enumeration rather than by
hope. Harder: the allowlist is now a security-shaped surface, so it needs a negative control —
a composer that attempts to read a *sibling* variant's render must be refused, and that case is
one of the adversarial fixtures for Phase 01.
