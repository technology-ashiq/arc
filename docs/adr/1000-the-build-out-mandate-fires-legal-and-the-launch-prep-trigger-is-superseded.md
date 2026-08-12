# ADR 1000 — the Build-out Mandate fires legal, and the launch-prep pull-trigger is superseded

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** the cycle closes with six rendered pages that no venture has published and no
second render target scheduled — the mandate's premise (build now, use shortly) has then failed,
and the next cycle re-parks legal until a venture is actually at a publish gate.

## Context

`PLAN-legal-pack.md` v1.1 gates this build behind a pull: *"first venture reaches launch prep —
policies before real payments."* No such receipt exists. The plan says so itself and invents
nothing: the operational fact behind the module is EXTERNAL (a payment provider withholds
live-mode keys until policy pages exist on the merchant site), not a receipted arc event.

On **2026-08-09** the owner ruled that arc is the sole priority, that ventures are deprioritized,
and that trigger-waiting has stopped. That ruling reached the spine on 2026-08-12 as
`decision.recorded` **`01KZTM348858PDH44K4HA64CVA`** (deciding `approval.requested`
`01KZTM2DYQXXYHVBJZC462D982`), recorded by the engine lane's Phase 04 and verified in this session
by reading `.claude/state/hq/events/2026-08-12.jsonl` on the canonical clone — both event ids
present, neither in `_quarantine/`.

Under **Constitution A8** a build starts when something pulls it, and a recorded owner decision IS
that pull. `PLAN-executor.md`, `PLAN-growth.md`, `PLAN-ledger.md`, `PLAN-memory.md` and
`PLAN-bench.md` (ADR-0900) each fired off the same ruling with the same grammar.

**Kickoff verification also falsified the plan's own driver.** The design source names LexOS as the
venture blocked at a payment provider's activation gate. It is not, today — see ADR-1011. What
remains true, and is enough: LexOS is in production, it holds law firms' *clients'* privileged
matter, and it has **zero policy pages and no footer** (`app/page.tsx` is a twelve-line stub; the
route tree is `/`, `/login`, `/signup`, `/auth/callback`, `/dashboard/*`, `/api/*`). arc's own
public site (PLAN-growth's first client) is the second render target and needs the same six pages.

## Options considered

1. **Stay asleep until a venture hits a publish gate** — honest and zero-waste, but the owner has
   ruled against exactly this waiting, and the gap is not hypothetical: a production app is
   processing third-party privileged data with no privacy notice and no grievance route.
2. **Build the module now, on a fixture venture, with one real venture as the closing proof** —
   costs one cycle before the pull is receipted, and forces the plan to state honestly which value
   is proven now and which is pending.
3. **Write only the six pages for LexOS by hand, no engine** — cheapest today, but the second
   venture pays the same cost again, nothing is receipted, and there is no way to prove a served
   page matches an approved one.

## Decision

**Option 2.** Build the module now under the mandate. Every ADR in the 1000 century cites this one.

**Two shape decisions follow from it, recorded here rather than left implicit:**

- **The century is 1000–1099.** Claimed at birth per `PORTFOLIO.md`'s band table, which reads
  `1000–1099 | next lane to be born`. Verified against **all sixteen sibling worktrees**, not just
  this one: the highest ADR number anywhere on this machine is 0914 (bench), and no tree carries a
  1000-series file or a 1000-series band row. The band is claimed the moment these files are
  written, not the moment they merge (ADR-0061 precedent, scheduler's unmerged 0800s).
- **Phase 0 is a steel thread, which the design source's Phase 0 was not.** The design source
  front-loads *all* content authoring into a phase that renders nothing, so at 40% of appetite
  nothing would have gone input → render → output. Phase 0 is restructured to carry the **three
  core pages** (T&C · Privacy · Refund/Cancellation) through a real render function and all three
  lints, end to end. Content stays first — those three hold every hard clause — and the phase-0
  deliverable is now exactly the plan's own kill-criteria floor (*"ship the three core pages'
  content + bank the engine"*), so the fallback is reached by building forward rather than by
  retreating.

**How the ruling reaches the spine for THIS cycle:** kickoff emits `kickoff.done` and an
`approval.requested` (gate `kickoff`). Kickoff does **not** emit a `decision.recorded` in the
owner's name — a decision receipt written by the session that wanted the decision is not a receipt
(ADR-0900's rule, kept).

**What this ADR does not do:** it does not claim a venture is blocked at a payment gate today. The
census stands as recorded fact and the consequences below are the price of building anyway.

## Consequences

Easier: the module exists before the first venture needs it, and REQ-08 proves the machinery on
real facts rather than on fixtures alone.

Harder: **the closing evidence is honestly split.** REQ-08's live-deploy and production-probe rows
record `OPEN-at-venture-resume` rather than green — LexOS is PAUSED under the same mandate, and a
paused venture cannot deploy. The C2 REQ-07 pattern applies: mechanism proven, live value pending.
A cycle that ships a renderer nobody has published through is the `arc-policy` 2026-08-10 failure
shape (an enforcement engine shipped fixture-proven, 0 real emissions across 975 events), which is
why REQ-08 requires a real facts file, a real approval and a real commit into the venture tree —
not a fixture — and why the retro must report the production publish count from the spine.

If this goes wrong: the revisit trigger above re-parks the lane. Superseded template versions and
rendered pages are never deleted (A10), so a park costs nothing already built.
