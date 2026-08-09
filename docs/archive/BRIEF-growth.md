# BRIEF — growth v1 (content/SEO engine + video pipeline)

> **Trigger (pull):** a venture is LIVE and needs traffic. **Prereqs:** spine (events,
> reader, inbox) · a venture with a real site. This is a kickoff brief: enough to start
> `/arc-kickoff` without confusion; the kickoff fills current-state deltas at that time.
> **v1.1 (2026-07-25):** + lifecycle-email scope (REQ-6) · + brand-kit one-shot (REQ-7) —
> from `../arc-company-org-blueprint.md` §6 (roles #27/#33/#46), approved docs-only.

**Goal:** one command per channel — `/arc-content <site>` (SEO articles from real keyword/
complaint data, publish via git/CMS) and `/arc-video <topic>` (script → TTS → assemble →
upload draft) — every piece a `content.published` event, every batch through the inbox
until the L2 promotion evidence exists (20 unedited approvals). v1.1 adds the same
inbox-gated discipline to **venture lifecycle emails** (welcome → activation → win-back)
and a **one-shot brand kit** (logo/OG/palette/social templates) per venture.

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
6. Lifecycle emails: three sequences (welcome · activation · win-back), ≤3 mails each,
   generated from venture facts + real product screens; **signed-up users only**; every
   send inbox-approved (L1); caps in code (≤1 mail/user/day, sequence auto-stops on
   reply/unsubscribe, unsubscribe honored instantly) — cap bypass fixture-proven
   impossible; every send an event.
7. Brand kit: one command produces a venture's logo options, OG image, palette, and
   social card templates; human picks/approves; chosen assets versioned in the venture
   repo; regeneration never silently replaces an approved asset.

**Appetite:** 1 week (content) + 0.5 week (video) + 0.5 week (lifecycle) — separable;
video and lifecycle are the designated cuts, in that order; brand-kit rides inside the
content week.
**Phases sketch:** 0 keyword miner + article generator + quality lint (adversarial pass on
the lint) → 1 publish path + inbox batches + events (+ brand-kit one-shot) → 2 video
pipeline (one short, draft upload) → 2.5 lifecycle sequences + caps (adversarial pass on
cap enforcement) → 3 real week: 10 articles + 1 video + welcome sequence live on the
venture, retro.

**Non-negotiables/no-gos:** publish under human approval until trial-ledger promotes ·
no engagement-bait or fake claims (Constitution E3) · platform ToS respected (official
upload APIs only) · no paid ads · no multi-site v1 · reader-only spine access · Higgsfield/
TTS providers behind an interface (swappable) · **no cold email anywhere in this module —
lifecycle mails go to signed-up users only; cold outreach lives in leads v1 with its own
caps** · email provider behind an interface; SPF/DKIM/DMARC green before send #1.

**Pre-mortem top-3:** (1) slop content damages the domain → quality lint + human gate +
E3; (2) video pipeline eats the appetite → it's the designated cut (lifecycle is cut #2);
(3) publishing platform API friction → git-based site first (full control), CMS later.

**Open decisions at kickoff:** which venture/site · TTS+render provider (interface first)
· article cadence target · transactional-email provider + sending domain (shared with
leads v1 decision or separate — decide once, ADR it).

**Kickoff prompt:**
```
/arc-kickoff growth v1 — content engine (+video +lifecycle if appetite holds)
Design source: docs/strategy/plans/BRIEF-growth.md (trigger: <venture> is live and needs
traffic). Expand this brief into a full PLAN per kickoff rules; REQs/no-gos are locked;
fill current-state from the repo + venture. STOP after PLAN + specs for my approval.
```
