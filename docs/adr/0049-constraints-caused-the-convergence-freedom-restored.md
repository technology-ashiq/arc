# ADR 0049 — The explore loop's own constraints caused the convergence: creative freedom restored, verification kept

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way, with one asymmetry — `--pin-font` restores the old render recipe on a flag, and the agent/brief/gate changes revert as ordinary file edits; but a hash recorded under the new default recipe is not comparable to one recorded under the old, so receipts from either side of this ADR must be re-rendered rather than diffed.
**Revisit trigger:** two consecutive explore runs where every variant comes back `BELOW-BAR` and the fix round produces no change the owner can see on sight — the class is being used as a taste veto instead of a bar; OR two consecutive runs where all three variants outrank the reference screen in blind ranking and the owner still scores the set below 50 — the reference bar is too low to carry judgment.

## Context

On 2026-07-30 arc's design-explore loop was found to be **net-negative on visual quality**.
The same model produced clearly better design with the pipeline switched OFF than with it on.

The owner scored the pipeline's three "genuinely different directions" **23/100** and said they
all looked like one design. A controlled test confirmed it: three general-purpose agents, given
the same content and a plain "make it world-class" prompt — no brief, no token constraint, no
critic, no jury — produced materially better work
(`docs/design/experiments/2026-07-30-plain-prompt-baseline/`).

Four causes were found. **All four are arc's own rules. None is a bug.** Every script did
exactly what it was written to do.

1. **The renderer deleted typography before judgment.** `design-render.sh` injected
   `font-family: Arial, Helvetica, sans-serif !important` on `html`, `body` and `*` for every
   render, plus antialiasing off and font-synthesis off. The critic and all three blind jurors
   therefore judged an **Arial version** of every variant. Typography is the strongest single
   carrier of design character; removing it removes most of what distinguishes two directions.
   The pin was added for cross-machine hash reproducibility during issue #57 — so the
   determinism hardening is what made every design look identical. This is the deepest cause,
   and it lived in the renderer, invisible to every brief, agent prompt and ADR above it.
2. **Visual identity was frozen by convention.** Composers were handed an existing product's
   exact palette with the instruction "do not invent a hex", and the brief told them that
   departing from the existing stance would make the pilot "a rewrite instead of an explore".
   The only axis left to vary was information architecture.
3. **The director assigned structure only.** Its six theses — command center / guided workflow /
   canvas / narrative / review workspace / ambient assistant — are all *structural*. There was no
   art-direction axis, so three structurally-divergent variants sharing one visual language
   passed the divergence call correctly (ADR-0037's matrix measures IA, and IA did differ).
4. **Nothing in the loop could say "this is not good enough".** PASS was defined as zero
   `VIOLATION` findings, so PASS meant *broke no rule*. `WEAKNESS` and `POLISH` never fail a run
   by design. The jury could only rank three variants against each other, so it always returns
   the best of three — and can never report that all three are mediocre.

Causes 1-3 removed the variance. Cause 4 removed the ability to notice.

## Options considered

1. **Remove the constraints that were flattening the work; add a bar that can fail everything.**
   Un-pin the font by default, hand visual identity back to the composer, give the director an
   art-direction axis with its own failing verdict, add a finding class that fails compliant-
   but-weak work, and put a real shipped screen into the blind ranking. Con: loses cross-machine
   hash comparability by default; adds a judgment-shaped failure class; adds work to brief-writing.
2. **Keep the constraints and add a quality gate on top.** Cheapest structurally — leave the
   renderer, palette rule and thesis catalogue alone and bolt a "is this good?" check onto the
   end. Con: the constraints *were* the reason every page looked the same, so the gate would
   have failed every run without ever pointing at the cause. A gate that always fails is not a
   gate, it is a stall.
3. **Abandon the explore loop; use a plain prompt.** The baseline experiment shows a plain
   prompt beat the pipeline today, so this is the empirically-backed lazy option. Con: the
   plain-prompt run has no verification, no receipts and no blind ranking — it produced better
   pages with no way to know that except the owner looking. The experiment indicts the
   **constraints**, not the structure; discarding the structure throws away the part that was
   working to fix the part that was not.

## Decision

Option 1. Implemented, then recorded here — this ADR documents what changed, it does not
propose it.

| Surface | Change |
|---|---|
| `.claude/scripts/design/design-render.sh` | Font pinning and aa-off are now **opt-in** via `--pin-font`; the default renders true type and true antialiasing. Added `--media light\|dark` (light was previously forced). `RECIPE` is computed and recorded — `font-true;aa-on` vs `font-pinned;aa-off` — so a hash difference stays attributable to *page* vs *recipe*. |
| `.claude/agents/ui-composer.md` | Full creative freedom: colour, typography, scale, depth, ornament, illustration and motion character belong to the composer. Colour values still live in `tokens.css`, reframed as a constraint on **where** values are written, not **which**. The thesis is now structural AND art-directional. |
| `.claude/agents/design-director.md` | A 4-axis art-direction assignment — palette · typography · density & rhythm · surface & ornament — plus a second, independently-failing verdict line: `Art-direction call: … N of 4 axes`, requiring N ≥ 3. |
| `.claude/scripts/design/design-explore.sh` | New `art-call-missing` hard fail enforcing that second call, using the same line-anchored anti-mention grammar as the existing director call. |
| `.claude/agents/design-critic.md` · `design-critique.sh` | New `BELOW-BAR` finding class for compliant-but-not-good-enough work, which **fails** a run. PASS is now zero `VIOLATION` **and** zero `BELOW-BAR`. |
| `.claude/agents/design-jury.md` | The blind ranking now carries **four** unlabelled items: the three variants plus a real, shipped, world-class reference screen for a comparable job. "All three variants below the reference" is a FAIL derived purely from ordering. |
| `docs/templates/design-brief-template.md` | New `Reference bar` and `At its best, this is…` fields in section B. The slop kill-list is reframed to ban the *unmotivated* version of a technique rather than the technique. |

On determinism: the **stable shutter** — shoot twice, publish only an agreed hash — now carries
reproducibility on its own. What is genuinely traded away is hash comparability *across
machines*, which `--pin-font` buys back when that is what a run needs.

### What did NOT change, and why

The **no-absolute-scores** rule survives completely intact. There is still no number anywhere in
the loop. The reference screen is a fourth *unlabelled* item in a blind ordering, so it supplies
a real bar without supplying a target — Goodhart is still avoided, because an agent cannot chase
a score that does not exist, and agents chasing a score converge on safe-average, which is the
disease this ADR is treating.

Also untouched, deliberately:

- **ADR-0034** — the critic still has no edit tool, enforced mechanically.
- **ADR-0047** — an agent may produce evidence; only a deterministic script records a verdict.
  `BELOW-BAR` is a finding the critic *declares*; `design-critique.sh` still counts it and owns
  PASS/FAIL.
- **ADR-0048** — agents judge, scripts measure. `BELOW-BAR` is a judgment, and carries no number.
- **ADR-0035** — the closed spine event vocabulary is unchanged.
- **ADR-0040** — the two external evidence streams are unchanged.

Design freedom was the goal. Demolishing verification discipline was not, and did not happen.

## Consequences

**Easier.** Variants can now actually diverge on the axis that carries most of a design's
character, and the critic and jury judge what a user would see rather than an Arial reduction of
it. The loop can, for the first time, return "all of this is not good enough" instead of
silently promoting the best of three weak pages. A brief that names a reference bar tells the
composer what altitude it is aiming at without telling it what to draw.

**Harder — and this is a real loss.** Cross-machine render hash comparability is gone by default.
Two machines rendering the same route will produce different bytes unless both pass `--pin-font`,
and the `RECIPE` field is what keeps that difference diagnosable rather than mysterious. Anyone
comparing hashes across machines must now do so deliberately.

**Watch for.** `BELOW-BAR` is a judgment call with no measurable definition, which is exactly the
shape of a class that gets inflated (every run fails; the gate becomes noise to route around) or
under-used (nothing ever fails; we are back where we started, with extra ceremony). It needs
watching over the next several runs — the revisit trigger above names the inflation half.
Separately, the reference screen must be chosen per brief, which is genuine new work for whoever
writes one: a badly-chosen reference sets the bar wherever it happens to sit, and the jury will
faithfully enforce that mistake.
