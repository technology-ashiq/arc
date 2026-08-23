# ADR 1405 — DSV-F: the jury ranks craft first, over N items, on a model-mixed panel

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the owner's controlled blind score and the jury's ranking invert each
other twice running — the jury is then measuring something the owner does not value, and the
rubric is wrong rather than the panel.

## Context

`.claude/agents/design-jury.md` is hardcoded to **four** items — in its description, in a
section titled *"Why four items, not three"*, in `item-a`…`item-d`, and in an output contract
demanding "four entries, exactly this form". [ADR-0070](0070-composer-seat-stays-balanced-workhorse.md)
needed six items and had to log a **prompt-override deviation** to get them. A contract that
must be overridden to be used is a contract that ends here.

Separately, ADR-0070's own finding stands as a standing warning: **the owner and the jury
inverted each other on the same six artifacts.** No single agent ranking substitutes for the
owner's eyes.

## Options considered

1. **Keep four items and override the prompt per run** — pros: no contract change / cons:
   normalises deviation logging, and every rival or control item added breaks it again.
2. **Amend the contract to N items and mix the panel's tiers** — pros: rivals, references and
   controls all fit without deviation / cons: touches a governed `model:` line.

## Decision

Option 2. The juror contract is amended for **N items**, and that deviation class ends.

Jurors rank **craft**: hierarchy, type quality, spatial rhythm, colour intent, confidence.
Compliance is not theirs — it belongs to the lint and the critic
([ADR-0048](0048-agents-judge-scripts-measure.md): agents judge, scripts measure).

The panel is **model-mixed**: at least one juror sits on a different tier than the composer.
Under `docs/adr/0069-balanced-model-policy.md` this is not an arbitrary mix — that ADR defines
**high-judgment** as the tier that *"grades other work, gates a decision"*, which is exactly
what a juror does. Seating one juror at high-judgment is therefore the tier definition applied,
and it satisfies the mix by construction since the composer sits at balanced-workhorse. The
change ships as a reviewed diff citing ADR-0069, never as a quiet frontmatter edit.

Full mesh diversity waits on `ARC_LLM_*` ([ADR-0914](0914-the-real-event-candidate-is-a-second-model-under-the-proven-driver.md)
direction); nothing here blocks on it.

## Consequences

Easier: reference items, plain-prompt controls and rival drafts all enter one jury without a
prompt override. Harder: one juror now costs high-judgment tokens per run, and the N-item
amendment touches every place the four-item count is spelled — which in this file is at least
five separate spellings, so the edit is a mechanical sweep, not a single find-and-replace.
