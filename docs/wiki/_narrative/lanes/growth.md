<!-- facts: appetite=1858658b blocked-on=2442d69a burn=e070fd72 cycle=03a30050 depends-on=a68c9074 hasPlan=b5bea41b phase=46accb2a status=8ddd7aee title=7bd650ec -->

## In plain words

Think of arc as a small company. Growth adds arc's first web surface — a public site at a real
address — and the machine that runs it can draft and open a pull request but can never merge one:
every publish still needs a human to click merge. <!-- src: initiatives/growth/PLAN.md#ever; ADR-1102; ADR-1118 -->

The goal, in the lane's own words, is one command per channel on one site: a miner that finds real
keyword evidence, a human who approves the cluster plan, a machine that drafts exemplar-anchored
articles with an original-POV floor, a publish step that is always a pull request a human merges,
and a weekly Search-Console ingest that turns outcomes into receipts for an evolve module that is
already built and waiting. <!-- src: initiatives/growth/PLAN.md#alarm -->

### What it is building

- **The `growth` product** — scripts that mine keyword evidence, gate a cluster proposal, draft
  articles, lint them, publish through a pull request, and ingest a weekly metrics CSV; it requires
  `core` and `hq`, and its manifest declares no commands or agents of its own. <!-- src: products/growth/manifest.json; initiatives/growth/PLAN.md#flowchart -->
- **A second, separate repository** — a static site built with Astro and MDX, the first web
  surface arc has ever had, chosen over a company-root path so the site stays independently
  deployable. <!-- src: initiatives/growth/PLAN.md; ADR-1104 -->
- **A new receipt kind, `content.published`**, added to the spine's closed vocabulary so every
  article that goes live leaves a permanent, typed record. <!-- src: products/growth/manifest.json; ADR-1101 -->
- **The clock for an already-built metrics module.** `metric.observed` was already law, shipped by
  a separate lane's cycle, but zero had ever been emitted — that lane shipped the vocabulary and its
  own campaign was parked, so no feed existed yet. Growth ships the feed. <!-- src: initiatives/growth/PLAN.md#shipped; ADR-0408 -->

## arc words → normal words

| arc calls it | It is really |
|---|---|
| cluster | One pillar topic plus several distinct spoke topics and a couple of bottom-of-funnel rows, all evidence-linked, proposed as one item a human approves before any drafting starts. <!-- src: initiatives/growth/PLAN.md -->  |
| exemplar | A writing sample the owner approves once; the approved set is the only style input for the drafting step. <!-- src: initiatives/growth/PLAN.md; ADR-1110; ADR-1114 --> |
| POV floor | A rule that a draft must carry the venture's own point of view, not just restate a source. <!-- src: initiatives/growth/PLAN.md --> |
| slop-lint / citation-lint | Two checks run on a finished draft: slop-lint flags known low-quality phrasing patterns and never scores what's absent; citation-lint requires every claim of fact to carry a source link, and treats a dead link as a warning, not a failure. <!-- src: initiatives/growth/PLAN.md; ADR-1110 --> |
| gate 1 / gate 2 | The two recurring places a human must say yes: approving a mined cluster before any generation runs, and approving a finished review pack before an article is merged. <!-- src: products/growth/manifest.json; ADR-1112 --> |
| EVO-H0 feed | A weekly ingest of a Search Console export that lands as a receipt of per-URL figures, never a summed site total, starting the clock toward evolve's own trigger. <!-- src: ADR-1108; ADR-0408 --> |
| `content.published` | The receipt kind meaning one article's bytes went live — the chain REQ-10 names: branch → pull request → preview URL → hand-merge. <!-- src: initiatives/growth/PLAN.md#hand-merge; ADR-1101 --> |
| `metric.observed` | The receipt kind for one week of Search-Console numbers, joined to one URL; growth emits it but does not redefine it — `ADR-0408` is law, and growth conforms and flags back. <!-- src: initiatives/growth/PLAN.md#redefinition; ADR-0408 --> |
| INDEXABLE | The single flag that switches the site from hidden-from-search to publicly crawlable. <!-- src: initiatives/growth/PROGRESS.md --> |
| range-match guard | A refusal that compares a weekly analytics export's own stated date range against the calendar week being ingested, and stops rather than silently trusting the file. <!-- src: ADR-1108 --> |
| title-template arm | One of two versioned headline styles a published article is assigned to, by hashing its slug rather than by anyone picking. <!-- src: ADR-1106 --> |
| spec-verify | An executable diff that checks the live `metric.observed` validator against the frozen spec of the evolve module it feeds, and flags any deviation back rather than absorbing it silently. <!-- src: ADR-1109 --> |
| `supersedes` | The only way a receipt is ever corrected — a new receipt naming the old one, because nothing on the spine is ever edited in place. <!-- src: initiatives/growth/PLAN.md --> |

## How the work was planned

The lane was opened with a ten-day hard cap, stated as a constraint rather than an estimate: going
over it means a scope cut or a kill, never a quiet extension. <!-- src: initiatives/growth/PLAN.md#owner-set -->
It was sized as a Tier M piece of work. <!-- src: initiatives/growth/PLAN.md#owner-set -->

Its kill line sat at a fifty-percent tripwire of five days: if by then no content PR had
travelled end-to-end to a merged `content.published`, the call was that the publish path was
fighting the stack — bank the vocabulary ADRs and the miner as documentation, stop, and retro. <!-- src: initiatives/growth/PLAN.md#Never -->
Three cuts were pre-decided rather than argued about on the day: narrowing the first real mining
run to a fixture source set, narrowing the planned ten-article drip to cluster-complete — pillar
plus at least five spokes, and dropping a second sample draft in the generator phase. <!-- src: initiatives/growth/PLAN.md#Never -->

The plan sets out a numbered list of requirements, three of them cut outright at kickoff and the
rest each carrying its own measurable acceptance test: <!-- src: initiatives/growth/PLAN.md#REQ-08 -->

| REQ | User outcome |
|---|---|
| REQ-00 | Publishing exists on the spine at all, as a new closed receipt kind with its own idem rule. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-01 | Targets are real and human-chosen: a mined cluster proposal, not an invented list of keywords. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-02 | Articles are good, not just compliant with a lint. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-03 | Publishing is always a pull request; the publish command itself has no merge path and no default-branch push path, a guard proven by rejecting a running mutant that tries exactly that. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-04 | A dumb, deterministic two-arm headline test exists; growth emits zero `experiment.*` events itself, because that stream belongs to evolve. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-05 | The weekly metrics feed that starts the other module's evaluation clock. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-06 | A designed, branded site look — cut at kickoff for lack of any reader yet. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-07 | A video pipeline — cut at kickoff. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-08 | Subscriber lifecycle mail — cut at kickoff, with zero subscribers to serve it. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-09 | A real week of publishing actually happened, counted honestly rather than to a target. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-10 | The site exists at all and serves one real article through the whole path. <!-- src: initiatives/growth/PLAN.md --> |
| REQ-11 | The site has a name, DNS, and a verified search-console property — the piece that starts the measurement clock. <!-- src: initiatives/growth/PLAN.md#REQ-11 --> |

## The phases, one by one

| Phase | What it set out to prove | What shipped |
|---|---|---|
| 0 — Contract + the road + steel thread | The new receipt kind, the site itself, and one real article carried end to end to a merged, receipted publish. <!-- src: initiatives/growth/PLAN.md --> | Closed with all eleven exit criteria met; the steel thread ran for real through a branch, a pull request, a preview build and the owner's own merge. <!-- src: initiatives/growth/PROGRESS.md --> |
| 1 — Name and instrument the site | A named domain, working DNS, and a verified search-console property, because that property cannot backdate its own history. <!-- src: initiatives/growth/PLAN.md#REQ-11; ADR-1105 --> | Closed, then found the property alone had not started anything: the site had never actually been crawled because no sitemap had ever been submitted. <!-- src: initiatives/growth/PROGRESS.md --> |
| 2 — Miner + cluster gate | A tool that mines real keyword evidence and proposes one approvable cluster. <!-- src: initiatives/growth/PLAN.md --> | Closed; a real mining run against a public source produced an evidence-linked cluster, and a selection bug in how spokes were ranked was found and fixed the next day. <!-- src: initiatives/growth/PROGRESS.md --> |
| 3 — Generator + lints | An exemplar-anchored drafting step plus two negative-only lints, attacked on two different surfaces. <!-- src: initiatives/growth/PLAN.md --> | Closed with 7 of 8 criteria met (the exemplar approval stayed owner-outstanding); the adversarial pass found thirty-five real holes, the worst letting an article with markers and fabricated figures pass both lints at once. <!-- src: initiatives/growth/PROGRESS.md --> |
| 4 — Publish path + A/B + GEO | A publish guard proved by parsing the code's own module graph, plus the two-arm headline test. <!-- src: initiatives/growth/PLAN.md --> | Closed; a running mutant tried three separate ways to merge or push around the guard and was refused every time. <!-- src: initiatives/growth/PROGRESS.md --> |
| 5 — The EVO-H0 feed | The weekly ingest, with its range, lag and header refusals, checked against the other module's frozen spec. <!-- src: ADR-1108; ADR-1109 --> | Closed fixture-proven, not yet live-validated — there was no search-console property yet to ingest a real export from. <!-- src: initiatives/growth/PROGRESS.md --> |
| 6 — Real week | An honestly-counted real week of publishing, with at least one metrics window either complete or shown loudly as MISSING with its reason. <!-- src: initiatives/growth/PLAN.md --> | Un-parked, then reset once the lane discovered the site had never actually been crawled; closes on elapsed time once the crawled site has run seven days. <!-- src: initiatives/growth/PROGRESS.md --> |

## What it decided

| ADR | Decision |
|---|---|
| 1100 | growth is born as a lane and claims ADR century 1100 to 1199. <!-- src: ADR-1100 --> |
| 1101 | `content.published` joins the spine's closed kind set, and growth adds no policy row for it. <!-- src: ADR-1101 --> |
| 1102 | Publishing is a pull request the machine may never merge. <!-- src: ADR-1102 --> |
| 1103 | Growth builds its own road and spends its stretch slot on it. <!-- src: ADR-1103 --> |
| 1104 | The site is a static Astro and MDX build in its own repository. <!-- src: ADR-1104 --> |
| 1105 | The domain is chosen at the first phase's entry gate, because the search-console clock never backdates. <!-- src: ADR-1105 --> |
| 1106 | Two title templates, versioned as files, assigned by hashing the slug. <!-- src: ADR-1106 --> |
| 1107 | An unedited approval means the published bytes hash identically to the draft; twenty of them is the evidence bar for the next autonomy level. <!-- src: ADR-1107 --> |
| 1108 | The weekly ingest reads a range-matched export of Pacific-time days and refuses what it cannot prove. <!-- src: ADR-1108 --> |
| 1109 | The spec-verify found three deviations against the other module's frozen spec, and growth conforms to the code rather than to the design document. <!-- src: ADR-1109 --> |
| 1110 | Lints stay negative-only forever, and exemplars are the only permitted style input. <!-- src: ADR-1110 --> |
| 1111 | Content policy sets the cluster shape, the point-of-view floor, and a clause requiring honest counting over hitting a target. <!-- src: ADR-1111 --> |
| 1112 | Exactly two recurring human approval gates exist; one-time setup approvals do not count as gates. <!-- src: ADR-1112 --> |
| 1113 | A search-engine ping and a machine-readable summary file were planned as cheap hedges; the ping was then cut in the same ADR's amendment, so only the summary file ships. <!-- src: ADR-1113 --> |
| 1114 | Voice exemplars are machine-drafted and approved by the owner once, never treated as an ongoing writing task. <!-- src: ADR-1114 --> |
| 1115 | Growth ships as a standing capability, with its two domain-dependent phases parked rather than faked. <!-- src: ADR-1115 --> |
| 1116 | A spoke in a cluster must be a genuinely distinct topic, not a restatement of the pillar's own words. <!-- src: ADR-1116 --> |
| 1117 | A metrics correction must carry a revisioned identifier, because the emitter's own idem rule could otherwise drop it. <!-- src: ADR-1117 --> |
| 1118 | The site's address is a subdomain of the company's own root domain, chosen as a one-way decision. <!-- src: ADR-1118 --> |
| 1119 | A supersede chain is keyed on the receipt's own identifier, and command-line receipt lookups take event projections. <!-- src: ADR-1119 --> |
| 1120 | Invisible and right-to-left override characters are refused in a title, though zero-width joiners are allowed through. <!-- src: ADR-1120 --> |

## Where it stands now

The lane's own tracker reads live, on phase six, with eight of its ten allotted days burned. <!-- src: fact:lanes/growth.status; fact:lanes/growth.phase; fact:lanes/growth.burn; fact:lanes/growth.appetite -->
It is blocked on nothing but elapsed time: the site was only actually discovered by a search
engine on a specific date, so the earliest honest reading of a full week of real traffic falls
several days later. <!-- src: fact:lanes/growth.blocked-on -->

Four articles are live, and the lane's fifty-percent kill line was briefly breached and then
cleared once a real article had in fact travelled the whole path to a merged, receipted publish —
recorded plainly rather than quietly deleted. <!-- src: initiatives/growth/PROGRESS.md#Four -->

Each of the four live articles carries its own `content.published` receipt, with a title-template
arm and a cluster named alongside it; none of it was hand-typed — every value was derived by
reading the published file and hashing it. <!-- src: initiatives/growth/PROGRESS.md#hand-typed -->

Nothing further is buildable and nothing is owner-blocked; the remaining phase closes on elapsed
time alone. <!-- src: initiatives/growth/PROGRESS.md#owner-blocked -->

## The bigger loop

### What went wrong and what was learned

- **A cluster selection bug looked like a wrong design and was actually a wrong ranking rule.** An
  early cluster's supporting topics all restated the pillar topic's own words; the cause was a
  ranking step that rewarded exact repetition rather than the shape of the cluster being wrong,
  and it was fixed at the ranking step rather than by loosening the shape rule. <!-- src: initiatives/growth/PLAN.md; ADR-1116 -->
- **A green flag did not mean a search engine had ever visited.** The site was made publicly
  crawlable, and for days the tracker treated that as the start of the measurement clock; opening
  the search console directly showed the address was still unknown to the search engine, because
  no sitemap had ever been submitted. <!-- src: initiatives/growth/PROGRESS.md -->
- **The same tracker file disagreed with itself.** One field meant to summarize burned time held a
  stale number for two closed phases while the prose beside it already told the true story, which
  the lane recorded as a lesson about the one file meant to be the single source of truth. <!-- src: initiatives/growth/PROGRESS.md -->
- **A human-directed exception to the publish rule was written down rather than absorbed quietly.**
  This session merged two articles itself, on the owner's own instruction repeated twice, and the
  lane recorded it as one dated, owner-directed exception rather than treating the standing
  human-merge rule as unbroken. <!-- src: initiatives/growth/PROGRESS.md#ellame -->
- **An unrelated A/B-arm fix turned five CI legs red, and the code itself was innocent.** PR #206's
  own comment ended an ordinary sentence with the word `experiment`, and the gate's one broad grep
  could not tell that sentence from a real spine kind. The repair written for the gate was judged
  strictly stronger by its own author, then taken apart by two fresh adversarial passes as weaker
  than the single grep it replaced. <!-- src: initiatives/growth/PROGRESS.md#innocent -->
- **Three lanes claimed the same ADR-numbering century in the same week.** `ledger`, `legal` and
  `growth` all claimed century 1000–1099; the check meant to prevent that — scanning every sibling
  worktree before claiming a range — could not see what the other two sessions were about to write
  at the same time, and growth renumbered to 1100–1199 once the collision surfaced. <!-- src: initiatives/growth/PROGRESS.md#sibling -->

### How it connects to the rest of arc

Every real week this lane publishes moves a separate, already-built metrics module one step
closer to its own evaluation trigger, because that module's vocabulary was shipped in an earlier
lane's cycle and has been waiting, unexercised, ever since. <!-- src: initiatives/growth/PLAN.md#shipped; ADR-0408 -->

Growth deliberately does not own or redefine the receipt kind that carries those weekly numbers —
`ADR-0408` is law — and where its own reading of that kind's validator turned up a deviation, it
conformed to the code and flagged the deviation back rather than absorbing it silently. <!-- src: initiatives/growth/PLAN.md#redefinition; ADR-1109 -->

Editing a company-wide file follows the same rule as any other shared organ: before touching
`KINDS` in `validate.mjs`, the lane checks recent commits from other live lanes rather than
assuming its own branch is the only one changing it, and takes the stronger version at any merge
conflict. <!-- src: initiatives/growth/PLAN.md#conflict-checked -->

## Glossary

- **cluster** — one approvable proposal of a pillar topic and its supporting spoke topics, each
  linked to real evidence. <!-- src: initiatives/growth/PLAN.md -->
- **exemplar** — an owner-approved writing sample used to anchor a draft's voice. <!-- src: ADR-1110; ADR-1114 -->
- **POV floor** — the requirement that a draft add a genuine point of view rather than only
  summarize a source. <!-- src: initiatives/growth/PLAN.md#original-POV; ADR-1110 -->
- **gate 1 / gate 2** — the cluster approval and the review-pack approval, the lane's only two
  recurring human checkpoints. <!-- src: ADR-1112 -->
- **EVO-H0 feed** — the weekly flow of real metric receipts that starts the evolve module's own
  evaluation trigger. <!-- src: ADR-1108; initiatives/growth/PLAN.md#shipped; ADR-0408 -->
- **INDEXABLE** — the flag that switches the site from hidden to publicly crawlable. <!-- src: initiatives/growth/PROGRESS.md -->
- **spec-verify** — an executable diff that checks the live `metric.observed` validator against
  the frozen spec of the evolve module it feeds, and flags any deviation back rather than
  absorbing it silently. <!-- src: ADR-1109 -->
- **range-match guard** — the refusal that compares an analytics export's own date range against
  the week being ingested before accepting any numbers from it. <!-- src: ADR-1108 -->
