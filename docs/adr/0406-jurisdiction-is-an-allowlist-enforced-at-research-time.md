# ADR 0406 — Jurisdiction is an allowlist, enforced by lint at research time

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** one-way
<!-- a send into an opt-in regime cannot be recalled -->
**Revisit trigger:** the ICP genuinely requires a second jurisdiction — which is its own ADR
carrying that regime's rules encoded, never an allowlist edit.

## Context

Cold-email law differs by jurisdiction, and the differences are categorical rather than
cosmetic: EU/UK are **opt-in** regimes where cold B2B mail to an individual is largely
unlawful without prior consent. A lead list assembled without a geography field will
silently contain them.

## Options considered

1. **No geography handling** — pros: nothing to build. cons: one EU lead in a 25-lead list is
   a legal exposure nobody chose.
2. **Warn on out-of-allowlist geography** — pros: flexible. cons: a warning on a batch of 25
   is a warning someone clicks past.
3. **Allowlist, lint-rejected at research time** — the lead never enters the list.

## Decision

**Option 3.**

- Every lead carries a **geography** field. Missing geography → rejected by lint.
- v1 allowlist: **India only.**
- Out-of-allowlist geography → **rejected at research time** (fixture), so the lead never
  reaches a dossier, let alone a draft.
- Expanding the allowlist is **its own ADR** with that regime's rules encoded. EU/UK are
  out of v1 scope entirely.
- Every send regardless of jurisdiction: truthful sender identity, business-context B2B
  content, working unsubscribe, instant suppression.
- DPDP-conscious handling: business-contact data minimalism; delete-on-request honored via
  suppression + store purge (`ADR-0410`).

**This is not legal advice.** The owner reviews before campaign #1; the legal-pack module
formalizes this later.

**Confidence:** high on the mechanism. The *choice* of India as the v1 allowlist is a
business decision inherited from the design source, not a legal conclusion.

**Rejected because:** Option 1 — unchosen legal exposure. Option 2 — a warning at batch scale
is not a control.

## Consequences

**Easier:** the legal question is answered once, at research time, in code.

**Harder:** a genuinely attractive out-of-region lead cannot be added without an ADR. That
friction is the point.
