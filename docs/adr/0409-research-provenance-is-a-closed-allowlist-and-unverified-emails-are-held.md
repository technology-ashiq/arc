# ADR 0409 — Research provenance is a closed allowlist; unverified emails are HELD, never sent blind

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
**Revisit trigger:** a legitimate research source genuinely fits none of the four classes —
then the allowlist gains a fifth by edit *and* fixture, never by falling through to "other".

## Context

Two failure modes converge here. First, purchased lists and login-wall scraping are things
the plan says No to — and a rule enforced by policy text is a rule that gets bent at 11pm.
Second, bad addresses bounce, and bounces burn the domain that `ADR-0402` spent 2–4 weeks
warming.

## Options considered

1. **Free-text provenance** — pros: flexible. cons: "found online" is not an audit trail,
   and lint can enforce nothing against it.
2. **Allowlist with an `other` escape hatch** — pros: never blocks research. cons: `other`
   becomes the modal value within a week; the gate is decorative.
3. **Closed allowlist, no escape hatch; unverifiable emails HELD.**

## Decision

**Option 3.**

**Provenance classes — closed allowlist:**

`firm site` · `public directory` · `public listing` · `manual-LinkedIn-note`

Anything else is rejected by lint. **Purchased-list and login-wall provenance are
structurally rejected** (fixture), not discouraged by policy text.

**Email verification:** method selected from the capability report (a vetted verifier, or at
minimum an MX + syntax check). **Unverifiable → HELD, never sent blind.** Bounce outcomes
wire to the `ADR-0403` HOLD/FREEZE breakers.

**Rejected candidates keep a record too** — exclusion reason + source. The 25 must be a
*filtered set with an audit trail*, not a survivor list. A rejected candidate with no
exclusion reason is invalid (fixture).

**Every dossier carries:** why-they-fit narrative · ≥2 source links · provenance class ·
geography (`ADR-0406`) · verified email · **≥1 lead-specific fact with its evidence URL and
an explicit fact→offer relevance line**. That last field is what `ADR-0404`'s lint verifies
against — personalization cannot be checked against a dossier that does not carry checkable
facts.

**Confidence:** high on the mechanism. The specific verifier is deferred with the provider
pick (`ADR-0402`) and is tracked in the assumptions ledger.

**Rejected because:** Option 1 — unenforceable. Option 2 — the escape hatch eats the rule.

## Consequences

**Easier:** "where did this lead come from" has four possible answers, all auditable, and
`ADR-0404`'s citation check has structured facts to verify against.

**Harder:** research is slower — a lead that cannot be sourced to an allowlisted class is
dropped even when it looks perfect. At 25 leads that is affordable; it is one of the reasons
25 is the number.
