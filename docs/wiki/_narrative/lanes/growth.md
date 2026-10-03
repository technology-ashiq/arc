<!-- facts: appetite=1858658b blocked-on=2442d69a burn=e070fd72 cycle=03a30050 depends-on=a68c9074 hasPlan=b5bea41b phase=46accb2a status=8ddd7aee title=7bd650ec -->
```tagline
The lane that puts arc on the open web. A machine drafts articles and opens the request to publish
them. Only a person can press merge.
```

# Start here

## In plain words

Think of arc as a small company. Growth is its **newsroom**. A researcher finds what people actually
search for. An editor (the owner) picks a story plan. A writer (the machine) drafts articles in the
owner's approved voice. A printing press (the pull request) is switched on by the owner, never by the
writer.

```panel big
**The machine never merges.** It can draft an article and open a pull request. Going live always needs a person to click merge. The guard that enforces this was tested by a deliberately bad program that tried three different ways around it. Each try was refused.
```

### What this lane is for

The plan (`initiatives/growth/PLAN.md`) has two goals at once. It is arc's first traffic engine, one
command per channel on one site. And it starts a clock: each week, search numbers for every article
become a receipt, which an already-built learning module (`ADR-0408`) is waiting to read.

### Why it built its own road

At kickoff the plan checked its own premises against the real repo. Some did not hold, so the lane
built its missing road first (`ADR-1103`). The site is arc's first web surface, so it lives in a second
repository (`ADR-1104`) and at a subdomain of the company address (`ADR-1118`).

## arc words → normal words

```lede
Six pieces of jargon. Each is an ordinary newsroom thing under a technical name.
```

```rosetta
cluster | one story plan | a main topic plus distinct side topics, approved by a person before any drafting
exemplar | a sample of the owner's voice | approved once; the only style input the writer gets
POV floor | "say something of your own" | a draft must carry a point of view, not just restate a source
slop-lint | a bad-habits checker | flags known weak phrasing; it only flags, it never scores quality
citation-lint | a sources checker | every claim of fact needs a link
content.published | the "this went live" receipt | one per article, written to arc's logbook
```

## How one article goes live

```lede
Two places need a person, and the end of the road is always a person too.
```

```flow
source: arc-growth.mjs mine
box: ① Mine | real keyword evidence
box*: ② Approve plan | person says yes
box: ③ Draft + lint | writer, then checkers
box*: ④ Pull request | person merges
labels: cluster, drafts, opened
out: weak evidence | no plan proposed
out: -
out: lint fails | back to the writer
out+: merged | receipt + weekly numbers
divider: 2 | machine only | a person decides
note: Growth adds no merge command at all. A guard checks the code itself to prove it.
caption: Figure 1 — one article, from evidence to receipt. | The solid boxes are the two recurring human gates (ADR-1112).
```

## The stages, one by one

```lede
Each stage is written twice: in ordinary words, then what actually happens.
```

```steps
t: Find real evidence
plain: The researcher gathers what people really search for, and proposes one story plan. It never invents a keyword list.
d: The miner turns evidence into a cluster proposal. A spoke must be a distinct topic, not the main topic re-worded (ADR-1116).
f: `.claude/scripts/growth/lib/mine.mjs`

t: Draft, then check
plain: The writer copies only the owner's approved voice. Two checkers then look for bad habits and missing sources. They can only say no, never give a grade.
d: Lints are negative-only forever, and exemplars are the only style input (ADR-1110).
f: `.claude/scripts/growth/lib/slop-lint.mjs`

t: Publish by request
plain: The article travels as a pull request with a preview page. A person reads it and merges. Then the receipt is written.
d: Publishing is a pull request the machine may never merge (ADR-1102).
f: `.claude/scripts/growth/lib/guard.mjs`

t: Read the weekly numbers
plain: Each week a search-console export is turned into per-article receipts. The reader refuses any file whose dates do not match the week asked for.
d: A range-matched weekly read that refuses what it cannot prove (ADR-1108).
f: `.claude/scripts/growth/lib/ingest.mjs`
```

# The bigger loop

## A week, as a story

```loop
top: 1 | a topic
top: 5 | the numbers
stage: 1 · Evidence found | a story plan is proposed
stage*: 2 · Owner approves | plan or no plan
stage: 3 · Article drafted | checked, then requested
stage*: 4 · Owner merges | article goes live
stage: 5 · Numbers come back | one receipt per article
labels: plan, draft, live, weekly
back: last -> 1 | the results shape the next plan
caption: Figure 2 — the loop growth is built to run. | Two boxes need a person; the rest is machine work.
```

1. The researcher proposes a plan for one topic.
2. The owner approves it, or rejects it.
3. The writer drafts, the checkers pass it, and a pull request opens.
4. The owner merges and the receipt is written.
5. A week later, the search numbers arrive and are recorded.

*This story is an illustration of how the loop is meant to run. It is not a real result.*

## Where it stands

The tracker (`initiatives/growth/PROGRESS.md`) holds the live phase and burn in the generated sections.
In words: every build phase is closed, and the first real article went the whole way through a pull
request, the owner's merge and a receipt. Nothing more is buildable. What remains is waiting.

The waiting has a reason. While setting up the site, the lane checked the search console and found the
search engine had never visited the site, because nobody had submitted a sitemap. The weeks counted
until then counted for nothing. The sitemap was submitted and the clock restarted. A zero from a site
nobody has visited looks the same as a zero from a site nobody searched for, so the lane refused to read
early.

What is next: let the crawled site run seven days, read the first honest week, then close the last
phase. `initiatives/growth/RUNBOOK.md` says how to run the weekly steps.

## How it connects to the rest of arc

- **The logbook.** Receipts (`content.published`, `metric.observed`) go on the same append-only logbook
  as every other lane.
- **The learning module.** Growth supplies the weekly numbers that module is waiting for. It does not
  redefine them; it follows `ADR-0408`.

# Meta

## Glossary

```gloss
spine: arc's append-only logbook of what happened.
sitemap: a list of pages handed to a search engine so it can find the site.
search console: the search engine's dashboard that shows whether and how a site is found.
INDEXABLE: the single switch that lets search engines see the site at all.
```
