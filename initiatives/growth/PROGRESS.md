# PROGRESS — growth

<!-- machine header -->
status: LIVE
cycle: arc-growth (Cycle 14, opened 2026-08-12)
phase: 00
appetite: 10d
burn: 0d
blocked-on: owner — arc-site PR #1 merge (E2, publishing is the human's); Phase 01 gated on the domain + GSC property
depends-on: —

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + the road + steel thread | 2.0d | **IN PROGRESS** — contract done, site built; steel-thread emit waits on the human merge |
| 01 | Name and instrument the site | 1.0d (~2h lane work; rest is DNS + GSC lag) | NOT STARTED — entry gate: owner names the domain |
| 02 | Miner + cluster gate | 1.0d | NOT STARTED |
| 03 | Generator + lints | 1.5d | NOT STARTED |
| 04 | Publish path + A/B + GEO | 1.5d | NOT STARTED |
| 05 | The EVO-H0 feed | 1.5d | NOT STARTED |
| 06 | Real week | 1.25d | NOT STARTED (≥7 elapsed days) |

Phases sum to **9.75d** of a **10d** cap = **97.5% allocated**. **0.25d named reserve.** That is thin
and it is stated rather than dressed up: C4 was 100% allocated and closed at ~112%. Pre-planned cut
#1 (Phase 2 real mining run narrows to the fixture set, -0.5d) restores reserve to 0.75d and is
decided now, not on day 8.

## Appetite burn

**~0.9 of 10 days used (9%).** 50% tripwire = 5.0d: if no content PR has travelled end-to-end to a
merged `content.published` by then, the publish path is fighting the stack — bank the vocabulary
ADRs and the miner as documentation, stop, retro.

## Done log

| Date | What | Evidence |
|---|---|---|
| 2026-08-12 | Lane born. PLAN.md + 7 phase specs + ADRs 1000–1014 written; century 1000–1099 claimed after scanning all 14 worktrees + the main clone | `initiatives/growth/`, `docs/adr/10{00..14}-*.md` |
| 2026-08-12 | Pre-kickoff gate audited: rows 3, 4, 5, 6 FALSE; row 1 satisfied (`01KZTM348858PDH44K4HA64CVA`); row 2 misattributed to A9 | `PLAN.md` § Current state, ADR-1003 |
| 2026-08-12 | **REQ-05(a) spec-verify run at kickoff instead of Phase 5** — three deviations found between the live `metric.observed` validator and PLAN-evolve REQ-00's frozen spec | ADR-1009 |
| 2026-08-12 | Attack panel ×3 (edge-cases · scope · pre-mortem): **19 findings accepted, 1 rejected** | see § Kickoff verification |
| 2026-08-13 | Simulation gate: **9 blockers → 2**. The last two were pure lookups and were closed; the one-respawn cap was reached, so no third round ran | § Kickoff verification |
| 2026-08-13 | **POL-I misreading corrected** — the design source conflated an authorization *subject* (ADR-0504) with a spine event kind. Growth adds NO `hq.policy.yaml` row, matching ADR-0703 and ADR-0912 | ADR-1001 |
| 2026-08-13 | `kickoff.done` `01KZVM89535AM5SZDPWBV98M7C` and `approval.requested` `01KZVM8NN7XTEJ7P7Q1BMBS954` emitted from the MAIN clone, both verified present in `events/` and absent from quarantine | `.claude/state/hq/events/2026-08-13.jsonl` |

## Phase 00 — in progress

**Contract: done and pushed.** `content.published` is KINDS 44 → 45, `assertContent` lives in its
own module, the emitter branch exists, and a smoke emit landed in `events/` with a derived idem and
nothing in quarantine. Three suites written: `growth-vocabulary`, `growth-publish-thread`,
`growth-deploy`.

**The road: built.** `arc-site` exists (Astro + MDX, private), builds 2 pages with a sitemap, and
one real article renders at a real URL.

**Open, and honest about it:**

| # | Item | State |
|---|---|---|
| P0-a | The `content.published` steel-thread emit | **Waiting on a human merge.** arc-site PR #1 is open and the machine will not merge it — publishing is E2, Tier E, and ADR-1002 makes that merge the owner's. One click, then the receipt emits with the merged sha |
| P0-b | Vercel made a *preview* request into a **production** deploy | Caught and closed the same hour: every page now carries `noindex, nofollow` and robots.txt says `Disallow: /` until `ARC_SITE_ORIGIN` is set at the Phase 01 gate. The canonical had also been pointing at a placeholder host and now points at the host actually serving it |
| P0-c | The machine pushed arc-site's initial import straight to `main` | `gh repo create --push` did it during repo creation. Fixed forward: the next change went through PR #1 instead. **Branch protection is not available on a private repo without GitHub Pro**, so the enforcement that remains is REQ-03's module-graph guard in the command itself, which is where ADR-1002 always put it |
| P0-d | arc-site's GitHub repo is **not connected** to the Vercel project | Deploys currently go through the API, so *per-PR preview URLs do not exist yet*. Phase 04's review pack depends on them. Needs connecting before Phase 04, and it is an owner account action |
| P0-e | CI | Congested — five lanes are pushing. The kickoff commit's run came back **success**; later runs have been queued 50+ minutes |

## Kickoff verification

- **Gate rows verified twice** — this session plus an independent `codebase-surveyor` pass. Both
  found zero web infrastructure and no Search Console property.
- **Attack panel ×3.** 19 findings accepted and applied; 1 rejected (`unsupported`). The panel
  killed the first idem formula, cut REQ-06 and the IndexNow ping, raised Phase 1 and Phase 4,
  and caught a PT-vs-IST window boundary that would have misattributed clicks silently.
- **Simulation gate (tier M): 9 → 2.** Round 1 found 9 blockers, all closed. Round 2 found 2, both
  pure lookups (the C2 corpus limits; the `hq.policy.yaml` row schema) — and the second one exposed
  the POL-I misreading above, which is the most valuable thing this gate produced. Both closed. The
  process caps respawns at one, so **no third round was run**: that is the honest state, not a zero.
- **Counts that must be read from the spine at close, never inferred:** production
  `content.published` and `metric.observed` receipts, located in `events/` and confirmed absent from
  `events/_quarantine/`.

## Known limits, written down at birth

- **This cycle cannot earn an L2 promotion.** ADR-1007 sets the bar at 20 unedited approvals; ten
  articles yields at most 10.
- **The A/B slot cannot produce a verdict.** Evolve's per-arm floor is ~1,900 trials; five articles
  per arm is a collectable stream and nothing more.
- **Evolve's trigger fires after this cycle closes, not inside it.** Four complete consecutive weeks
  is ≥28 days against a 10-day cycle. The cycle's job is to *start* the clock, and the clock cannot
  start before the Search Console property exists — Search Console does not backfill.

## Now

**Current position:** approved by the owner (`01KZTM...` decision recorded 2026-08-13) and building.
Phase 00's contract half is written, pushed and smoke-verified; the road half exists as a real site
serving a real article. The cycle PR is **#177**, open and deliberately unmerged until every phase
closes.

**Next step:** Phase 02 (miner + cluster gate) and Phase 03 (generator + lints) — neither needs the
site, so both proceed while P0-a waits. Phase 00 closes the moment arc-site PR #1 is merged and the
`content.published` receipt emits with the merged sha.

**Blocked on:** exactly two things, both the owner's and both one click or one form:
1. **arc-site PR #1** — the human merge. E2 is Tier E and ADR-1002 puts this merge with the human;
   the machine will not take it, and Phase 00 cannot close without it.
2. **The domain + Search Console property** (Phase 01's entry gate). Every day it stays open is a day
   subtracted from evolve's four-week clock, one for one, and it is not recoverable later.

Nothing else waits on anyone.
