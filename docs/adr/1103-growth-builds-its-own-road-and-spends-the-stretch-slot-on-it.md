# ADR 1003 — Pre-kickoff gate rows 3–4 are false, so growth builds its own road and spends the stretch slot on it

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** at the 50% burn tripwire (5.0d) the site is still not serving one real
article end-to-end → the publish path is fighting the stack; the design source's own kill
criterion fires and the vocabulary ADRs plus the miner bank as documentation.

## Context

The design source's pre-kickoff gate says nothing builds until all six rows are true, and its
**cascade rule** says: "gate rows 3–4 not TRUE at kickoff → the schedule was misread — STOP at
kickoff-lint. Never build ahead of the site."

Verified twice today by independent passes — the main session and a fresh `codebase-surveyor`:

| Row | Claim | Reality, 2026-08-12 |
|---|---|---|
| 1 | Build-out Mandate receipt cited | **TRUE.** `decision.recorded` `01KZTM348858PDH44K4HA64CVA`, deciding `01KZTM2DYQXXYHVBJZC462D982`, on the canonical spine |
| 2 | Live slot free (A9) | Misattributed — A9 is *Appetite over estimate*; no live-slot article exists. The real rule is ADR-0052's WIP line, which is **informational** and prints `3 counted · guideline 2 · kickoff proceeds` |
| 3 | Domain live + **GSC property verified** | **FALSE.** No GSC property anywhere. No arc public domain live |
| 4 | Site skeleton with a `/blog` route rendering a test page | **FALSE.** Zero web infrastructure: no `app/`, `pages/`, `next.config`, `vercel.json`, `.mdx`, sitemap, robots, `llms.txt`, `public/brand/`. The nearest site-shaped thing is `arc-docs/` — three static files, not a git repo, no blog, no deploy |
| 5 | Exemplar articles picked | **FALSE** — the lane did not exist until today |
| 6 | Keyword sources named | **FALSE** — no source list on the tree |

Three responses were live: stop and hand rows 3–4 back; split into two cycles; or absorb the road.
The house precedent was set **this morning**: `bench` hit the same shape — five falsified
premises, including a runner with no `arc` binary to run it — and under the owner's build-out
ruling (ADR-0900) it raised appetite and built the road as well as the runner. And `leads` set
the complementary precedent: `_dmarc.automemory.ai`, a record only the owner could create, was
made a **phase entry gate** rather than a kickoff blocker, so the machine kept building while the
owner's minutes happened in parallel.

## Options considered

1. **Absorb the road; fund it by spending the stretch slot.** The design source already
   designates that slot (Phase 5, 1.5d) as **cut #3**, so the money is already on the table.
2. **Raise the cap 10d → 12d** and keep the stretch slot. Con: 12 days for a cycle whose stated
   output is ten articles; and A9 prefers a cut to an extension.
3. **Split into two cycles.** Con: publishes nothing, so no `content.published` exists, so the
   slug↔URL join has no left side, so no metric window can ever be COMPLETE — evolve stays asleep,
   which is the point of the cycle.
4. **Stop at kickoff-lint, literal cascade rule.** Con: hands the owner the task and burns the
   session; contradicts the standing build-out direction that arc's own build-out does not wait.

## Decision

**Option 1**, ratified by the owner at kickoff. The **10-day hard cap does not move.**

- Phase 0 grows to include the site skeleton and lands the walking skeleton on a **preview URL**,
  which needs **zero owner keystrokes** — a preview deploy needs no custom domain.
- The domain + GSC property become **Phase 1's entry gate** (the leads precedent), not a kickoff
  blocker.
- **REQ-07 (video) and REQ-08 (lifecycle) are CUT AT KICKOFF, not deferred** — the slot that
  would have funded either is spent here. This also settles GRO-K: the stretch-slot pick is not a
  decision left for P4 close, because the slot no longer exists.
- Gate rows 5 and 6 become Phase-2 entry work (ADR-1114 sources the exemplars without handing the
  owner a writing task).

The cut order the design source recorded — lifecycle #1, video #2, the slot itself #3 — is
**fully spent at kickoff**. That is stated here rather than discovered on day 8, and it means
this cycle has no pre-planned cuts left in that direction; ADR-1103's remaining cut list lives in
`PLAN.md` § Appetite.

**Evidence:** spine scan 2026-08-12 (mandate receipt present; 1,024 events) · `CONSTITUTION.md:65`
(A9 is appetite, not slots) · `wip-line.sh` output 2026-08-12 · filesystem scan for web
infrastructure across the repo and `E:/Work_Hub/01_Automemory/` · `PORTFOLIO.md:19` (bench, ADR-0900,
2026-08-12) · `PORTFOLIO.md:23` (leads' DNS-record-as-entry-gate) · design source § Appetite (cut
order), § Cascade rule.
**Confidence:** high on the falsified rows (two independent verifications); medium on the 1.5d
being enough for the skeleton — that is Assumption A-02 in `PLAN.md`, with the 50% tripwire as its
trigger.
**Rejected because:** option 2 extends where the constitution prefers a cut; option 3 removes the
cycle's point; option 4 waits for a trigger the owner has already ruled arc does not wait for.

## Consequences

Easier: the cycle can start today and the metric clock starts as early as physically possible.
Harder: two REQs are dead at birth and the cycle has spent its slack before day 1, so the next
overrun has nothing designated to cut — it goes to the owner as a cut-or-kill call, which is what
A9 asks for anyway.
