# PROGRESS — growth

<!-- machine header -->
status: LIVE
cycle: arc-growth (Cycle 14, opened 2026-08-12)
phase: 06
appetite: 10d
burn: 7.5d
blocked-on: owner — ALL remaining work. arc-site PR #1 merge; Vercel-Git connect (no preview URLs without it); GSC Domain property (Phases 01+06); 2 approvals in the inbox
depends-on: —

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + the road + steel thread | 2.0d | **IN PROGRESS** — contract done, site built; steel-thread emit waits on the human merge |
| 01 | Name and instrument the site | 1.0d (~2h lane work; rest is DNS + GSC lag) | **PARKED** (ADR-1115) — the domain now exists; the **Search Console property** does not, and that is the half that starts the clock |
| 02 | Miner + cluster gate | 1.0d | ✅ **DONE 2026-08-14** — 6 criteria met, criterion 3 narrowed and its gap recorded; A-05 fired and fixed (ADR-1116) |
| 03 | Generator + lints | 1.5d | ✅ **DONE 2026-08-14** — 7 of 8 criteria met; the exemplar APPROVAL is outstanding (owner). 35 adversarial holes found and fixed |
| 04 | Publish path + A/B + GEO | 1.5d | ✅ **DONE 2026-08-14** — guard is a parse, 3-escape mutant refused by name; criterion 5 live half + llms.txt deploy outstanding (owner) |
| 05 | The EVO-H0 feed | 1.5d | ✅ **DONE 2026-08-14** — FIXTURE-PROVEN, not live-validated: no GSC property, so no real CSV and no real receipt. ADR-1117 fixed a silently-dropped correction path |
| 06 | Real week | 1.25d | **PARKED** (ADR-1115) — needs 7 elapsed days of a live, indexable site; both halves absent |

Phases sum to **9.75d** of a **10d** cap = **97.5% allocated**. **0.25d named reserve.** That is thin
and it is stated rather than dressed up: C4 was 100% allocated and closed at ~112%. Pre-planned cut
#1 (Phase 2 real mining run narrows to the fixture set, -0.5d) restores reserve to 0.75d and is
decided now, not on day 8.

## Appetite burn

**~7.5 of 10 days used (75%).** 50% tripwire = 5.0d: if no content PR has travelled end-to-end to a
merged `content.published` by then, the publish path is fighting the stack — bank the vocabulary
ADRs and the miner as documentation, stop, retro.

**THE TRIPWIRE IS PAST, AND IT IS PAST FOR THE REASON IT NAMES.** No content PR has travelled to a
merged `content.published`, because arc-site PR #1 is unmerged and per-PR preview URLs do not exist
until the site repo is connected to the deploy provider. Both are owner actions.

But the tripwire's *remedy* — bank the work as documentation and stop — is the wrong call here, and
saying why is the point of writing this down rather than quietly continuing. The tripwire was
written against **the publish path fighting the stack**: code that will not work. That is not what
happened. Phases 02–05 are built, adversarially attacked and green on CI across three OS legs; what
is missing is four owner keystrokes and a Search Console property that backfills nothing. Stopping
now would bank a working machine as documentation while the only thing blocking it is a click.

**The honest position: the build is done and the cycle is blocked, not overrunning.** Phases 00, 01
and 06 cannot close without the owner, and no further machine work will change that. This is the
scope-cut conversation the tripwire demands, held here, in writing, with the numbers.

The machine header's `burn:` field carried `0d` through two closed phases while this line said 2.2d.
Same file, two numbers, and the header is the one a script would read. Corrected at the Phase-02
close, and it is worth noticing that a tracker can disagree with itself in the one place that is
supposed to be the single source of truth.

## Done log

| Date | What | Evidence |
|---|---|---|
| 2026-08-12 | Lane born. PLAN.md + 7 phase specs + ADRs 1100-1114 written; century 1100–1199 claimed after scanning all 14 worktrees + the main clone | `initiatives/growth/`, `docs/adr/11{00..14}-*.md` |
| 2026-08-12 | Pre-kickoff gate audited: rows 3, 4, 5, 6 FALSE; row 1 satisfied (`01KZTM348858PDH44K4HA64CVA`); row 2 misattributed to A9 | `PLAN.md` § Current state, ADR-1103 |
| 2026-08-12 | **REQ-05(a) spec-verify run at kickoff instead of Phase 5** — three deviations found between the live `metric.observed` validator and PLAN-evolve REQ-00's frozen spec | ADR-1109 |
| 2026-08-12 | Attack panel ×3 (edge-cases · scope · pre-mortem): **19 findings accepted, 1 rejected** | see § Kickoff verification |
| 2026-08-13 | Simulation gate: **9 blockers → 2**. The last two were pure lookups and were closed; the one-respawn cap was reached, so no third round ran | § Kickoff verification |
| 2026-08-13 | **POL-I misreading corrected** — the design source conflated an authorization *subject* (ADR-0504) with a spine event kind. Growth adds NO `hq.policy.yaml` row, matching ADR-0703 and ADR-0912 | ADR-1101 |
| 2026-08-13 | `kickoff.done` `01KZVM89535AM5SZDPWBV98M7C` and `approval.requested` `01KZVM8NN7XTEJ7P7Q1BMBS954` emitted from the MAIN clone, both verified present in `events/` and absent from quarantine | `.claude/state/hq/events/2026-08-13.jsonl` |
| 2026-08-13 | **CI was red on 5 consecutive commits, all three OS legs.** 4 distinct failures, every one caused by `KINDS` 44 → 45; 3 of them in other lanes' files. Fixed in one commit | `f2d1f4f` |
| 2026-08-13 | **Phase 02 built**: miner, cluster proposal, gate 1. Real mining run against HN's public API produced 14 attested keywords and cluster `c-001` (pillar "ai agents", 8 spokes, 2 BOFU), every row evidence-linked and verified | `882cb13`, `initiatives/growth/clusters/` |
| 2026-08-13 | Mutant pass on the gate: 2 of 3 mutations went red correctly; the 3rd proved the spoke-floor guard **unreachable and untestable**, now labelled rather than left looking covered | `.claude/scripts/growth/lib/cluster.mjs` |
| 2026-08-14 | **Phase 02 CLOSED.** 6 of 7 criteria met; criterion 3 narrowed via `/arc-change` and its gap recorded rather than ticked. CI `31778577391` @ `d4500cc` **19/19 jobs green, three OS legs, read per-JOB**. Bundle verified, 5 artifacts. `amendments: 1` · `reopened: n` | `initiatives/growth/evidence/phase-02/` |
| 2026-08-14 | **A-05 FIRED and the diagnosis acquitted the assumption.** `c-001`'s spokes restated the pillar because selection sorted by *descending overlap with the pillar*, and the tokeniser's ≤2-char filter had deleted `ai`. ADR-1116's residue rule replaced it; the rebuilt cluster is 1 pillar + **7 distinct** spokes + 2 BOFU from the same pool, so the SHAPE held on its first honest test | ADR-1116, `cluster-c-001.json` |
| 2026-08-14 | **The 2026-08-13 ADR renumber was half applied.** Filenames had moved to 1100–1115; the PLAN index and all 16 H1 titles still read 1000–1015, numbers `ledger` owns on disk — so kickoff-lint was validating *ledger's* decisions as growth's and growth's own ADRs were checked by nothing. 1115 was absent from the index. `adr-wired` warnings 15 → 2, and both survivors were real gaps | `PLAN.md` § Key decisions |
| 2026-08-14 | **A reported number was not the measured number.** `mine` printed `own-page exclusions ${ownTargets.size}` — pages read from the sitemap, labelled as candidates removed. Two live runs excluded nothing and both said "1" | `arc-growth.mjs`, `mine.mjs` |
| 2026-08-14 | **ADR-1115's revisit trigger was reading TRUE while every reason for the park still stood.** "A domain and a live site exist" came true on 2026-08-13; the park is really on the Search Console clock. Trigger re-worded to name the condition that actually un-parks | ADR-1115 |
| 2026-08-14 | **Phase 03 CLOSED.** Generator, slop-lint, citation-lint, the gutted `seo-article-writer`, 3 exemplars. 7 of 8 criteria; the exemplar approval is the owner's and is NOT ticked. `amendments: 1` (uncited-claim FAIL vs WARN) · `reopened: n` | `evidence/phase-03/` |
| 2026-08-14 | **The adversarial pass returned 35 EXECUTED holes**, two CRITICAL and both the same defect twice: citation-lint did no Unicode folding while slop-lint did, and slop-lint matched per PHYSICAL LINE so a phrase crossing a soft wrap was missed. Together they shipped an article with **21 markers and 5 fabricated figures at exit 0**. Fixed by ONE shared text layer rather than twenty patches — a shared list of rules had already failed to stop this three times in two days | `lib/text.mjs`, `evidence/phase-03/` |
| 2026-08-14 | **Phase 04 CLOSED.** Publish path, module-graph guard, 3-escape running mutant, A/B slot, GEO. Criterion 5's live half and the `llms.txt` deploy are outstanding (owner). `amendments: 1` (the E2 verb ban) · `reopened: n` | `evidence/phase-04/` |
| 2026-08-14 | **The E2 verb ban contradicted its own ADR.** Phase 02 banned a `publish` verb; ADR-1102 names `arc growth publish <slug>` verbatim. The banned thing is the CAPABILITY, and it is now proven absent by a module-graph PARSE plus a mutant whose third escape — a deploy hook needing **no import at all** — broke the guard's first version | phase-04 spec § Amendment |
| 2026-08-14 | **Phase 05 CLOSED, fixture-proven and not live-validated.** Spec-verify is a gate returning exactly ADR-1109's four findings against the LIVE validator; the ingest refuses on range mismatch, lag, unknown headers; windows are the verified PT days converted to IST (the DST week spans **169h**). `amendments: 1` (ADR-1117) · `reopened: n` | `evidence/phase-05/` |
| 2026-08-14 | **A fifth deviation, in a surface ADR-1109 never examined.** `metric.observed` corrections were silently dropped: the emitter passes `supersedes` into the *experiment* idem and not the *leads* one, so a re-read with different numbers hashed identically and died as `DUP_IDEM`. Worked around by a revisioned `source_id`; flagged back rather than absorbed, and pinned as a negative control | ADR-1117 |
| 2026-08-14 | **A growth line was rendering in every other lane's daily brief.** The feed's empty state printed unconditionally inside a renderer with a 40-line one-screen budget; `spine-brief.bats` broke over it and was right to. Empty state is now opt-in and the company brief is byte-identical | `arc-brief.mjs`, `lib/feed.mjs` |

## Phase 02 — built, not yet closed

`arc-growth mine | cluster | generate`. Gate 1 (ADR-1112) is in code: `assertClusterApproved`
refuses generation unless a human approved **that exact plan**, bound by `plan_sha` and not merely
by cluster id. It rides on `approval.requested` + `decision.recorded` through `arc-inbox` — growth
adds no approval receipt of its own, because a second source of truth for "did a human say yes" is
what A5 forbids.

**The real run is what paid for this phase.** Criterion 7 asks for one REAL mining run rather than
a fixture run, and it found four defects a fixture run could not have:

| # | What the real run exposed | Now |
|---|---|---|
| 1 | 41 live HN links reported as "did not resolve" — HN answered **429**. The resolver had two states where three were needed | Three states; a rate limit is UNKNOWN. The run **stops** rather than proceeding with a pool that lost 80% of its rows |
| 2 | The 429s were self-inflicted: one HEAD per candidate against the human-facing item page | Verification is the source's job — one batched API query, 51 checks in one request |
| 3 | Whole HN titles used as keywords, so the pillar came out as **"dspack studio"** — a product name nobody searches, with spokes sharing not one token with it | A keyword is an n-gram **attested by ≥2 independent stories** |
| 4 | A story reposted 3× corroborated itself 3×, manufacturing "operating system for 916" (from a $916 price) as a 3-story topic | Attestation counts distinct headlines; bare numbers are not keywords |

All four are pinned as fixtures in `tests/growth-mine.bats`.

**Honest gaps, stated rather than smoothed:**

- **Red-first was NOT done as the spec words it.** The spec wants each refusal observed RED before
  the refusal exists; CI is the only place tests run here, and the queue is hours deep. What ran
  instead was a **mutant pass**: the gate was deleted three ways and the suite re-checked. Two
  mutations went red correctly. The third — deleting the spoke-floor — turned **nothing** red,
  because the earlier pool check already covers every input that reaches it. That guard is
  unreachable and is now labelled an invariant backstop instead of being left to look tested.
  This is weaker than red-first and is recorded as such.
- **Only one source is enabled** (HN via Algolia's public API). Reddit, search-suggest and
  competitor pages sit disabled with the reason written into `sources.json`, awaiting the owner's
  call on which are fair game. The cluster's BOFU rows therefore come from HN comparison language,
  not from competitor gap analysis.
- `c-001` is proposed, **not approved**. Sending it and approving it is gate 1, and it is the
  owner's.

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
| P0-a | The `content.published` steel-thread emit | **Waiting on a human merge.** arc-site PR #1 is open and the machine will not merge it — publishing is E2, Tier E, and ADR-1102 makes that merge the owner's. One click, then the receipt emits with the merged sha |
| P0-b | Vercel made a *preview* request into a **production** deploy | Caught and closed the same hour: every page now carries `noindex, nofollow` and robots.txt says `Disallow: /` until `ARC_SITE_ORIGIN` is set at the Phase 01 gate. The canonical had also been pointing at a placeholder host and now points at the host actually serving it |
| P0-c | The machine pushed arc-site's initial import straight to `main` | `gh repo create --push` did it during repo creation. Fixed forward: the next change went through PR #1 instead. **Branch protection is not available on a private repo without GitHub Pro**, so the enforcement that remains is REQ-03's module-graph guard in the command itself, which is where ADR-1102 always put it |
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

- **This cycle cannot earn an L2 promotion.** ADR-1107 sets the bar at 20 unedited approvals; ten
  articles yields at most 10.
- **The A/B slot cannot produce a verdict.** Evolve's per-arm floor is ~1,900 trials; five articles
  per arm is a collectable stream and nothing more.
- **Evolve's trigger fires after this cycle closes, not inside it.** Four complete consecutive weeks
  is ≥28 days against a 10-day cycle. The cycle's job is to *start* the clock, and the clock cannot
  start before the Search Console property exists — Search Console does not backfill.

## Now

**Session handed off 2026-08-14.** Read this section and the Owner queue below; nothing else needs
re-deriving.

**Current position — THE BUILD IS DONE.** Phases **02, 03, 04 and 05 are CLOSED**, each with a
verified evidence bundle, all green on CI `31787158440` @ `e0c3c32`: **19/19 jobs, three OS legs,
read per-JOB**. Phase 00 is open on the owner's arc-site merge; 01 and 06 are PARKED on the Search
Console property (ADR-1115).

**Nothing further is buildable.** Every remaining item is an owner action, and no amount of machine
work moves any of them. See the Owner queue below.

**The domain now exists.** `arc.automemory.ai` resolves, serves the site, and is deliberately
`noindex` + `Disallow: /`. The owner chose the subdomain over the root on 2026-08-13 because
`automemory.ai` is the company and arc is one part of it, so the root and `blog.` stay free.
**This does NOT un-park Phase 01 by itself** — the entry gate also wants a verified Search Console
property, which is item 4 in the owner queue.

**State of the two PRs.**

| PR | Where | State |
|---|---|---|
| arc **#177** | this repo, `feat/arc-growth-cycle-14` | MERGEABLE and CLEAN after the main merge. Deliberately unmerged until every phase closes |
| arc-site **#1** | `technology-ashiq/arc-site`, `feat/noindex-until-domain` | MERGEABLE and CLEAN. Carries the noindex work AND the canonical fix. **Waiting on the owner's click** — the machine does not merge a publish (E2, ADR-1102) |

**CI.** Run for `a56be3d` came back GREEN on all jobs, all three OS legs, verified per-JOB rather
than by the run's exit code. A run for the merge commit `8ac10fa` was queued at handoff and has
NOT been read yet — read it per-JOB before trusting the merge.

**The three-lane ADR collision, resolved here and still open elsewhere.** `ledger`, `legal` and
`growth` all claimed century 1000–1099 in the same week. Ledger merged first and keeps it; growth
renumbered to **1100–1199** (ADRs 1100–1115). `legal` still holds 1000–1013 colliding with
ledger's on an unmerged branch, and **1200–1299 is reserved for it** in `PORTFOLIO.md`. That
renumber belongs to legal's own session — see the Owner queue.

The mechanism failed, not the lanes: all three ran the "scan every sibling worktree" check the band
table says prevents this, and the check cannot see what three other sessions are about to write.
Worth a company-level fix in a retro rather than a fourth lane paying for it.

**Next step: THE OWNER'S, not the machine's.** Work the Owner queue below. The two approvals are
live inbox items and take one command each:

```bash
cd E:/Work_Hub/01_Automemory/arc
node .claude/scripts/hq/arc-inbox.mjs inbox
node .claude/scripts/hq/arc-inbox.mjs approve 01KZZRVSQJEAVD4YCZ8FDXR0DT --reason "..."   # 3 voice exemplars (ADR-1114)
node .claude/scripts/hq/arc-inbox.mjs approve 01KZZRW51QHTA9CFEX5JRRGY7C --reason "..."   # cluster c-001, gate 1
```

Read the artifacts before approving. `c-001` still carries **`yc s23`**, a headline fragment no
selection rule can kill without a blocklist — gate 1 is exactly where a human strikes it (ADR-1116).

Once the site repo is connected to the deploy provider and PR #1 is merged, Phase 00's steel thread
closes and the publish loop in `RUNBOOK.md` runs for real. Once the Search Console property exists,
Phases 01 and 06 un-park unchanged.

## Owner queue — 4 items, deferred to a later session on 2026-08-14

Ordered by how much each unblocks. None of them blocks Phase 03.

1. **Vercel → arc-site → Settings → Git → connect `technology-ashiq/arc-site`.** Confirmed NOT
   connected: only two API-created deployments exist and a push produced none. Until this is done,
   merging deploys nothing and there are no per-PR preview URLs — which **Phase 04's review pack is
   specified as invalid without**.
2. **Merge arc-site PR #1.** One click. Phase 00 cannot close without it, and it also ships the
   canonical fix.
3. **Cloudflare → the `arc` record → grey cloud (DNS only).** It is currently proxied, and
   Cloudflare is injecting its own managed `robots.txt` block containing `Allow: /` directly
   above our `Disallow: /`. Two conflicting groups for the same user-agent. We are still safe
   because the `noindex` meta tag does the real work — safe by accident, not by design.
4. **Search Console → Domain property for `automemory.ai`** (not URL-prefix). One TXT record in
   Cloudflare. Domain form covers the root and every subdomain, so it is done once.

Plus one paste job, not an arc task: **legal's session must renumber its ADRs 1000–1013 to
1200–1213**, scoping the rewrite by file ownership rather than by pattern, because `validate.mjs`,
`arc-brief.mjs` and `arc-pnl.mjs` cite ledger's ADRs at the same numbers.

**Not yet, and not to be done on anyone's initiative:**

- **Approving cluster `c-001`** — gate 1. Only needed when Phase 03's generator is ready to run.
- **Making the site indexable** — a separate one-line PR flipping `INDEXABLE` in
  `src/lib/site.mjs`. It is a committed constant rather than an env var precisely so this is a
  reviewed diff a human merges. It needs the owner to look at the live site and say go.
