# ADR 1013 — IndexNow and `llms.txt` ship as cheap hedges, and are never counted as growth levers

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** Google announces IndexNow support, or a measurement study shows AI crawlers
actually fetching `llms.txt` at a material rate — either would promote these from hedges to
levers, and the claim would then be re-argued with that evidence.

## Context

REQ-03 bakes a "GEO" bundle into the publish template: Article+FAQPage JSON-LD, an author entity,
a disclaimer, `llms.txt`, sitemap auto-update, and an IndexNow ping on merge. The design source
presents these as growth machinery without evidence for any individual part. Constitution **E3**
forbids dressing an unproven thing as a working one, and this cycle's whole measurement story runs
through Search Console — i.e. through **Google**.

Research, 2026-08-12:

- **IndexNow is real** (Bing/Yandex co-authored, open spec, maintained) and is supported by
  **Bing, Yandex, Seznam, Naver, Yep**. **Google does not support it** and publicly declined to
  adopt it. So a ping helps crawlers that this cycle **does not measure**.
- **`llms.txt` is real** as a community proposal with a specified format, but Google's own
  AI-optimization guide states plainly that it is **not needed for Google Search or its generative
  AI features and has no positive or negative effect** on visibility or ranking. Independent
  measurement over a 500M-AI-bot-visit sample found ~408 direct `/llms.txt` fetches —
  statistically negligible; the crawlers read HTML.
- **JSON-LD, the sitemap and the author entity are different** — those are documented,
  Google-consumed structured data, not hedges.

## Options considered

1. **Ship all of it, and label which parts are evidenced and which are hedges.**
2. Drop IndexNow and `llms.txt`. Con: both are genuinely cheap — one static key file plus one HTTP
   call, and one generated markdown file — and both are free options on a future where adoption
   changes.
3. Ship them and describe the whole bundle as "GEO", as the design source does. Con: that reports
   an unmeasured, currently-inert file as a growth mechanism, which is the E3 line.

## Decision

**Option 1.** All parts ship; the claims are separated, and the separation is written into
`PLAN.md` where it will actually be read, not only here:

| Part | Status | Claim allowed |
|---|---|---|
| Article + FAQPage JSON-LD | Evidenced | Google-consumed structured data |
| Author entity + disclaimer | Evidenced | required by ADR-1111's E3 application |
| Sitemap auto-update on merge | Evidenced | standard discovery |
| **IndexNow ping** | **Hedge** | faster crawl on Bing/Yandex/Seznam/Naver. **Reaches no Google surface.** Never described as helping the GSC feed it sits next to |
| **`llms.txt`** | **Hedge** | a free option on future AI-crawler adoption. **Google states it has no effect**, and no measured consumption exists today |

Neither hedge may appear in any exit criterion, any REQ acceptance line, or any retro as a reason
a metric moved.

**Amendment, same day — the IndexNow ping is CUT, not shipped.** The attack panel turned this ADR's
own sentence back on it: a part whose table row concedes that *no exit criterion anywhere may depend
on its effect* is not a hedge, it is carrying cost — a key file, an HTTP call, a fixture and a
dependency row, in a cycle with ten articles and no crawl-budget pressure. It is cut here rather
than in a later tidy-up, and reopens on ADR-1108's ~800-URL trigger, when crawl budget starts to
mean something. **`llms.txt` stays**: it is a generated static file with no network call, no
credential and no dependency row, so its carrying cost is genuinely near zero and the free option on
future adoption is worth holding.

**Evidence:** [IndexNow documentation](https://www.indexnow.org/documentation) (spec, participating
engines) · [Google's guide to optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
(`llms.txt` explicitly no-effect for Google Search, clarified June 2026) · [llmstxt.org](https://llmstxt.org)
(the format) · third-party 500M-visit crawler study (~408 `/llms.txt` fetches) · `CONSTITUTION.md:26`
(E3).
**Confidence:** high on Google's non-support of IndexNow and on its `llms.txt` disclaimer — both
from primary Google or primary spec sources. Medium on the adoption percentages, which come from
third-party measurement not independently re-verified.
**Rejected because:** option 2 discards two nearly-free options; option 3 reports inert files as
mechanisms.

## Consequences

Easier: when the feed shows nothing in week three, nobody spends a day debugging the IndexNow ping,
because it was never claimed to affect the measured surface. Harder: the "GEO" label from the
design source does not survive intact — it is split into evidenced parts and hedges, and the
`PLAN.md` REQ row says so.
