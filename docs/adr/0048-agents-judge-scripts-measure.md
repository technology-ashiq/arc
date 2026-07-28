# ADR 0048 — Agents judge, scripts measure: the critic never cites a measured value

**Status:** accepted
**Date:** 2026-07-28
**Reversibility:** two-way
**Revisit trigger:** a critic model samples colour accurately across a pinned fixture set — ≥10 swatches of known RGB read back within tolerance, and ≥3 known contrast pairs computed correctly from the image alone. Until that passes, the ban stands.

## Context

Phase-00's live demo produced the finding this ADR exists for.

Round 1 of the real-route critique reported a `VIOLATION` with what looked like hard evidence:
the L0/L1/L2 trust badges rendering at `rgb(122,90,48)`, contrast `2.76:1`, below the 4.5:1 AA
floor — complete with the WCAG relative-luminance method named.

Independent measurement (`getComputedStyle` in the real browser, plus a WCAG script) found:

| element | critic claimed | actually measured | verdict |
|---|---|---|---|
| `.lvl` timeline badge | `rgb(122,90,48)`, 2.76:1 | `rgb(137,135,129)`, **4.85:1** | PASS |
| `.kind` meta label | `rgb(122,90,48)`, 2.76:1 | `rgb(137,135,129)`, **4.49:1** | marginal FAIL |
| `.lbadge` L2 pill | `rgb(122,90,48)`, 2.76:1 | `rgb(183,211,246)`, **7.52:1** | PASS |

The claimed colour exists in none of them. The arithmetic was *correct for the colour it
invented* — 2.76:1 is the right ratio for `rgb(122,90,48)` — so the error was entirely in the
sampling, not the maths. Confirmed in round 2: handed the real hex value in its prompt, the
same critic computed 5.38:1 / 4.98:1, matching the independent script exactly.

Two things make this worse than an ordinary wrong finding:

1. **Fabricated precision reads as verified.** A finding carrying an RGB triplet, a ratio to two
   decimals, and a named formula invites the creation side to fix without checking. Fixing to
   satisfy a hallucinated measurement means *damaging a correct design* — the exact opposite of
   what the critic is for. It was caught here only because the value was checked.
2. **It cannot be fixed by prompting harder.** The model is not sampling pixels; it is forming a
   visual impression and then dressing it in numbers. "Be careful" does not change that.

Worth recording honestly: the critic's **instinct was sound**. A real AA failure (4.49:1) did
exist in that area — on a different element, at a different magnitude, than the one it named.
Its non-numeric findings in the same runs all held up: placeholder content, hierarchy, clipping,
colour-vocabulary collisions, and a downstream layout regression a fix introduced.

The frozen plan already assigned contrast to the deterministic layer ("design-lint v0 checks …
declared contrast pairs pass AA", §2.10). This finding upgrades that line from a nice-to-have
to load-bearing.

## Options considered

1. **Critic reports suspicion, never values; design-lint owns every measurable property.** The
   critic says "these labels look too dim against the card — verify with the lint" and stops.
   Con: until design-lint v0 ships (Phase 01), measurable defects have no authoritative number.
2. **Let the critic keep citing numbers, but require it to verify with a tool first.** Con: it
   has no measuring tool, and giving it one means widening a deliberately narrow permission set
   (ADR-0034) and turning the critic into a script-runner whose judgment is entangled with its
   measurements. It also does not solve the failure — an agent that *can* measure will still
   sometimes report the impression instead.
3. **Treat it as prompt quality and move on.** Cheapest. Con: it will recur silently, and the
   next occurrence will be fixed rather than caught, because nobody re-measures a finding that
   already carries a number.

## Decision

Option 1, stated as a general rule for arc:

> **Agents judge; scripts measure.**

The critic reports what it *sees* and may flag a suspected measurable defect, but it must never
state a sampled colour, a computed ratio, a pixel dimension, or any other value presented as
measured. Deterministic, machine-checkable properties — contrast, target size, token usage,
placeholder strings — belong to `design-lint`, which reads the CSS and the DOM and computes
them exactly.

This extends ADR-0047 one layer down. That ADR said an agent may produce evidence but only a
script may record a verdict; this one says an agent may produce a judgment but only a script may
produce a number.

`design-lint` v0 (Phase 01, REQ-05) therefore owns contrast and target-size checks as a
first-class requirement, not an extra. It must check against the floor the **brief declares**,
not a hardcoded constant — the ≥44px target floor used here is this project's declared standard
and WCAG's AAA figure (2.5.5); WCAG AA's own minimum (2.5.8) is 24px. A lint that hardcodes
either number silently overrides the product's stated contract.

## Consequences

**Easier.** No finding can carry invented evidence. A critique that says "suspect — verify with
lint" is honest and still actionable, and the lint's number is reproducible by anyone. The
critic keeps doing what vision is genuinely good at: hierarchy, rhythm, alignment, placeholder
content, vocabulary, and spotting a regression a fix introduced.

**Harder.** Between now and design-lint v0, contrast and target-size defects are suspicions with
no authoritative number. Phase 01 closes that gap; until then the creation side measures before
acting on any such finding — which is what should have happened by default anyway.

**Watch for.** The same failure mode in any other judging agent that describes an image or a
rendered artifact. The rule is arc-wide, not design-specific.
