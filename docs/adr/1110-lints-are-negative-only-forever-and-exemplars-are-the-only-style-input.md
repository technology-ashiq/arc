# ADR 1110 — Lints are negative-only forever, and exemplars are the only style input

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** never by drift. A prescriptive rule may be added only by its own ADR that
argues the creativity cost explicitly and names what it forbids the writer from doing.

## Context

GRO-G makes this a constitution for growth's gates: lints catch **bad patterns** from a versioned
marker list; they never prescribe style, structure, or length. The reasoning is that a lint which
says "every article has 5–8 H2s and an FAQ" produces articles that pass and are indistinguishable
from each other — compliance-shaped slop, which is still slop.

Arc has already learned this shape at a gate level. `PASS = zero VIOLATION` in the design cycle
meant "broke no rule", so compliant characterless work passed five runs running, and ADR-0049 had
to add a class that fails for *insufficiency*.

**The tension nobody wrote down:** the design source says
`.claude/skills/seo-article-writer` is "upgraded, never rebuilt". Read today, that skill's entire
body is prescription — *"Produces the same deterministic structure every time"*, "H1, 5–8 H2s, FAQ
section", "keyword in the H1, first 100 words, one H2, and the meta description". It is 857 bytes
of exactly the thing GRO-G forbids. So "upgrade" here means **gutting its body and keeping its
name and interface**, and that is worth saying out loud, because "upgrade, never rebuild" reads
like the opposite instruction.

## Options considered

1. **Negative-only lints; exemplar files are the only style input; the v0 skill's prescriptive
   body is deleted in the upgrade.**
2. Keep the v0 structure rules as a starting scaffold and add negative lints on top. Con: the
   scaffold *is* the style prescription, so the constitution would be violated by the first file
   growth touches.
3. Positive lints ("has an FAQ", "has ≥3 internal links"). Con: this is option 2 with the
   prescription moved into the gate, where it is harder to see and harder to remove.

## Decision

**Option 1.**

- **slop-lint** is a versioned marker list of *bad* patterns and nothing else. It reports what it
  found and where. It never reports what is absent, and never scores.
- **citation-lint** checks that a claim-of-fact carries a source link and that the link resolves.
  A dead link is a **WARN**, not a FAIL — the web rots, and a gate that FAILs on the internet's
  weather is a gate people learn to bypass.
- **The POV floor is a human judgment, never a regex.** It is a line in the review pack the human
  answers, because "carries an original practitioner stance" is not detectable by a marker list and
  pretending otherwise would be the prescriptive turn arriving in disguise.
- **The honest-limit fixture is mandatory:** a sample that is marker-free and still slop must
  **pass** the lint and be caught at the human gate. It is committed as a fixture so the lint's
  limits are documented in the test suite rather than assumed away. A gate that cannot fail its own
  weakest case is a gate nobody knows the shape of.
- **The lints get the adversarial pass before either is allowed to FAIL anything** — two fresh
  surfaces, per the parser-class rule, one on the marker logic and one on the file/encoding
  boundary. The attacker's prompt carries this lane's running defect list, and each fixed defect is
  checked in every *other* file.

**Evidence:** design source GRO-G, REQ-02, non-negotiables · `docs/adr/0049-*` (a pass condition
that is only an absence cannot detect mediocrity) · `.claude/skills/seo-article-writer/SKILL.md`
(the v0 body, read 2026-08-12) · root `CLAUDE.md` § Build process (adversarial pass is mandatory
verification, two surfaces, attacker carries the defect list).
**Confidence:** high.
**Rejected because:** option 2 violates the constitution with the first file edited; option 3
hides the prescription inside the gate.

## Consequences

Easier: the writer can be surprising, and the gate can still stop the specific failures worth
stopping. Harder: quality now genuinely depends on a human reading ten articles — the lints
explicitly cannot carry it, and this ADR is the reason nobody should later be surprised that they
do not.
