# ADR 1010 — LEG-J: the seven kickoff-day decisions

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** the probe runner's URL-fetch arm reports green on a venture whose pages a human
then finds wrong or missing — a probe that can pass while the thing it probes is broken is worse
than a manual checklist, and the automation depth is re-decided.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). LEG-J is the one decision the v1.1 freeze left OPEN, with the instruction to decide it
at kickoff and record it with the kickoff ADR set. Five items were named; a sixth (the policy-surface
audit) is added because the design source made it a kickoff act, and a seventh (route paths) because
the question panel found a one-way door hiding inside an unstated default.

## Decision

**1. ADR century — 1000–1099.** Claimed at birth per `PORTFOLIO.md`'s band table, verified across
**all sixteen sibling worktrees** rather than this one alone: highest ADR anywhere is 0914 (bench);
no tree carries a 1000-series file or band row. The band table and `wip-line` each see one worktree
only, which is how engine's Cycle 7 lost a number to a `memory`-lane 0207 it could not see.

**2. Code home — confirmed as planned.** `products/legal/` (templates, fixtures, `manifest.json`) and
`.claude/scripts/legal/arc-legal.mjs` (zero-dep Node ESM), tests at `tests/legal-*.bats`, fixtures at
`tests/fixtures/legal/`. Verified free: `products/` holds 14 products, none named `legal`, and no
legal code exists anywhere in the tree. Details in ADR-1005.

**3. First render target — the FIXTURE venture, then LexOS.** Two reasons, both structural. The
byte-reproducibility and TOCTOU fixtures need a venture whose facts can be mutated freely, and real
operator facts (legal name, address, grievance contact) must not become permanent test data in a
public repo. LexOS lands in Phase 3, on real facts, as the closing proof.

**4. Probe-runner automation depth v1 — a URL-fetch arm only; everything else is a manual pack.**
The automated arm fetches each page URL and asserts HTTP 200 plus a non-empty body — the one row
that catches "approved ≠ served" without a browser. Footer/signup DOM presence, the deletion mailbox
answering, and the cancel-path/screenshot comparison stay **manual rows with recorded evidence**.
Rationale: probe automation is the plan's designated cut #1, and a DOM assertion against a venture
UI that does not exist yet (LexOS has no footer at all) would be a green light for nothing. The
probe reads URLs and **never local files** — self-attestation from render artifacts must remain
structurally impossible.

**5. Checklist screenshot storage — venture-local, arc links.** Screenshots and probe evidence live
in the venture repo at `legal/evidence/<YYYY-MM-DD>/`, referenced by relative path from the rendered
checklist. arc's own evidence bundle at `initiatives/legal/evidence/phase-NN/` **links** to them and
never copies them (ADR-0058: lanes link to history, never copy it; A10: never delete).

**6. Policy-surface audit — no `hq.policy.yaml` row, and `targets.publish` stays empty.** The module
adds no `processes/*.process.yaml`, so the birth rule does not apply to it; it requests no capability
grant, because it writes local files under the operator's own invocation and emits through the
existing emitter. `targets.publish: []` remains empty and Constitution E2's *"publishing under
Ashiq's name"* remains ungrantable. A legal module that quietly created arc's first permitted publish
target would be the worst possible place to create one.

**7. Route paths are FACTS FIELDS with pinned defaults** — added at the question panel's prompting,
because the alternative was a genuine one-way door. Hard-coding page URLs would bind them into the
provider dashboard, the DPDP notice cross-links and every cached copy at first publish, and moving
them later would cost a re-publish. Instead each page's path is a **FORMAT-tier** field
(anchored `^/[a-z0-9/-]{1,64}$`, ADR-1002) with defaults `/legal/terms`, `/legal/privacy`,
`/legal/refunds`, `/legal/shipping` plus a `/legal` hub, and `/contact`, `/pricing`, `/about` at the
root where a reviewer and a customer both expect them. The checklist and the notice cross-links read
these fields, never a constant.

**Confidence:** high for 1, 2, 5, 6 (all verified against the tree this session); medium for 3, 4, 7
(judgement calls sized to the appetite, each with the revisit trigger above or in ADR-1002).

## Consequences

Easier: nothing in the build waits on an owner answer, and each of the seven has a written reason a
retro can argue with.

Harder: item 4 ships a checklist that is mostly manual, so REQ-04's "checks production, not
intentions" is only as good as the human running it. That is the designated cut being taken
deliberately, up front, rather than discovered at 100% appetite — and the manual rows carry recorded
evidence precisely so the gap is visible rather than assumed closed.
