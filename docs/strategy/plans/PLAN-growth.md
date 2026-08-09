# PLAN (design source) — growth v1: the content engine + evolve's first feed

> **v1.0 (2026-08-09).** Expanded from `BRIEF-growth.md` v1.1 through three owner-review
> rounds (2026-08-03: repo-grounded analysis → 9-lens ideation → efficiency/thinking/
> creativity audit) and re-grounded against the working tree of 2026-08-09 before
> landing; **owner-approved drop 2026-08-09.** Supersedes the brief as design source —
> `BRIEF-growth.md` moved to `docs/archive/` (never deleted; marked in the strategy
> file map).
>
> **Trigger: CONVERTED — FIRED under the owner's Build-out Mandate (2026-08-09).**
> Arc build-out is the priority; ventures are deprioritized; no trigger-waiting
> (strategy-README correction #15's `decision.recorded` — the SAME receipt every
> build-out kickoff cites; if it is not yet on the spine when this cycle starts first,
> Phase 0 records it — the PLAN-executor pattern. A8's letter kept: the mandate IS the
> pull, on the record). Honesty note: no live-venture "needs traffic" receipt exists
> and none is invented — the arc public site is the first client, built via the
> Pre-kickoff gate below. **A venture site (LexOS or any) becomes a config-level
> activation later, not a redesign — Appendix A.**

## Goal

One command per channel on ONE site: `/arc-content` mines **real keyword evidence**, a
human approves the **cluster plan**, the machine writes **exemplar-anchored articles
with an original-POV floor**, every publish is a **git PR only a human merges** (L1),
every piece a `content.published` receipt carrying its **title-template tag**, and a
**weekly Search-Console ingest** turns outcomes into `metric.observed` receipts to
PLAN-evolve's frozen spec — so growth is simultaneously **arc's traffic engine** and
**the feed that wakes the already-built evolve module**. Brand kit rides inside the
content core; video and lifecycle exist as machinery behind explicit cuts.

## Current state (verified 2026-08-09 — re-verify at kickoff)

- Spine LIVE. **KINDS = 44** (ADR-0026 closed set, extended only by ADR — 0106/0107,
  0309/0310, 0400, 0508 precedents; state counts against live `KINDS.length` at
  kickoff, the ADR-0107 derived-count rule). **No `content.*` or `email.*` kind
  exists** — "every publish = spine event" still needs REQ-00's vocabulary ADR.
- **`metric.observed` is ALREADY LAW — ADR-0408 (leads' cycle, 2026-08-04):** leads
  took EVO-H0's *vocabulary* half as evolve's first client ("vocabulary, not its
  clock" — its campaign is parked, so no ongoing feed exists). **Growth ships the
  FEED half** (REQ-05): verify the landed validator against PLAN-evolve REQ-00's
  frozen spec, then build the ingest whose 4 complete weeks fire evolve's trigger.
- **Evolve module BUILT** (C7 closed 2026-08-04, PR #108, ADRs 0300–0310 —
  fixture-proven, **unexercised**). Growth's feed is what exercises it; the runway
  clock starts at growth's first COMPLETE metric window.
- **Constitution ADOPTED v1.0 (2026-08-06)** — receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`,
  sha-pinned, at repo root. A6 (human merge), A8 (earn before build — satisfied here
  by the mandate receipt), A9 (live slot), E3 (no fake claims) are LAW, not draft.
- **Policy engine MERGED** (C9, `677b67e` / PR #130, 2026-08-08): **POL-I birth
  rule — new action kinds land their `hq.policy.yaml` rows in the same change.**
  REQ-00 carries this.
- **Lanes are law** (ADR-0054); century bands per `PORTFOLIO.md`: 0300 evolve · 0400
  leads · 0500 policy · **growth claims the NEXT FREE century at kickoff** (0600s as
  of this writing — never hardcode; the absorb-plan lesson).
- **Live slots (A9), as of this writing:** leads C8 (Phase 03 blocked on the
  `_dmarc.automemory.ai` TXT record; Phase 05 campaign PARKED) · policy C9 (Phase 04
  open on 3 owner `settings.json` edits). Verify a slot is free at kickoff.
- **`automemory.ai` exists and is arc's warmed, DKIM-aligned sending domain** (leads
  C8, 9/9 delivered). It is the natural candidate for the public site domain — gate
  row 3 decides; the site route + GSC property do NOT exist yet.
- C6 develop + engine both merged (PR #100 / #103). Engine's `arc-run`, `--budget
  inr=`, `router.yaml` available — **optional here** (engine REQ-08 stands PARTIAL;
  growth takes no hard dependency). Model-policy (C5, MP-A..F): generation runs ride
  seat tiers; every batch emits `cost.incurred` with source discipline. C3 design
  review gate available for visual assets.
- `.claude/skills/seo-article-writer` exists (v0) — **upgraded, never rebuilt**.
- Inbox live: `arc-inbox approve|reject <ULID> --reason` (reason mandatory, decisions
  final). `supersedes` on every event — corrections never overwrite.
- **C2 retro lesson standing:** an idem preimage carries every identity-bearing field
  (~100 receipts once lost silently). Every idem formula below is total-preimage.
- Cross-plan, no dependency: PLAN-executor's scrubbed transcripts + verdict receipts
  are named future evidence for growth's later cycles (its file, correction #15).

## Pre-kickoff gate (nothing below builds until ALL rows are true)

| # | Item | Evidence required |
|---|---|---|
| 1 | Build-out Mandate receipt cited | The correction-#15 `decision.recorded` linked in the kickoff prompt — or, if no earlier build-out kickoff has recorded it yet, this cycle's Phase 0 records it (PLAN-executor pattern). The kickoff ADRs cite it |
| 2 | Live slot free (A9) | `PORTFOLIO.md` checked at kickoff (as of this writing: leads C8 DNS row · policy C9 settings edits are the open LIVE items) |
| 3 | Arc public domain chosen + live | DNS + TLS green; **GSC property verified** (the metric feed depends on it). Candidate: `automemory.ai` — already arc's warmed sending domain |
| 4 | Site skeleton with a content route | Site repo + stack decided; `/blog` (MDX or equivalent) renders a test page via PR + preview deploy |
| 5 | Exemplar articles picked | 2–3 Ashiq-approved sample articles (the voice anchor) placed in the lane |
| 6 | Keyword sources named | The real-source mining list (communities, search suggest, competitor gaps) with access confirmed — no invented keywords, ever |

## Success requirements

| REQ | User outcome | Measurable acceptance | Brief | Phase |
|---|---|---|---|---|
| REQ-00 | Publishing exists on the spine at all | Vocabulary ADR (this lane's century): `content.published`, closed payload (schema below) via the standard emitter, validated in the `assertDecision`/`assertMoney` pattern. **Idem = total preimage** `sha256("content.published\|site\|slug\|content_sha")` — same-content re-publish idempotent (fixture); changed content = NEW receipt linked by `supersedes`, never overwrite (fixture). Unknown payload field → exit 2 (fixture). `email.sent` is added ONLY if the lifecycle slot is picked (GRO-A). **`hq.policy.yaml` rows for the new action kinds land in the same change (POL-I; policy C9 merged 2026-08-08)** | R2 | 0 |
| REQ-01 | Targets are real and human-chosen | Miner emits evidence-linked candidates (source URL per keyword · competitor-gap column · own-pages exclusion list); output = **ONE inbox item**; the human approves a **cluster plan** (1 pillar + ≥5 spokes + 2–3 BOFU pages) **BEFORE any generation runs**. Candidate without an evidence link = structurally rejected (lint fixture) | R1 | 1 |
| REQ-02 | Articles are good, not just compliant | Exemplar-anchored drafting (gate row 5 anchors voice — no style rules in prompts beyond them) · **POV floor:** every article carries ≥1 original practitioner insight/stance (human-checked at review; the review pack asks) · **slop-lint NEGATIVE-ONLY** (versioned marker list; catches bad patterns, never prescribes style — GRO-G) · **citation lint:** every claim-of-fact carries a source link AND the link resolves (dead link = WARN). **Adversarial pass on both lints before any FAIL promotion** (parser-class rule) | R1,R5 | 2 |
| REQ-03 | Publish = PR; humans hold the merge | Draft → content PR (machine writes the branch, **NEVER merges/pushes default — A6, enforced in the command, fixture-proven**) → **review pack**: ONE inbox item bundling preview-deploy URL + lint report + citation report + diff (target ≤5 min/article) → approve (`decision.recorded` carrying draft `content_sha`) → human merge → `content.published` with the sha read from the merged tree. **Unedited := approved draft_sha == published content_sha** (GRO-E). Slug re-publish = update, not duplicate (fixture). **GEO baked into the template:** Article+FAQPage JSON-LD · author entity · info-not-advice disclaimer · `llms.txt` · sitemap auto-update + IndexNow ping on merge | R2 | 3 |
| REQ-04 | A/B slot exists, dumb on purpose | Exactly **2 title templates as VERSIONED FILES** in the lane (evolve seals `base_sha` later); every publish tagged `template_id` in the payload (the `+variant` process grammar stays evolve's EVO-C); **assignment = deterministic `hash(slug) → template`** — no human cherry-pick, no optimization logic of any kind (fixtures: tag present both arms; missing tag rejected; assignment replay-identical) | R4 | 3 |
| REQ-05 | **The EVO-H0 FEED — what wakes evolve** | The vocabulary half is DONE (ADR-0408, leads' cycle). Growth: **(a) VERIFY** the landed `metric.observed` validator against PLAN-evolve REQ-00's frozen spec — payload keys, total-preimage idem with literal `-` absents, `source_id` grammar (`[A-Za-z0-9][A-Za-z0-9._-]{0,63}` or `h-<sha256-hex16>`; raw URLs/PII never land) — **deviations flagged back to PLAN-evolve, never absorbed silently**; **(b) BUILD the feed**: `arc growth ingest <gsc-csv>` (the manual weekly ritual; analytics-API fetchers remain a later pull per EVO-B) · slug↔URL join from `content.published` · ISO-week windows · **≥3-day GSC-lag rule** (early ingest refused — fixture) · **window COMPLETE only after strict idempotent emission — failed/pending = MISSING, never zero** (fixture) · re-ingest idempotent (fixture) · corrections via `supersedes` (fixture) · growth's surfaces registered (`growth.title-template` — EVO-G's named first surface); **(c)** 4 complete consecutive weeks of this feed = evolve's trigger — the module is BUILT (C7) and waits on exactly this | new | 4 |
| REQ-06 | The site looks like a company, once | Brand-kit one-shot for the arc site: logo options / OG image / palette / social-card templates → human picks via inbox → chosen assets versioned in the site repo → **regeneration never silently replaces an approved asset** (fixture). C3 design-review gate scores the visuals | R7 | 3 |
| REQ-07 | Video pipeline (STRETCH — cut #2) | One complete short (script → TTS → assembled render → platform-ready file + title/desc), zero manual editing steps; upload stays **DRAFT until human approve**; providers behind an interface (swappable) | R3 | 5* |
| REQ-08 | Lifecycle machinery (STRETCH — cut #1) | 3 sequences (welcome · activation · win-back), ≤3 mails each, **subscribers only**; caps IN CODE, fixture-proven unexceedable (≤1 mail/user/day · auto-stop on reply/unsub · instant unsubscribe); SPF/DKIM/DMARC green before send #1 (leads C8's domain machinery reused, never duplicated); every send an event. **Builds only if the slot is picked AND a real subscriber base exists — otherwise stays a note** | R6 | 5* |
| REQ-09 | A real week happened | ≥10 approved articles live as the cluster (drip 2–3/wk) · first `metric.observed` windows ingested · unedited-approval counter running toward the L2 evidence target (20) · retro. **Count honesty:** if quality gates force rework past appetite, ship cluster-complete (pillar + ≥5 spokes) and record the honest count — the quality floor outranks the number (owner ratifies at kickoff, GRO-I) | R1,R2 | 6 |

## Payload schemas (frozen here; ADR'd at kickoff via GRO-A)

**`content.published`** (closed; unknown field = exit 2):

```json
{
  "site":        "<arc public domain>",
  "slug":        "receipts-driven-os",
  "url":         "https://…/blog/…",
  "title":       "…",
  "template_id": "title-a",
  "cluster_id":  "c-001",
  "content_sha": "<sha256 of published MDX>",
  "pr_ref":      "#12"
}
```
idem = `sha256("content.published|site|slug|content_sha")`.

**`metric.observed`** — ALREADY LAW (ADR-0408). Growth emits to the landed validator;
the shape below restates PLAN-evolve REQ-00 for reference, and REQ-05(a) verifies the
two match:

```json
{
  "module": "growth", "surface": "growth.title-template",
  "variant": "-", "cohort": "-",
  "metric": "ctr", "value": 0.031, "unit_count": 129,
  "window_start": "2026-W36", "window_end": "2026-W36",
  "source_id": "gsc-2026-W36"
}
```
Integer basis: clicks (successes) / impressions (trials) per evolve's
integer-proportion family. One receipt per URL-group per metric per ISO week.
Growth emits `metric.observed` ONLY — `experiment.*` stays evolve's stream (the
stream contract; the board never double-counts).

## Appetite — 2 weeks (10d) hard cap

| Block | Days | Content |
|---|---|---|
| Content core | 5d | P0 contract 1d · P1 miner + cluster gate 1d · P2 generator + lints 1.5d · P3 publish path + A/B + brand kit + GEO 1.5d |
| **EVO-H0 feed** | 1.5d | P4 — **explicit line, never hidden inside the content core** (the vocabulary half is pre-landed; this pays for verify + ingest + windows + join) |
| Stretch slot | 1.5d | P5 — **ONE of:** video (REQ-07) \| WA-share cards \| lifecycle (REQ-08, only if audience exists). Picked by real state at P4 close, recorded (GRO-K) |
| Real week | 2d effort / ≥7d elapsed | P6 — drip publishing + weekly ingest + retro (overlaps P4–P5 calendar) |

**Cut order (FLIPPED vs brief, on the record):** lifecycle = cut #1 (subscriber base
≈ 0 today) · video = cut #2 · the stretch slot itself = cut #3. The cycle still closes
whole on content + feed — the cuts can never remove the point of the cycle.
**Kill criteria:** 50% burnt without one content PR mergeable end-to-end (P3 exit) →
the publish path is fighting the site: bank the vocabulary ADRs + miner as docs, stop,
retro. Lints not fixture-deterministic after 1 day of fixes → redesign the lint;
never ship a gate that can be argued with.
**Cascade rule:** gate rows 3–4 not TRUE at kickoff → the schedule was misread — STOP
at kickoff-lint. Never build ahead of the site.

## Decisions to ADR at kickoff (GRO-A..L, this lane's century per `PORTFOLIO.md`)

| ID | Decision |
|---|---|
| GRO-A | Vocabulary ADR: `content.published` (+`email.sent` ONLY if the lifecycle slot opens). Closed payloads (schemas above), total-preimage idems, fixtures per kind, stated against live `KINDS.length` (ADR-0107 rule; precedents 0106/0107 · 0309/0310 · 0400). **`hq.policy.yaml` rows for the new action kinds in the same change (POL-I)** |
| GRO-B | Publish = git-PR-only; the machine may never merge or push a default branch — enforcement in the command itself, fixture-proven (A6 for content) |
| GRO-C | Providers behind interfaces: TTS/render (if video) · email (if lifecycle — reuse leads C8's domain machinery + vendor path; sending domain rows shared, never duplicated) — decide once, on the record |
| GRO-D | Title templates = versioned files; payload-level `template_id`; deterministic `hash(slug)` assignment (evolve-forward-compatible; EVO-C grammar stays evolve's) |
| GRO-E | **Unedited** := approved draft_sha == published content_sha. L2 evidence = 20 such approvals (edited approvals neither count nor reset). Promotion via trial-ledger + owner sign-off, never automatic |
| GRO-F | Metric ingestion: GSC CSV · ISO weeks · ≥3-day lag rule · `source_id` value grammar (`gsc-<iso-week>`) — all to the ADR-0408 validator, verified against PLAN-evolve REQ-00 |
| GRO-G | **Lint constitution: NEGATIVE-ONLY, forever.** Lints catch bad patterns (versioned marker lists); they never prescribe style, structure, or length. Adding a prescriptive rule requires its own ADR with the creativity cost argued |
| GRO-H | Placement: `initiatives/growth/` lane (NEW — claims the next free ADR century per `PORTFOLIO.md`) + `products/growth` + the seo-article-writer skill upgrade · `venture` field value for arc-site events (e.g. `arc`) |
| GRO-I | Content policy: pillar-spoke cluster + 2–3 BOFU mix · POV floor wording · E3 no-fake-claims · disclaimer text · count-honesty clause ratified |
| GRO-J | **Human-gate cap: exactly 2** (keyword/cluster approval · per-article review-pack approval). Adding a third human gate requires an ADR |
| GRO-K | Stretch-slot selection at P4 close by real state (audience exists? video worth it? cards?) — recorded as `decision.recorded` |
| GRO-L | The kickoff ADRs cite the Build-out Mandate receipt (gate row 1); council 002's outcome is recorded when its Review-by arrives |

## Non-negotiables

- **A6 for content:** the machine writes branches and drafts; a human merges every
  publish, every asset swap, every template change. No exceptions.
- **Exactly two human gates** (GRO-J) — friction is capped by design.
- **Lints are negative-only** (GRO-G) — compliance-shaped slop is still slop.
- **Constitution E3 (adopted law):** no engagement-bait, no fake claims, citation for
  every claim-of-fact.
- Platform ToS respected — official APIs only; **no cold email anywhere in this
  module** (outbound lives in leads with its own caps and PII law); no paid ads.
- Providers behind interfaces; reader-only spine access; standard emitter for every
  receipt; real vs simulated never mixed.
- **Fixture-proven ≠ live-validated** — the tracker records which one each REQ closed
  as (C6 engine REQ-08 precedent: partial is written down, never waived).
- Total-preimage idems everywhere · MISSING ≠ zero · corrections supersede, never
  overwrite · no raw URLs/PII on the spine (the leads PII law respected at the
  vocabulary layer).

## No-gos

No multi-site v1 · no auto-publish before the L2 evidence exists · **no open-rate
tracking** (Apple MPP makes opens fiction — clicks/replies only) · no social
schedulers (the scheduler module owns cadence later; PLAN-scheduler exists and is not
this) · no AI-Overview rank-tool chasing · no invented keywords · no
style-prescriptive lint · no prompt-tuning loops (exemplars are the only style input)
· no analytics-API fetchers v1 · no dashboard pixels (CLI/brief lines; the dashboard
module owns pixels later) · no `experiment.*` emission (evolve's stream) · no
redefinition of `metric.observed` (ADR-0408 is law — verify, extend by ADR only if a
real gap is proven) · no machine merge or default-branch push, anywhere, ever.

## Rabbit holes (named so kickoff-lint can guard them)

Interactive tool pages/calculators (high value, wrong cycle — later pull: "first 100
organic clicks") · Hindi/Tamil content (legal/translation quality gate needed first) ·
content refresh/decay proposals (evolve-adjacent, later) · per-article model-choice
experiments (bench/evolve territory) · rebuilding brand tooling (C3 exists — reuse) ·
rebuilding mail/domain machinery (leads C8 owns it — reuse) · metric-taxonomy
perfection (CTR + clicks are enough to start) · chasing the 10-count at the cost of
the quality floor.

## Fixture manifest (must-have, adversarial-pass scoped)

**Vocabulary/receipts:** unknown kind pre-ADR rejected · unknown payload field exit 2
· same-content re-publish → one receipt (idempotent) · changed content → `supersedes`
chain, overwrite impossible · URL-shaped `source_id` rejected, `h-` form accepted
(against the LIVE ADR-0408 validator).
**Lints:** every versioned slop marker caught · a marker-free-but-slop sample passes
lint and is caught by the human gate (documents the lint's honest limits) · claim
without link → WARN · dead link → WARN · clean article green.
**Publish:** re-publish same slug = update, no duplicate page · direct-push attempt
refused by the command · unedited counter: sha-equal increments, sha-diff does not ·
review pack contains preview URL (item malformed without it).
**A/B:** both templates produce tagged receipts · missing tag rejected ·
`hash(slug)` assignment identical across replay.
**Metrics (mirrors PLAN-evolve's manifest):** failed/pending ingest → window MISSING,
never zero · re-ingest idempotent · pre-lag ingest refused · correction via
`supersedes` lands · spec-verify diff vs PLAN-evolve REQ-00 = empty or flagged.
**Lifecycle (only if built):** cap unexceedable even when explicitly asked · instant
unsubscribe honored · non-subscriber send structurally impossible.

## Pre-mortem (top 8)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Slop content damages the domain | Two human gates + POV floor + E3 + citation lint + drip cadence |
| 2 | Review fatigue → rubber-stamping | Gate cap (2) + ≤5-min review packs + 2–3/wk drip + approve-all is EARNED, not default |
| 3 | Stretch work eats the core | Explicit slot design + flipped cut order + the slot itself is cut #3 |
| 4 | Publish-path friction (site/stack fights back) | Git-first design + preview deploys + the 50%-burn kill criterion |
| 5 | Metric feed gaps poison evolve's trigger | The REQ-05 rules (MISSING ≠ zero, lag rule, idempotent re-ingest) + the weekly ritual lives in the operating rhythm |
| 6 | Lint-shaped sterile content | POV floor + exemplar anchoring + GRO-G negative-only constitution |
| 7 | Search engines re-price AI content | Human review + original POV + 10-not-100 volume + drip — quality signals over scale |
| 8 | Site skeleton not actually ready | Cascade rule: STOP at kickoff-lint; gate rows 3–4 are evidence, not intentions |

## Phases

| Phase | Scope | Exit evidence | Appetite |
|---|---|---|---|
| 0 — Contract | Vocabulary ADR + receipt validators + idem formulas + `hq.policy.yaml` rows (POL-I) · mandate receipt (gate row 1, if first) · lane/product scaffold · lint skeletons | Hostile vocab/receipt fixtures exit correctly | 1d |
| 1 — Miner + cluster gate | Evidence-linked miner (+gap column, exclusion list) · cluster-plan inbox item · REQ-01 lint | Fixture keyword set → one approvable item; evidence-less candidate rejected | 1d |
| 2 — Generator + lints | Exemplar-anchored generation · slop-lint + citation lint · **adversarial pass on both** | Lint fixtures green; adversarial report committed | 1.5d |
| 3 — Publish path | Content-PR flow + review pack + `content.published` + A/B tagging + brand kit + GEO template | One article end-to-end on the real site with full receipt chain · REQ-03/04/06 fixtures green | 1.5d |
| 4 — **EVO-H0 feed** | ADR-0408 spec-verify vs PLAN-evolve REQ-00 · `arc growth ingest` + window rules + join + fixtures | Evolve-spec fixture set green · first real CSV ingested or honestly MISSING · deviation log empty or flagged back | 1.5d |
| 5 — Stretch slot | ONE of video / WA-cards / lifecycle per GRO-K — **or banked as the cut** | Slot's own fixtures green, or the cut recorded | 1.5d |
| 6 — Real week | Drip 10 articles (cluster) · weekly ingest · unedited counter · retro | REQ-09 evidence bundle · retro run · honest counts stated | 2d / ≥7d elapsed |

## Phase specs (worked out)

### phase-00-spec — Contract (1d)
**Objective:** publishing exists as law before any content exists.
- GRO-A vocabulary ADR text (`content.published`; schema above; idem formula) ready
  for numbering from this lane's century; stated against live `KINDS.length`.
- Validator extension in the `assertDecision`/`assertMoney` pattern:
  `assertContent` — closed key set, exit-2 on unknown fields.
- **`hq.policy.yaml` rows for the new action kinds in the same change (POL-I).**
- Build-out Mandate receipt recorded/cited (gate row 1).
- Lane scaffold `initiatives/growth/` + `products/growth` manifest (product-lint
  green); seo-article-writer marked for upgrade, not replacement.
- Lint skeletons: slop marker list v1 (versioned file) + citation-checker stub.
- Hostile fixture corpus started: unknown kind pre-ADR · unknown payload field ·
  dup content idem · CRLF/oversize (inherit C2 corpus shapes).
**DoD:** all vocabulary fixtures green · product-lint passes the new manifest ·
ADR texts staged. **Out of scope:** any generation, any site touch.

### phase-01-spec — Miner + cluster gate (1d)
**Objective:** targets are evidence, chosen by a human.
- `arc growth mine` reads the gate-row-6 sources → candidates JSONL
  `{keyword, evidence_url, intent, gap_note}`; own-pages exclusion via the site
  sitemap; competitor-gap column filled from real SERP evidence.
- Cluster-plan builder → **ONE inbox item**: proposed pillar + spokes + BOFU pages,
  every row evidence-linked.
- REQ-01 lint: a candidate without an evidence link cannot enter the proposal.
**DoD:** fixture source-set produces one approvable item · evidence-less candidate
rejected (fixture) · one REAL mining run produces a real cluster proposal for the arc
site. **Out of scope:** article text.

### phase-02-spec — Generator + lints (1.5d)
**Objective:** drafts worth a human's five minutes.
- seo-article-writer upgrade: exemplar-anchored prompt assembly (gate row 5 files are
  the ONLY style input) · MDX output with frontmatter
  `{title, meta, slug, cluster_id, template_id, citations[]}` · internal-link plan
  from the approved cluster.
- slop-lint v1 (negative-only, versioned markers) · citation lint (claim tagging +
  link-alive check) · POV floor wired as a review-pack checklist line (human-judged,
  never regex).
- **Adversarial pass on both lints** (construct-a-breaking-input; holes fixed +
  pinned before phase close).
**DoD:** lint fixtures green including the honest-limit fixture (marker-free slop
passes lint, is caught at the human gate — the lint's limits documented, not hidden) ·
2 sample drafts generated from the fixture cluster · adversarial report committed.
**Out of scope:** publishing.

### phase-03-spec — Publish path + A/B + brand kit (1.5d)
**Objective:** PR-only publishing with a 5-minute human loop; the site gets its face.
- `arc growth publish <slug>`: branch + PR + preview-URL capture → **review pack**
  (ONE inbox item: preview URL · lint report · citation report · diff · POV checklist
  line). Malformed pack (missing preview URL) = invalid item (fixture).
- Approve → `decision.recorded` carries draft `content_sha` → **human merges** →
  `content.published` emitted with the sha read from the merged tree.
  Direct-push attempt = refused by the command (fixture).
- `hash(slug) → template` assignment; both templates as versioned files.
- GEO template parts: Article+FAQPage JSON-LD · author page + schema · disclaimer
  footer · `llms.txt` · sitemap auto-update + IndexNow ping on merge.
- Brand-kit one-shot: logo options / OG / palette / social-card templates → C3
  design-review scores → human picks via inbox → assets versioned;
  approved-asset overwrite impossible (fixture).
**DoD:** ONE real article end-to-end on the live site with the full receipt chain ·
REQ-03/04/06 fixtures green. **Out of scope:** metrics.

### phase-04-spec — EVO-H0 feed (1.5d)
**Objective:** the feed that wakes evolve — to spec, honest about gaps.
- **Spec-verify:** the live ADR-0408 `metric.observed` validator diffed against
  PLAN-evolve REQ-00's frozen spec (payload keys, idem preimage, `-` absents,
  `source_id` grammar). Deviation → flagged back to PLAN-evolve, never absorbed.
- `arc growth ingest <gsc-csv>`: per-URL clicks/impressions → ISO-week receipts
  (slug↔URL join from `content.published`); window state machine COMPLETE/MISSING;
  **≥3-day lag rule** (early ingest refused); re-ingest idempotent; corrections via
  `supersedes`; surface `growth.title-template` registered (EVO-G's named surface).
- Feed status lines in `arc brief` (feed age · windows complete/missing) — text,
  no pixels.
**DoD:** the evolve-spec fixture set green (mirrors PLAN-evolve's manifest) · first
real CSV ingested OR the window honestly MISSING with a loud state · deviation log
empty or flagged. **Out of scope:** any `experiment.*` emission, any verdict math,
any backfill.

### phase-05-spec — Stretch slot (1.5d, THE DESIGNATED CUT)
**Objective:** one optional wing, chosen by reality at P4 close (GRO-K).
- **Video:** script → TTS → assemble → platform-ready file; upload DRAFT-only;
  providers behind an interface. · **WA-cards:** per-article branded share card from
  the brand kit; bundled into the article's review pack. · **Lifecycle:** ONLY if a
  subscriber base exists — caps-in-code first, DNS auth green before send #1 (reuse
  leads C8's domain machinery).
**DoD:** the picked wing's fixtures green + one real artifact produced (draft video /
card set / staged sequence) — **or the cut recorded with reason** (`decision.recorded`).

### phase-06-spec — Real week (2d effort / ≥7 elapsed days)
**Objective:** honest operation, not a demo.
- Drip-publish the cluster 2–3/wk through review packs · weekly ingest ritual ·
  unedited-approval counter accumulating · `/arc-retro` at close (+ stat line +
  HISTORY entry per the wiring rule).
**DoD:** REQ-09 evidence bundle — receipt chains for the honest article count ·
≥1 COMPLETE metric window (or MISSING states shown loudly) · retro run · L2 evidence
counter state recorded.

## Operating rhythm (post-cycle, absorbed into the daily/weekly ritual)

- **Weekly (~25 min):** Monday `arc growth ingest` (10 min) · 2–3 review-pack
  approvals across the week (~5 min each).
- **Monthly (15 min):** content-strategy retro — board data in, NEXT cluster chosen
  by the human. The machine never picks strategy; evolve later optimizes only within
  one (GRO-G spirit at the strategy level).
- The unedited counter and feed age appear in `arc brief` — no new surfaces.
- **Four complete weeks in, evolve's trigger is honestly fireable** — its kickoff
  prompt (PLAN-evolve, bottom) names growth as the evidenced client.

## North-star

By cycle close the arc site carries one honest, linked, human-approved content
cluster with full provenance — every article traceable keyword-evidence → approved
cluster → exemplar-anchored draft → review-pack approval → human merge →
`content.published` with its template tag — and a weekly `metric.observed` feed is
aging toward the trigger of an evolve module that is ALREADY BUILT and waiting, with
**zero invented numbers, zero machine merges, and exactly two human gates.** Growth
is then three things at once: arc's traffic engine, arc's public proof that "content
ops with receipts" is real, and the hand that winds evolve's alarm clock.

## Changes vs BRIEF (deviations, on the record)

1. **Trigger converted — FIRED under the owner's Build-out Mandate (2026-08-09)**;
   the correction-#15 receipt is the pull (A8's letter kept). The brief's
   live-venture trigger survives only as Appendix A per-site activation.
2. **First client = arc's own public site**, not a venture. (Raises brand-kit's
   value — arc has no brand kit; drops lifecycle's — no subscribers yet.)
3. **Cut order flipped:** lifecycle first cut (audience ≈ 0), video second — the
   brief's order assumed a live venture with users.
4. **REQ-05 added — the EVO-H0 FEED:** the vocabulary half landed in leads' cycle
   (ADR-0408) after the brief; growth verifies it and ships the feed that starts
   evolve's 4-week clock. Nothing in the brief built this path.
5. **A/B hardened for evolve:** templates = versioned files, deterministic
   `hash(slug)` assignment, payload-level tag (the brief only said "tagged").
6. **Creativity guards added:** POV floor, exemplar anchoring, GRO-G negative-only
   lint constitution, GRO-J two-gate cap.
7. **"10 articles" gains a count-honesty clause** (quality floor outranks the
   number) — owner ratifies at kickoff.
8. **`--lane growth` + the next-free century rule** (lanes and century bands
   post-date the brief).
9. **Appetite restructured:** explicit EVO-H0-feed line + state-picked stretch slot
   (C4's zero-slack lesson applied).
10. **"Unedited approval" made measurable:** sha equality (GRO-E).
11. **`hq.policy.yaml` rows ride the vocabulary change (POL-I)** — the policy engine
    (C9, merged 2026-08-08) post-dates the brief.

## Open decisions at kickoff

Arc domain confirm (candidate `automemory.ai`) + site stack/repo · `venture` field
value for arc-site events · cadence confirm (default 2–3/wk drip) · exemplar picks
(gate row 5) · stretch-slot choice (GRO-K) · count-floor ratification (GRO-I) ·
providers only if their slots open (GRO-C) · GRO-L citation check.

## Appendix A — venture activation (LexOS or any future site)

Same machinery, per-site config: gate rows 3–4 re-evidenced for that site's domain +
content route · keyword sources + exemplars swapped to that ICP · **BCI Rule 36
guardrail activates for legal-ICP content** (no advocate-advertising inducement; the
2025 crackdown's compliance question is itself a candidate pillar) · lifecycle arms
only with that site's real subscriber base · simultaneous multi-site stays v2, its
own ADR.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (ONLY after the Pre-kickoff gate is fully evidenced)

```
/arc-kickoff --lane growth growth v1 — content engine + the EVO-H0 metric feed
Design source: docs/strategy/plans/PLAN-growth.md (approved; pre-kickoff gate rows 1–6
evidenced — link the Build-out Mandate receipt, the live domain + GSC property, and the
rendered test page; confirm a live slot is free per PORTFOLIO.md). Read it fully.
Decisions GRO-A..L are locked; assign ADR numbers from the century this lane claims per
PORTFOLIO.md. REQ-00 adds content.published ONLY (metric.observed is already law —
ADR-0408); its hq.policy.yaml rows land in the same change (POL-I). REQ-05 first
VERIFIES the ADR-0408 validator against PLAN-evolve REQ-00's frozen spec — flag any
deviation back to that file, never absorb one silently — then builds the ingest whose
4 complete weeks fire evolve's trigger. Human gates = exactly 2; the machine never
merges; lints are negative-only; cut order = lifecycle → video → the slot itself.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```

---

*Provenance: BRIEF-growth.md v1.1 (2026-07-25) + owner-review rounds of 2026-08-03
(Ashiq + Claude) + a re-grounding pass against the working tree of 2026-08-09
(KINDS/validate.mjs at 44 kinds, PORTFOLIO.md century bands + live slots, ADR-0300..
0310 / 0400 / 0408 / 0500..0508, docs/HISTORY.md, PLAN-evolve.md, council session
002, the adopted CONSTITUTION.md). Approved by Ashiq as a docs-only drop (this file +
both index edits + the brief archived); git handled by the owner. Nothing in this
file changes code or gates by itself; implementation enters only through
`/arc-kickoff` → review → explicit approval.*
