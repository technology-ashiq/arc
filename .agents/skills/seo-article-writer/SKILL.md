---
name: seo-article-writer
description: Drafts one article for an APPROVED growth cluster row, anchored to the approved voice exemplars. Use when drafting a blog article for the arc site. Structure is not prescribed - the exemplars are the only style input.
---

# SEO Article Writer

Draft one article for one row of an **approved** cluster.

## What changed, and why it reads like a downgrade

v0 of this skill was 857 bytes of structure prescription: *"produces the same deterministic
structure every time"*, *"H1, 5-8 H2s, FAQ section"*, keyword placement quotas. **All of it is
gone.** ADR-1110 makes that one-way.

The reasoning: a rule that says "every article has 5-8 H2s and an FAQ" produces articles that pass
and are indistinguishable from one another. Compliance-shaped slop is still slop, and arc has
already paid for this exact lesson once at a gate level (ADR-0049: a pass condition that is only an
absence cannot detect mediocrity). So the interface and the name survive; the rules do not.

If you want a structure rule back, ADR-1110 names the door: its own ADR, arguing the creativity
cost explicitly and naming what it forbids the writer from doing. Editing this file instead is the
drift the ADR exists to prevent.

## Inputs

- **The approved cluster row** - keyword, intent, evidence URL, gap note. The row comes from
  `initiatives/growth/clusters/<id>.json` and the cluster must be approved at gate 1 (ADR-1112).
- **The approved exemplars** - every file in `initiatives/growth/exemplars/`. These are **the only
  style input.** Do not add style rules of your own here, in the prompt, or in your head.
- **The internal-link plan** - drawn only from rows of the same approved cluster. Never invent a
  link target; a link to a page that does not exist is a broken promise in public.

## How to draft

Read the exemplars. Write the article the way they are written. That is the whole instruction, and
its shortness is the point - anything added here becomes prescription with extra steps.

Three things are law rather than style, and they come from E3 (Tier E, unamendable):

1. **Every claim of fact carries a source link.** A figure, a date, or someone else's finding
   without a link is a fabrication risk, and `citation-lint` fails the draft for it.
2. **No fabricated numbers, benchmarks, case studies or testimonials.** Arc's own results may be
   cited **only** where a receipt exists for them. Anything simulated is labelled simulated.
3. **A point of view.** Every article carries at least one original practitioner insight - something
   arc learned by doing, not restated from the sources. This is judged by a human at the review
   pack and is deliberately not a lint: "carries an original stance" is not detectable by a marker
   list, and pretending otherwise would be the prescriptive turn arriving in disguise.

## Output

MDX with frontmatter `{title, meta, slug, cluster_id, template_id, citations[]}`, then the body.

The draft is a **branch and a pull request**. The machine never merges it - a human does, every
time, without exception (E2, ADR-1102).

## What the gates can and cannot catch

`slop-lint` reports bad patterns it found from a versioned marker list. It never reports what is
absent and never scores. **Text that trips no marker is not thereby good** - a marker-free draft
that is still slop passes both lints by construction, and the honest-limit fixture in
`tests/growth-lints.bats` exists to keep that fact in the test suite rather than in someone's
memory. The human gate is the control that catches it.
