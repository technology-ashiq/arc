# BRIEF — growth v1 (content/SEO engine + video pipeline)

> **Trigger (pull):** a venture is LIVE and needs traffic. **Prereqs:** spine (events,
> reader, inbox) · a venture with a real site. This is a kickoff brief: enough to start
> `/arc-kickoff` without confusion; the kickoff fills current-state deltas at that time.

**Goal:** one command per channel — `/arc-content <site>` (SEO articles from real keyword/
complaint data, publish via git/CMS) and `/arc-video <topic>` (script → TTS → assemble →
upload draft) — every piece a `content.published` event, every batch through the inbox
until the L2 promotion evidence exists (20 unedited approvals).

**REQs (measurable):**
1. Keyword list mined from real sources (complaints, search suggest) with evidence links —
   no invented keywords; 10 articles produced against it, each schema-valid (title/meta/
   headings/internal links) and published to a real site.
2. Every publish = spine event with URL + venture; batch approval flow works via inbox
   (drafts → approve-all/review-each), decisions recorded.
3. Video pipeline produces one complete short (script → TTS voice → assembled render →
   platform-ready file + title/desc) with zero manual editing steps; upload stays DRAFT
   until human approve (L1) — publish automation is a later promotion.
4. A/B slot exists: two title templates tagged in events (evolve consumes later) — no
   self-optimizing logic yet.
5. Content quality gate: a lint (WARN-first) rejects slop markers — no em-dash spam,
   no "in today's fast-paced world", citation link for every claim-of-fact.

**Appetite:** 1 week (content) + 0.5 week (video) — separable; video cuttable.
**Phases sketch:** 0 keyword miner + article generator + quality lint (adversarial pass on
the lint) → 1 publish path + inbox batches + events → 2 video pipeline (one short, draft
upload) → 3 real week: 10 articles + 1 video live on the venture, retro.

**Non-negotiables/no-gos:** publish under human approval until trial-ledger promotes ·
no engagement-bait or fake claims (Constitution E3) · platform ToS respected (official
upload APIs only) · no paid ads · no multi-site v1 · reader-only spine access · Higgsfield/
TTS providers behind an interface (swappable).

**Pre-mortem top-3:** (1) slop content damages the domain → quality lint + human gate +
E3; (2) video pipeline eats the appetite → it's the designated cut; (3) publishing
platform API friction → git-based site first (full control), CMS later.

**Open decisions at kickoff:** which venture/site · TTS+render provider (interface first)
· article cadence target.

**Kickoff prompt:**
```
/arc-kickoff growth v1 — content engine (+video if appetite holds)
Design source: docs/strategy/plans/BRIEF-growth.md (trigger: <venture> is live and needs
traffic). Expand this brief into a full PLAN per kickoff rules; REQs/no-gos are locked;
fill current-state from the repo + venture. STOP after PLAN + specs for my approval.
```
