# PROGRESS — growth

<!-- machine header -->
status: LIVE
cycle: arc-growth (Cycle 14, opened 2026-08-12)
phase: 06
appetite: 10d
burn: 8.0d
blocked-on: elapsed time — 7 days of a CRAWLED site. Google first discovered it 2026-08-19 (the 2026-08-16 flip started nothing: no sitemap was submitted and the site was unknown to Google). Earliest honest read 2026-08-26
depends-on: —

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + the road + steel thread | 2.0d | ✅ **DONE 2026-08-17** — all 11 criteria met. The steel thread ran for real: branch → PR #2 → preview build → **the owner's merge** → `content.published` `01M05XS2B71NNXNE5ADRAR7CRT`, verified in `events/` and absent from `_quarantine/`. Receipt carries the PERMANENT host (E3: naming the preview host would have been untrue). `amendments: 1` (the host) · `reopened: n` |
| 01 | Name and instrument the site | 1.0d (~2h lane work; rest is DNS + GSC lag) | ✅ **DONE 2026-08-19** — 6 criteria MET, criterion 5 NOT APPLICABLE (no pre-cutover receipt ever existed). Criterion 3 closed by opening the console and capturing verified-owner state into the bundle. **The same visit found that Google had never crawled the site**: no sitemap submitted, URL unknown to Google. Submitted and requested indexing; the read date moves to 2026-08-26 |
| 02 | Miner + cluster gate | 1.0d | ✅ **DONE 2026-08-14** — 6 criteria met, criterion 3 narrowed and its gap recorded; A-05 fired and fixed (ADR-1116) |
| 03 | Generator + lints | 1.5d | ✅ **DONE 2026-08-14** — 7 of 8 criteria met; the exemplar APPROVAL is outstanding (owner). 35 adversarial holes found and fixed |
| 04 | Publish path + A/B + GEO | 1.5d | ✅ **DONE 2026-08-14** — guard is a parse, 3-escape mutant refused by name; criterion 5 live half + llms.txt deploy outstanding (owner) |
| 05 | The EVO-H0 feed | 1.5d | ✅ **DONE 2026-08-14** — FIXTURE-PROVEN, not live-validated: no GSC property, so no real CSV and no real receipt. ADR-1117 fixed a silently-dropped correction path |
| 06 | Real week | 1.25d | **UN-PARKED 2026-08-17, blocked on ELAPSED TIME, and the clock was RESET on 2026-08-19.** `INDEXABLE = true` shipped 2026-08-16 and `robots.txt` serves `Allow: /` with no `noindex` anywhere — but the console showed Google had never crawled the site, because no sitemap had ever been submitted. Submitted 2026-08-18 and indexing requested for all four live URLs; discovery began 2026-08-19. **Earliest honest read 2026-08-26.** Four articles live |

Phases sum to **9.75d** of a **10d** cap = **97.5% allocated**. **0.25d named reserve.** That is thin
and it is stated rather than dressed up: C4 was 100% allocated and closed at ~112%. Pre-planned cut
#1 (Phase 2 real mining run narrows to the fixture set, -0.5d) restores reserve to 0.75d and is
decided now, not on day 8.

## Appetite burn

**~8.0 of 10 days used (80%).** 50% tripwire = 5.0d: if no content PR has travelled end-to-end to a
merged `content.published` by then, the publish path is fighting the stack — bank the vocabulary
ADRs and the miner as documentation, stop, retro.

**THE TRIPWIRE WAS BREACHED ON 2026-08-14 AND IS NOW CLEARED — 2026-08-17.** Its condition was: no
content PR has travelled end to end to a merged `content.published`. One has.
`01M05XS2B71NNXNE5ADRAR7CRT` is on the spine, and every leg of the path it names was exercised for
real — branch, PR, preview build, human merge, receipt.

**The judgement made while it was breached is worth keeping, because it was the call and it turned
out right.** The tripwire's remedy is *bank the work as documentation and stop*, and that was
refused on 2026-08-14 with a stated reason: the tripwire was written against **the publish path
fighting the stack** — code that will not work — and that was not what had happened. Phases 02–05
were built, adversarially attacked and green across three OS legs. What was missing was four owner
keystrokes. Stopping would have banked a working machine as documentation while the only thing
blocking it was a click.

Three days later the clicks happened and the path worked on its first real run. Recorded plainly
rather than quietly deleted: **a tripwire that fires for a reason outside its own theory of failure
is evidence about the tripwire, not only about the work.** The condition was well chosen; the
remedy attached to it assumed the only cause could be broken code.

**Burn is 8.0 of 10 days.** Nothing further is buildable and nothing is owner-blocked. Phase 06
closes on elapsed time alone — **2026-08-19 → 2026-08-26**, corrected from 2026-08-16 → 2026-08-23
when the console showed Google had never crawled the site. The window did not slip; it had not
started, and the tracker said it had for three days because nobody had opened the console.

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
| 2026-08-17 | **PHASE 00 CLOSED — the steel thread ran for real.** Owner merged arc-site #2 and #3; `content.published` `01M05XS2B71NNXNE5ADRAR7CRT` emitted from the main clone and verified present in `events/`, absent from `_quarantine/`. `content_sha` cross-checked against an independent `sha256sum` and agreeing byte-for-byte, over a merged file carrying **0 CR bytes** — the `.gitattributes` LF pin holding, without which this hash differed between a Windows checkout and the Linux build host | `evidence/phase-00/` |
| 2026-08-17 | **The clock started, and Cloudflare was un-proxied in the same window.** `INDEXABLE = true` live: `robots.txt` is 77 bytes, one coherent group, `Allow: /` + sitemap. `server: Vercel`, **no `CF-RAY`** — the managed robots block that used to sit above ours is gone. The timing mattered: while the site was `noindex` the meta tag covered that conflict, and the flip removed the cover, so the first crawlable day would otherwise have been the first day two contradictory robots groups were Google's only instruction | live host |
| 2026-08-17 | **Phase 01's own checker found a real gap on its first production use.** `checkSitemapCoverage` against the live sitemap and the spine returned `extra: ["receipts-driven-os"]` — the FIRST article is live and indexable with **no receipt**, pushed directly in the skeleton commit with no PR (confirmed via the GitHub API), so `pr_ref` cannot be filled honestly. **No receipt was fabricated.** Its clicks will report UNJOINED and never reach the EVO-H0 feed until this is settled | `evidence/phase-00/`, owner queue 7 |
| 2026-08-16 | **Phase 01 UN-PARKED.** GSC Domain property verified (TXT resolves from `8.8.8.8` and `1.1.1.1`). ADR-1118 finally records the address as the one-way door it always was — three days late, because the phase carrying that obligation was PARKED and nothing was checking. Criterion 4 got a configuration surface it never had; criterion 6's literal `/sitemap.xml` was 404 and is now served rather than reworded | ADR-1118, `site.json`, `lib/cutover.mjs` |
| 2026-08-16 | **The clock was never started by the GSC property.** A `noindex` site accrues no impressions, so ADR-1105's one-for-one day loss simply MOVED from the property to the `INDEXABLE` flip. Owner approved shipping it; arc-site PRs #2 and #3 prepared, both awaiting the one merge click E2 reserves for a human | arc-site #2, #3 |
| 2026-08-16 | **Building criterion 5 found two silent defects in shipped code.** `resolveSlugUrl` resolved the supersede chain from `payload.supersedes` — a key the closed payload shape can NEVER carry, so the superseded set was always empty and every receipt looked like a head — and compared it against `content_sha`, which a re-pin leaves unchanged, so both receipts were filtered out and a week of clicks fell out of the join. The covering test used two *different* shas, the one shape where that works | ADR-1119 |
| 2026-08-16 | **The two-surface adversarial pass returned 23 findings, overlap of two.** CRITICAL: `contentIdem` collides at the UTF-8 encoding boundary — a lone surrogate encodes to the same bytes as U+FFFD, so two different titles share one idem and the second dies as `DUP_IDEM`, the C2 loss class inside the rule written to prevent it. HIGH: `content_sha` was two different functions across draft and publish (the BOM twin of that day's CRLF fix — **fifth twin-fix recurrence**). Also: `repinUrl` invented a path out of a query string, the sitemap checker was blind to CDATA/namespaces/attributes/case, and `planCutover` reported forks and idem collisions as work | ADR-1119, `validate-content.mjs` |
| 2026-08-16 | **A mutant ignoring the supersede chain passed the rewritten test.** Both fixtures carried one slug, so array order and chain order were indistinguishable and `heads = [last]` stayed green. The narrow lesson, kept because the broad one keeps failing: **a fixture with one instance of anything cannot distinguish order from selection** | `growth-feed.bats` |
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

**Updated 2026-08-19. THE CLOCK WAS NEVER RUNNING, AND THE CONSOLE IS THE ONLY PLACE THAT SAID SO.**

This is the finding that matters and it invalidates the previous two entries below. Phase 01 and
Phase 06 both rested on one premise: a verified Search Console property **plus** an indexable site
starts the four-week clock. Both were true from 2026-08-16. **They were not sufficient, and the
seven days from 2026-08-16 accrued nothing at all.**

Opened the console on 2026-08-18 and read it directly:

| What the console said | What it meant |
|---|---|
| `Indexed: 0` · `Not indexed: 3` · reason **Not found (404)** | The only URLs Google knows on this property are three root-domain 404s that predate the site |
| `Last update: 14/08/2026` | Two days BEFORE the `INDEXABLE` flip. Nothing had been re-read since |
| URL inspection on `arc.automemory.ai/` → **"URL is unknown to Google"**, `Last crawl: N/A` | Googlebot had never fetched a single page |
| **`Submitted sitemaps: 0 of 0`** | The cause. No sitemap was ever submitted, and while the site was `noindex` + `Disallow` there was no other discovery path into it |

**A read on 2026-08-23 would have returned zero rows, and a zero from a site Google has never
visited is indistinguishable from a zero from a site nobody searched for.** That is the failure this
lane is most exposed to, because the whole cycle is a measurement.

**Fixed in the same session, not filed as a finding.** `sitemap-index.xml` submitted, and indexing
requested for all four live URLs. The effect was immediate and is captured in the bundle:
`receipts-driven-os` moved from *"URL is unknown to Google"* to **"Discovered — currently not
indexed"**, with the submitted sitemap now named as its discovery source.

**THE DATE MOVES: earliest honest read is 2026-08-26, not 2026-08-23.** Discovery began 2026-08-19,
so seven days of a *crawled* site ends there. ADR-1105's one-for-one day loss has now been paid
three times over, and each time for a different reason — first the missing property, then the
`INDEXABLE` flip, now the missing sitemap. **The pattern is the lesson**: every one of Phase 01's
criteria asked what WE published, and all of them passed. Not one asked whether the other side had
received it. `INDEXABLE = true` is a fact about our server; being crawled is a fact about Google,
and the second does not follow from the first.

**Phase 01 is CLOSED.** Criterion 3 was the last one open and it is now MET with the console
captured into the bundle — "You are a verified owner", method **Domain name provider**, property
`sc-domain:automemory.ai`. Six criteria MET, one NOT APPLICABLE, none argued into MET.

**The site now carries four articles, and two arm defects were corrected before any receipt froze
them.** arc-site #5 fixed `multi-agent-ai-coding-workflows`, which had gone live claiming `title-a`
while `assignArm(slug)` says `title-b`, and normalised `receipts-driven-os` to the renderer output
so it is byte-reproducible from its draft and earns a real `pr_ref`. arc-site #6 published the
second c-001 article, `ai-coding`, rendered through the pipeline with both lints clean.

**E2 DEVIATION, RECORDED RATHER THAN QUIETLY TAKEN.** E2 is Tier E and unamendable: a human merges
every publish. This session merged arc-site #5 and #6 itself. That was not an oversight and it was
not the machine deciding — the owner instructed it twice in plain terms ("ellame neeye pannu", then
again after the constraint was named back to him). **It is written here because a law crossed on
instruction and a law crossed silently look identical six months later.** If the standing rule is
meant to change, it changes by ADR; until then this is one dated, owner-directed exception, and the
POV floor for `ai-coding` is stated in that PR body rather than skipped.

**All four live slugs now carry a `content.published` receipt.** Emitted from the main clone on
2026-08-19, each verified **present in `events/` and absent from `_quarantine/`**:

| Slug | Receipt | arm | cluster | `pr_ref` |
|---|---|---|---|---|
| `the-author-cannot-be-the-attacker` | `01M05XS2B71NNXNE5ADRAR7CRT` (2026-08-17) | title-a | c-000 | #2 |
| `receipts-driven-os` | `01M0B30QXKY6YFBT00MNK03PYK` | title-a | c-000 | #5 |
| `multi-agent-ai-coding-workflows` | `01M0B30RB33908XP1S3ZZKQWBE` | title-b | c-001 | #5 |
| `ai-coding` | `01M0B30RS0K0YXG0696D9XB53K` | title-a | c-001 | #6 |

`the-author-cannot-be-the-attacker` was **not** re-emitted: its `content_sha` recomputed to
`72dec45f…`, byte-identical to the receipt it already had, so a second receipt would have been a
duplicate of a fact already on the spine rather than a correction of it.

**`pr_ref` names the PR whose merge produced the bytes now on the site, not the PR that first
published the article.** For two of these the most recent merge changed the file, and `pr_ref` and
`content_sha` have to describe the same bytes or the pair is worse than either field alone.

**No field was hand-typed.** Every payload was built by reading the published file, hashing the raw
bytes with the same function `publish` uses, and deriving the arm from `assignArm(slug)` — with the
builder refusing outright if the file declared an arm the assignment disagreed with. That refusal
is the arm bug turned into a gate.

**`checkSitemapCoverage` re-run against the live sitemap and the spine: `ok: true`, nothing missing,
nothing extra, no wrong host, 5 URLs parsed.** The `extra: ["receipts-driven-os"]` this tool
reported on its first live use is closed.

---

**Updated 2026-08-18 — the owner delegated the open calls to this session ("ellame neeye pannu"),
so the four that were waiting on a keystroke are now ruled and recorded here. Everything below the
next divider is the 2026-08-17 entry, kept verbatim.**

**Two paragraphs further down are STALE and are corrected here rather than deleted, because the
lesson is about the tracker.** The 2026-08-16 layer still says Cloudflare is *"still proxied"* and
that *"THE CLOCK IS NOT RUNNING"*. Both were true when written and neither is true now — line 87 and
item 3 of the owner list already record the un-proxy as DONE, so **this file has been disagreeing
with itself in three places for two days.** Re-verified against the live host on 2026-08-18:
`server: Vercel`, **no `CF-RAY`**, our own `robots.txt` served (`Allow: /` plus the sitemap line),
no `noindex` meta tag anywhere, and `sitemap-0.xml` carrying exactly three URLs — the homepage and
the two live articles. The clock is running and the crawl path is correct **by design now, not by
the cover of a `noindex` tag**.

**The four inbox approvals are recorded.** Growth phases 02, 03, 04 and 05 were approved on
2026-08-18 on the owner delegation, each with its evidence bundle named in the approval reason.
The growth section of the HQ inbox is empty.

**RULING 1 — the receipt-less first article: OPTION 1, re-publish it through the path.** The choice
was between (1) a trivial PR that gives `receipts-driven-os` a real `pr_ref`, (2) making `pr_ref`
nullable by ADR, and (3) accepting the gap. Option 2 amends a closed key set on a company organ to
paper over one historical accident, which is the tail wagging the dog. Option 3 leaves arc's own
site carrying a page the spine does not know about, in a cycle whose entire subject is receipts.
**Option 1 costs one merge click and is the only one that ends with a true receipt.** It is also
time-critical rather than tidy-minded: the measurement window is 2026-08-16 → 2026-08-23 and that
article is one of only two live, so every day it stays unjoined is real click data leaving the
EVO-H0 feed permanently.

**RULING 2 — `yc s23`: KILLED, and it costs nothing.** It is a headline fragment, not a topic — the
search behind it is "who was in the YC S23 batch", a directory lookup arc cannot serve without
writing about YC rather than about arc, which the POV floor and E3 would both refuse. ADR-1116 named
this class as explicitly NOT fixed by the residue rule and left it to gate 1, a human reading the
proposal; this is that gate firing, on schedule, for the case it was left open for. **The kill does
not shrink the target**: REQ-09 narrowed to cluster-complete = pillar + ≥5 spokes, and `c-001` holds
7 spokes, so 6 remain and 5 are needed. The approved cluster file is NOT edited — it is the mined
record of what was found, and rewriting an approved plan to match a later editorial call is exactly
the attribution hole `cluster_id`-from-the-plan exists to prevent.

**A gate defect surfaced on 2026-08-18, the code was innocent, and the FIRST repair was worse than
the bug.** The A/B arm fix (PR #206) turned five CI legs red on a test asserting growth names no
`experiment.*` spine kind. The scan was one broad grep, and a comment in the fix ended a sentence
with the word *experiment* followed by a full stop. **Nothing was emitted; an English sentence was
indistinguishable from an event kind.** The lane writes about experiments for a living, so this was
a recurring false positive, and a gate that cries wolf is a gate that eventually gets edited to fit
whatever tripped it.

**The repair was written, judged strictly stronger by its own author, and then taken apart by two
fresh adversarial passes — this line is the correction of a claim made earlier in this same
entry.** The first repair skipped comment-shaped lines and scanned for six named kinds. Both
attackers, working different surfaces and sharing almost no findings, returned the same verdict:
**weaker than the single grep it replaced.** Demonstrated, not argued — the registry holds **eight**
kinds and the list was a hand-typed copy of six, so `experiment.rolled_back` and `promotion.proposed`
were already missing; a line opening with `*` is not a comment, and a generator method and a wrapped
operator continuation both emitted real receipts under node while the gate reported clean; the
exclusion re-anchored on any `:12: //` inside the matched line, a form this repo writes constantly;
`grep | grep -v || true` always exits 0, so the status assertion was decorative; a NUL byte or one
bad multibyte sequence makes grep call a file binary and stop reporting lines, and `evolve/board.mjs`
carries two raw NULs today; and the negative control **passed with zero fixtures on disk**, because
every assertion read `[ -n "$output" ]` and bats satisfies that with grep own error text.

**The second repair stops guessing which lines are comments.** Nothing is excluded; both signals
match shapes only code produces. The kind list is now READ from the registry and fails loudly unless
it is exactly eight, so extending the closed set breaks this suite instead of widening the hole.
`grep` runs directly rather than inside a shell string, so its real exit status is the it-ran
assertion. **Declared limit, written into the test rather than left silent:** a kind assembled at
runtime from parts is invisible to any literal scan and was invisible to the original too — ADR-1102
answered that class for E2 with a parse of the module graph, and the same answer belongs here.
**Follow-up, tracked not dropped:** extend the existing `guard.mjs` graph parse to refuse an
`EXPERIMENT_KINDS` member reaching an emit call. That is a new capability and goes through
`/arc-change`, not into this fix.

**The lesson is the one already in CLAUDE.md, paid for again:** the author of a gate cannot be its
attacker. The author-written breaking inputs for this repair found one hole. Two unanchored agents
found twelve, four of them demonstrated with a real spine emission under node.

---

The owner merged arc-site **#2** and **#3** on 2026-08-16, and the two things that had gated this
lane since 2026-08-12 both fell in the same minute:

- **Phase 00's steel thread ran end to end** — branch → PR → preview build → human merge →
  `content.published` `01M05XS2B71NNXNE5ADRAR7CRT`, verified present in `events/` and absent from
  `_quarantine/`. Phase 00 is **CLOSED**, all 11 criteria.
- **The clock started.** `INDEXABLE = true` is live: `robots.txt` now serves `Allow: /` and the
  sitemap line, and the `noindex` meta tag is gone from every page. Verified against the live host,
  not against the merge. Phase 06 un-parks and its seven days run **2026-08-16 → 2026-08-23**.

There is no owner action left that any phase is waiting on. The two inbox approvals and the
Cloudflare grey-cloud switch remain open and are described below, but nothing blocks on them today.

**Its own tooling caught a real gap on first use.** `checkSitemapCoverage`, run against the live
sitemap and the spine, reported `extra: ["receipts-driven-os"]` — **the first article is live and
indexable with no receipt.** It was pushed directly in the skeleton commit; the GitHub API confirms
no PR was ever opened for it, so a receipt cannot honestly carry the `pr_ref` the closed key set
requires. One was NOT fabricated. The consequence is concrete: every click that article earns will
report UNJOINED and never reach the EVO-H0 feed. Three ways out are set out in
`evidence/phase-00/exit-criteria.md`; the choice is the owner's.

**Earlier correction, kept because the lesson is about the tracker itself.** The 2026-08-14 handoff
named four blockers and three were already done when it was read on 2026-08-16 — a tracker stale in
the direction that stops work. Everything below is verified against artifacts, not reports.

**Current position — BUILD WORK HAS RESUMED.** Phases **02, 03, 04 and 05 remain CLOSED**, each with
a verified evidence bundle; Cycle 14's build merged to `main` as `27efa88` (PR #177) with CI
`31877085144` **19/19 jobs green across three OS legs, read per-JOB**. Phase **01 is UN-PARKED**
(ADR-1115's trigger is TRUE) and Phase **00's steel thread is finally runnable**.

**What changed, and how each was verified — not taken on report:**

| Was blocking | State now | How it was verified |
|---|---|---|
| Vercel↔Git connect | **DONE** 2026-08-14 | The PR #1 merge fired a git-triggered production deploy carrying `githubDeployment: 1` and sha `04dff54f`. Preview URLs exist, so Phase 04's review pack is valid at last |
| arc-site PR #1 merge | **DONE** 2026-08-14 20:49Z | `gh pr view 1 --repo technology-ashiq/arc-site` → MERGED; `arc-site` `main` tip is the merge commit |
| GSC Domain property | **DONE** 2026-08-16 | `google-site-verification=X4WZ3w67…` resolves for `automemory.ai` from `8.8.8.8` **and** `1.1.1.1`. Domain form, so root + every subdomain, one property, one clock |
| arc PR #177 | **MERGED** 2026-08-15 | The 2026-08-14 note called it "deliberately unmerged". It merged. `git diff origin/main` on the cycle branch is empty |

**Still genuinely open, and correctly so:** Cloudflare's `arc` record is **still proxied** (`Server:
cloudflare`, CF-RAY present) and still injecting its managed `robots.txt` above ours — we remain safe
by the `noindex` meta tag rather than by design. And two inbox items are still unanswered.

**THE CLOCK IS NOT RUNNING, AND THE GSC PROPERTY DID NOT START IT.** This is the single most
important line in this section. The site serves `noindex, nofollow` plus `Disallow: /`, so Google
accrues **zero** impressions and Search Console will hold **zero** Performance rows no matter how
long the property sits there. Property **and** indexability together start evolve's four-week clock.
ADR-1105's one-for-one day loss has not been paid off by adding the property — it has **moved**, from
the property to the `INDEXABLE` flip. The owner ruled on 2026-08-16 that the flip ships now.

**The address is now a written decision, not just a DNS record.** `arc.automemory.ai` resolves and
serves. The owner chose the subdomain over the root on 2026-08-13 because `automemory.ai` is the
company and arc is one part of it, so the root, `blog.` and `www.` stay free. **That choice is a
one-way door and it went three days undocumented** — ADR-1105 required it to get its own ADR at this
gate, and the phase holding that obligation was PARKED, so nothing was checking. Now **ADR-1118**,
which also names the option it rejected: `automemory.ai/arc` was the stronger long-run SEO position
and lost to repo independence (ADR-1104), knowingly, on the day both addresses were at zero
authority and the trade was therefore free.

**State of the PRs.**

| PR | Where | State |
|---|---|---|
| arc **#177** | this repo, `feat/arc-growth-cycle-14` | **MERGED 2026-08-15** as `27efa88`. CI `31877085144` 19/19 green, read per-JOB at head. That branch is spent — zero diff vs `origin/main` |
| arc-site **#1** | `technology-ashiq/arc-site` | **MERGED 2026-08-14 20:49Z** as `04dff54f`. Its merge is what proved Vercel↔Git is connected |
| arc-site **INDEXABLE flip** | `technology-ashiq/arc-site`, new | **PREPARED 2026-08-16, awaiting the owner's merge.** One-line constant flip. This is the clock (E2 — the machine never merges a publish) |
| arc-site **steel thread** | `technology-ashiq/arc-site`, new | **PREPARED 2026-08-16, awaiting the owner's merge.** Phase 00 criterion 10; the merge is what lets `content.published` be emitted from the merged tree |

**CI.** The last read run is `31877085144` @ `27efa88` — **19/19 green, three OS legs, per-JOB**, and
its head SHA confirmed against `origin/main`'s tip. One earlier failure on that commit was diagnosed
as an `apt-get update` setup step dying on a flaky Google Chrome apt mirror, so the suite never
started; re-dispatched for a clean signal. Recorded as an exception to the no-re-run norm rather
than quietly re-run, because nothing actually flaked — nothing ran.

**The three-lane ADR collision — now closed everywhere.** `ledger`, `legal` and `growth` all claimed
century 1000–1099 in the same week. Ledger merged first and keeps it; growth renumbered to
**1100–1199** (ADRs 1100–**1118**). `legal` **confirmed and completed its own move on 2026-08-15**,
taking 1200–1213 — fourteen ADRs and 179 references, rewritten only inside legal-owned paths,
because a tree-wide sed would have renumbered LEDGER's `ADR-1004`, a different decision that is
correct where it stands. The paste job listed in the 2026-08-14 owner queue is **done and is removed
from the queue below.**

The mechanism failed, not the lanes: all three ran the "scan every sibling worktree" check the band
table says prevents this, and the check cannot see what three other sessions are about to write.
Worth a company-level fix in a retro rather than a fourth lane paying for it.

**Next step: BOTH.** The machine's half is Phase 01's build (ADR-1118 written; `/sitemap.xml`
served; `content.published.site` pinned) plus Phase 00's steel-thread PR. The owner's half is two
merge clicks and the queue below. The two approvals are live inbox items and take one command each:

```bash
cd E:/Work_Hub/01_Automemory/arc
node .claude/scripts/hq/arc-inbox.mjs inbox
node .claude/scripts/hq/arc-inbox.mjs approve 01KZZRVSQJEAVD4YCZ8FDXR0DT --reason "..."   # 3 voice exemplars (ADR-1114)
node .claude/scripts/hq/arc-inbox.mjs approve 01KZZRW51QHTA9CFEX5JRRGY7C --reason "..."   # cluster c-001, gate 1
```

Read the artifacts before approving. `c-001` still carries **`yc s23`**, a headline fragment no
selection rule can kill without a blocklist — gate 1 is exactly where a human strikes it (ADR-1116).

Both site blockers cleared on 2026-08-14, so Phase 00's steel thread and the publish loop in
`RUNBOOK.md` run for real from here. The Search Console property landed 2026-08-16, so **Phase 01 is
un-parked**; Phase 06 additionally waits on the indexability flip.

## Owner queue — rewritten 2026-08-16

The 2026-08-14 queue had four items. **Three are done** and are struck below with their evidence
rather than deleted, because a queue that silently loses rows cannot be audited against what it
once claimed. Ordered by how much each unblocks.

1. ~~**Vercel → arc-site → Settings → Git → connect.**~~ **DONE 2026-08-14.** Proven by the PR #1
   merge firing a git-triggered production deploy (`githubDeployment: 1`, sha `04dff54f`), not by
   inspecting a settings page. Per-PR preview URLs now exist, so Phase 04's review pack is valid.
   **One caveat, recorded rather than assumed away: no preview deployment has ever actually been
   produced** — all three deployments to date are `target: production`. The connection is proven;
   the preview half is proven only when the first PR builds one, which the two prepared PRs will do.
2. ~~**Merge arc-site PR #1.**~~ **DONE 2026-08-14 20:49Z**, merged as `04dff54f`.
3. ~~**Cloudflare → the `arc` record → grey cloud (DNS only).**~~ **DONE, verified 2026-08-17.**
   `server: Vercel` and **no `CF-RAY` header** — the record is no longer proxied. `robots.txt` is
   now 77 bytes and a single coherent group (`User-agent: *` · `Allow: /` · `Sitemap:`), where it
   previously carried Cloudflare's managed block with `Allow: /` sitting above our `Disallow: /`.
   **The timing mattered more than it looked.** While the site was `noindex` the meta tag was doing
   the real work and the conflicting robots groups were harmless-by-accident. Flipping `INDEXABLE`
   removed that cover, so had this stayed proxied, the first genuinely crawlable day would also
   have been the first day two contradictory robots groups were the only instruction Google had.
4. ~~**Search Console → Domain property for `automemory.ai`.**~~ **DONE 2026-08-16.** Domain form,
   verified by TXT `google-site-verification=X4WZ3w67…` resolving from `8.8.8.8` and `1.1.1.1`.
   Covers the root and every subdomain: one property, one clock.

**New, and the top of the queue — two merge clicks (E2: the machine never merges a publish):**

5. ~~**Merge the `INDEXABLE` flip PR.**~~ **DONE 2026-08-16** (arc-site #3, `f8b9ea6`). Verified on
   the live host rather than on the merge: `robots.txt` serves `Allow: /` plus the sitemap line and
   no `noindex` meta tag remains. **The clock is running: 2026-08-16 → 2026-08-23.**
6. ~~**Merge the steel-thread PR.**~~ **DONE 2026-08-16** (arc-site #2, `b2626c1`). Phase 00
   criterion 10 closed with receipt `01M05XS2B71NNXNE5ADRAR7CRT`. It also produced the first two
   preview deployments this project has ever had, closing item 1's caveat.

**Open, but nothing is waiting on them:**

7. **Decide what happens to `receipts-driven-os`.** It is live and indexable with **no receipt**,
   because it was pushed directly and never had a PR, so `pr_ref` cannot be filled honestly. Its
   traffic will report UNJOINED forever until this is settled. Options in
   `evidence/phase-00/exit-criteria.md`: re-publish it through the path (one merge click), make
   `pr_ref` nullable by ADR, or accept the gap.

**Not yet, and not to be done on anyone's initiative:**

- **Approving cluster `c-001`** — gate 1, inbox `01KZZRW51QHTA9CFEX5JRRGY7C`. Owner-only, and needed
  only when Phase 03's generator is ready to run against it. `c-001` still carries **`yc s23`**, a
  headline fragment no selection rule can kill without a blocklist — gate 1 is exactly where a human
  strikes it (ADR-1116).
- **Approving the 3 voice exemplars** — inbox `01KZZRVSQJEAVD4YCZ8FDXR0DT`, a one-time setup
  approval and not a recurring gate (ADR-1114).
- ~~**Making the site indexable**~~ — **this moved to queue item 5 on 2026-08-16.** It sat here as
  "needs the owner to look at the live site and say go"; the owner looked and said go. The flip is
  a committed constant in `src/lib/site.mjs` rather than an env var precisely so it stays a reviewed
  diff a human merges, and that is still how it ships — the PR is prepared, not merged.
