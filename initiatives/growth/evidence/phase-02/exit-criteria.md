# Phase 02 — exit criteria, checked against the spec

Commit `d4500cc` · CI run `31778577391`, **19/19 jobs green**, three OS legs, read per-JOB
(`ci-run-31778577391.json` in this bundle; its `headSha` equals the commit above).

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | `arc growth mine` reads a **named, versioned** source list and emits `{keyword, evidence_url, intent, gap_note}` | **MET** | `initiatives/growth/sources.json` — 4 sources, 1 enabled, each disabled row carrying its reason |
| 2 | **Own-pages exclusion** read from the site's own sitemap | **MET, and exercised live** | `real-mining-run.txt`: run against `https://arc.automemory.ai/sitemap-0.xml`, `own pages read 1; candidates excluded as own 0` |
| 3 | Gap column filled from real evidence, one URL per row | **MET AS NARROWED — and the narrowing is the honest part** | see "The one gap" below |
| 4 | Cluster plan = ONE inbox item, 1 pillar + ≥5 spokes + 2–3 BOFU, every row evidence-linked | **MET** | `cluster-c-001.json` — 1 pillar, 7 spokes, 2 BOFU, 10/10 rows with a resolving `https://` evidence link |
| 5 | A candidate with a missing or unresolving `evidence_url` cannot enter — structurally | **MET** | `growth-cluster-gate.bats` "an evidence-less candidate cannot enter the proposal" → `NO_EVIDENCE`; dead-link partition in `growth-mine.bats` |
| 6 | Generation against an unapproved cluster is refused, **in code** | **MET** | `assertClusterApproved`, bound to `plan_sha` not merely `cluster_id`; 26 tests in `growth-cluster-gate.bats`, including the CLI-level case |
| 7 | **One REAL mining run** produces a real cluster proposal | **MET** | `real-mining-run.txt` — live against HN's Algolia API, 13 attested candidates, `plan_sha 222436069551ca21…` |

## The one gap, stated rather than ticked

**Criterion 3 was narrowed on 2026-08-14 through `/arc-change`.** It originally read *"competitor-gap
column filled from real SERP evidence"*. That cannot be met inside this cycle for two independent
reasons, neither of which is effort:

- the `competitor-pages` source is **disabled pending the owner's fair-game list**, which this
  phase's own Your-setup item asks for; and
- **no SERP source satisfies the official-APIs-only non-negotiable** — the autocomplete and results
  endpoints in common use are undocumented.

What shipped is the column, the one-URL-per-row rule, and real **attestation** evidence from the
enabled source. Competitor-gap notes remain manual-entry rows, unfilled. This is recorded as a gap
rather than ticked, per E3.

## What the phase found that its own report had not

**Assumption A-05 fired.** The first `c-001` was pillar `ai agents` with spokes `agents build`,
`ai agents build`, `coding agents` — the assumption's exact trigger. Diagnosis: spoke selection
sorted by *descending token overlap with the pillar*, so the rule preferred a candidate the more
exactly it repeated the pillar; and the tokeniser dropped tokens of ≤2 characters, deleting `ai`
from the comparison. Fixed by **ADR-1116**'s residue rule. Rebuilt from the same 13-candidate pool,
`c-001` is 1 pillar + **7 distinct** spokes + 2 BOFU — so the 1-pillar-plus-≥5 **shape held** on its
first honest test, and ADR-1111's revisit trigger is **not** fired.

**A reported number was not the measured number.** `arc-growth mine` printed
`own-page exclusions ${ownTargets.size}` — the count of pages read from the sitemap, under a label
claiming it was the count of candidates removed. Two real runs excluded nothing and both reported
`1`. `mine()` now measures and returns the count and the CLI prints both, separately labelled.

## Known limit carried forward, not closed

`yc s23` survives every selection rule and sits in the proposal. It is a headline fragment attested
by two independent stories, so it is not a bug in attestation; killing that class needs either a
blocklist (fragile, and named as a rabbit hole in the spec) or token-level attestation (a second
mechanism, unevidenced). **ADR-1116 records it as a known limit handled at gate 1**, which is a
human reading the proposal.

## Red-first, honestly

The spec asks each refusal to be observed RED before the refusal exists. CI is the only place tests
run in this repo and its queue is hours deep, so what ran instead was a **mutant pass**: the guard
is deleted and the suite must go red. Two of three mutations went red correctly; the third proved
the spoke-floor guard unreachable by any input that gets past the pool check, and it is now labelled
an invariant backstop rather than left looking tested. **This is weaker than red-first and is
recorded as such.**

## Not verifiable by machine, therefore not claimed

The real run's proposal being **read by a human** before Phase 3 opens. That is an owner action.
Gate-1 approval of `c-001` is separate and also outstanding — it is only needed when Phase 03's
generator is ready to run against it.
