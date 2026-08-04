# ADR 0404 — The personalization gate splits deterministic FAIL from heuristic BELOW-BAR

**Status:** accepted
**Date:** 2026-08-04
**Product:** `leads`
**Reversibility:** two-way
**Revisit trigger:** the trial ledger shows a BELOW-BAR class with zero false positives over
≥3 campaigns — then it earns promotion to FAIL through the normal ritual.

## Context

`ADR-0049`'s lesson: **a pass condition that is only an absence cannot detect mediocrity.**
"References nothing specific → FAIL" means a draft passes by breaking no rule, and
compliant characterless mail sails through. But the inverse error is real too: hard-gating a
heuristic check means one false positive silently kills a good draft and the trial ledger
never collects the evidence that would justify the gate.

Separately, per-draft checks are structurally blind to template-blast: 25 drafts can each
cite a real fact and still be the same email.

## Options considered

1. **One FAIL class, hard gate** — pros: simple. cons: false positives kill good drafts
   silently; no evidence accrues.
2. **All classes WARN-first** — pros: no false-positive damage. cons: a draft citing a fact
   that does not exist in the dossier could reach a human and get approved. Unacceptable —
   that is fake personalization.
3. **Split by determinism** — deterministic/structural checks hard-gate from birth;
   heuristic checks WARN on the inbox item during trial.

## Decision

**Option 3.**

**FAIL — deterministic, structural. Blocks inbox entry from birth:**
- no lead-specific reference at all
- a cited fact that does not exist in the dossier (**fake personalization becomes
  mechanically impossible**)
- no fact→offer relevance line

**BELOW-BAR — heuristic. WARN-first in trial, rendered ON the inbox item:**
- fewer than N dossier-cited facts (N default 2, config)
- slop markers ("hope this finds you well"; claimed familiarity with no evidence link)
- **cross-draft similarity**: campaign-scope body comparison by shingle overlap, ≥X%
  identical → BELOW-BAR (X default 70%, config)

**PASS** — neither.

**Citation mechanism:** draft frontmatter lists `fact → dossier-source` pairs. The lint
verifies **both directions**: the fact appears in the draft, and the source exists in the
dossier. Plus the fact→offer relevance line from REQ-01 must be present.

The similarity threshold is 70% and not 100% because some overlap is legitimate — the offer
sentence repeats across every draft. Whole-body cloning is what this catches.

**Promotion of any WARN → FAIL happens only via the trial-ledger ritual, and only after an
adversarial pass** (this lint is parser-class).

**Confidence:** high on the FAIL class (deterministic and fixture-provable); the specific
defaults N=2 and X=70% are judgment and are config for exactly that reason.

**Rejected because:** Option 1 — false positives destroy good drafts and starve the ledger.
Option 2 — lets fake personalization reach a human.

## Consequences

**Easier:** a draft that invents a fact cannot exist. The approver sees warnings inline and
decides with them in view.

**Harder:** the dossier must be structured enough to verify citations against — which is why
`ADR-0409` makes provenance a closed allowlist rather than free text.

**Shared philosophically** with growth's content lint (the slop-marker list), though the two
lints are separate code.
