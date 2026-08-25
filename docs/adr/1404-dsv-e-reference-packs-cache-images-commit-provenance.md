# ADR 1404 — DSV-E: reference packs cache images locally, commit provenance, and teach principles not pixels

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a composed variant is found to reproduce a specific pack screen's layout
or ornament rather than its principle — the pack is then teaching appearance and the
adaptable-principle discipline has failed.

## Context

Cycle 3's briefs named a **reference bar** in a sentence. A sentence-only bar produced
sentence-only judgments: the critic could say "not world-class" but could not say what
world-class looked like beside this, and the composer had nothing to reach for. Meanwhile
[ADR-0039](0039-des-g-external-tools-deferred-w3.md) deferred external tooling until the loop
proved itself — it now has, and the deferral's condition is met.

## Options considered

1. **Commit reference screenshots to the repo** — pros: the pack travels with the run / cons:
   copyright exposure, repo weight, and it invites appearance-copying.
2. **Cache images locally, commit provenance only** — pros: the composer and critic see real
   pixels while the repo carries only facts about them / cons: packs are not reproducible from
   a clone alone.

## Decision

Option 2. A new `design-curator` agent (vision mandatory) builds a per-brief pack of **5–8
screens** drawn from registry sources whose `allowed_use` includes `reference-only`, cached to
**`.claude/state/design/refpacks/<brief>/`** — already gitignored at any depth by `.gitignore`
L51, so "no images in git" is enforced by an existing rule rather than a new one. Verified
2026-08-23: `git check-ignore` resolves that path to the `**/.claude/state/` pattern.

The repo commits **`sources.md` only**: URL · timestamp · content sha · **adaptable
principle** · avoid-this.

Both the composer and the critic **must read the pack with vision before judging or composing**
— the same iron-law grammar the critic already carries for the rendered screenshot.

Copying a specific design stays what PLAN-design v1 §2.8 called it: slop with extra steps, and
legal risk.

## Consequences

Easier: BELOW-BAR becomes concrete ([ADR-1406](1406-dsv-g-below-bar-is-anchored-to-the-pack.md))
and the composer has a real bar rather than an adjective. Harder: a pack is machine-local, so
two machines can hold different packs for one brief and the committed sha is the only way to
tell; and the composer's read surface must widen
([ADR-1415](1415-the-composer-iron-law-gains-a-read-path-allowlist.md)) because an image cannot
be inlined into a prompt the way the brief's text can.
