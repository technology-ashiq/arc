# PLAN (design source) — legal pack: customer-facing policies per venture

> **Freeze log:** `BRIEF-legal-pack.md` (2026-07-25, org-blueprint role #51) →
> repo-grounded analysis 2026-08-03 (Razorpay six-page activation gate verified · the
> brief's MoR premise found wrong for a gateway-domestic client · DPDP Rules timeline
> verified) → 4-perspective adversarial panel same day (red-team 8 findings ·
> Indian-compliance practitioner 10 items with citations · YAGNI cost audit · architect
> topology/schema/determinism) → round-3 additions (scenario fixtures · text-level
> attack panel · approval-diff UX · integration handoff · designated cuts) → v1.0
> owner-approved in chat 2026-08-10 → **v1.1 landed 2026-08-10** with same-day currency
> edits only (trigger converted to FIRED per the Build-out Mandate wording of strategy
> corrections #15–19 · growth/ledger cross-refs updated to their landed plans · century
> expectation softened to the live-board rule; no decision content changed).
> **Decisions LEG-A..I locked; LEG-J open until kickoff; real ADR numbers at kickoff
> from the claimed century.** Drafted in a Cowork session (Ashiq + Claude) over three
> review rounds 2026-08-03 → 2026-08-10; landed in the tree on the owner's approval,
> uncommitted — the owner branches/commits/PRs; the sandbox never touches git. This
> drop also moves `BRIEF-legal-pack.md` to `docs/archive/` (evolve/leads/policy/absorb/
> executor/scheduler/ledger/growth/memory precedent) and updates both READMEs (plans
> ordering row + strategy file map/correction #20).
>
> **Scope honesty:** this cycle delivers the six-page template set (the CONTENT is the
> product), the render engine with three lints, the hash-chain receipt discipline, and
> one real venture render through the human gate. It is NOT legal advice (a template
> engine with receipts, not a lawyer), NOT a consent-management platform, NOT contracts/
> DPAs/IP work, NOT tax math, and NOT the venture-side UI integration (that ships as a
> handoff checklist the venture's own work consumes).
>
> **Trigger — CONVERTED, FIRED under the owner's Build-out Mandate (2026-08-09 — same
> `decision.recorded` as strategy-README correction #15, cited by the kickoff ADRs;
> A8's letter kept).** Honesty note: no venture launch-prep receipt exists and none is
> invented — the operational fact behind this module is EXTERNAL and verified (Razorpay
> withholds live-mode API keys until six policy pages exist on the merchant site), so
> the machinery is built now and the original pull ("first venture reaches launch prep
> — policies before real payments") survives as the live-value milestone: REQ-08's
> live-deploy + production-probe rows stay OPEN-at-venture-resume (closure = the C2
> REQ-07 pattern: mechanism proven, live value pending). arc's own future public site
> (PLAN-growth's arc-first client) is this module's second render target — arc the
> product needs its own policy pages too. **Kickoff gates:** mandate receipt cited ·
> live slot free (A9) · century claimed from the live `PORTFOLIO.md` band table.

## Relationship to existing plans

- **engine/model-policy:** template DRAFTING uses the strongest seat per the live
  model policy (legal prose = high-stakes writing); rendering itself is deterministic
  code, no model in the render path.
- **design:** page furniture (plain-language boxes, /legal hub) may use design-lane
  review; no dependency — text first.
- **growth (`PLAN-growth.md`, landed 2026-08-09, kickoff pending):** its arc-first
  client is the arc public site — legal-pack renders that site's own policy pages (the
  module's second render target after LexOS), and both plans share the static-MDX
  constraint on published routes. No ordering dependency either way; whichever cycle
  runs first, the other consumes.
- **ledger (`PLAN-ledger.md`, landed 2026-08-09, kickoff pending):** the ₹25k-MRR
  lawyer-review tripwire (LEG-G) reads from ledger once its views ship; until then the
  calendar tripwire + owner calendar carry it.
- **policy engine (LIVE — C9 merged `677b67e` / PR #130, 2026-08-08):** publishes stay
  L1-human forever regardless of policy-engine ladders — REQ-06 is permanent law,
  revisitable only by explicit future ADR. Zero new event kinds here; if kickoff's
  policy audit finds the action-kind table wants a row for the `/arc-legal` publish
  action, the `hq.policy.yaml` row lands in the same change (POL-I birth rule).
- **LexOS (venture, PAUSED under the mandate):** serves only as the real-facts render
  target (REQ-08). Rendering into its working tree is minutes and breaks no pause;
  live deploy completes at venture-resume.

## Goal

One sentence: `/arc-legal <venture>` turns a per-venture facts file + one pinned
template set into **six honest, evidence-linked, human-signed policy pages and a
launch checklist that probes production** — versioned, hash-chained, receipted — so
no arc venture (including arc itself) ever publishes an invented legal claim or
blocks on payment-provider activation.

## Current state (verified 2026-08-10 — re-verify at kickoff)

- Nothing exists of: templates, facts schema, `/arc-legal`, lints. Org-blueprint role
  #51 = PLANNED; this plan is its birth certificate — the sixth plan promoted under
  the Build-out Mandate (after executor/scheduler/ledger/growth/memory, corrections
  #15–19).
- Constitution **v1.0 ADOPTED** (2026-08-06, receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`) —
  E3 truth article is law; the no-unearned-badges rule stands on it.
- Spine live; `approval.requested` / `decision.recorded` / `note.logged` are live
  kinds; the strict-payload-profile pattern is proven (POL-E, ABS-D) — **zero new
  kinds needed**. Vocabulary grows only by micro ADR against live `KINDS.length`
  (ADR-0107 rule) — count read live at kickoff, never quoted from a plan.
- Lanes world live; Mode A serial (one live cycle, A9); **ADR century = next free per
  the live `PORTFOLIO.md` band table at kickoff** — expectations go stale in days
  (the absorb 0400 lesson); several mandate plans are also waiting to claim centuries,
  so no number is promised here.
- sync-to-project ships arc into consumer repos; LexOS = registered consumer,
  root-mode, site live (lexos-bay.vercel.app), Razorpay in stack.
- **Verified externally (2026-08-03):** Razorpay activation requires SIX site pages
  (Shipping · Contact us · Pricing · T&C · Privacy · Cancellation/Refunds) before
  live-mode keys. DPDP Rules notified 2025-11-14; soft enforcement ends Nov 2026;
  full enforcement (penalties) ~2027-05-13. Re-check both at kickoff — terms shift.
- **Unverified (LexOS repo not connected 2026-08-03..10):** whether LexOS already has
  any policy pages · whether Razorpay is formally ADR'd there · operator GST posture.
  Assumptions ledger carries all three; kickoff resolves them before Phase 0 code.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | One facts file becomes six correct pages | `legal/facts.yaml` (schema per LEG-B) renders T&C · Privacy · Refund/Cancellation · Shipping/Delivery (digital-delivery wording) · Contact · Pricing. `payment_model: gateway\|mor` and `gst_registered` select the correct clause branches — a MoR clause surviving a `gateway` render = lint FAIL (fixture-pinned). Every clause traces to a pinned template block (trace-lint, mechanical via the enum→clause map); every interpolated value passes value-lint (typed/enum fields; free-text charset+length capped, HTML-escaped, compliance-claim denylist on RENDERED output). WARN-first in TRIAL | 0–1 |
| REQ-02 | Money/legal lines match reality, evidenced | Refund window, billing, tax-posture and provider lines carry an evidence link each (provider terms / GST posture / DPDP basis) recorded in the run output; the Privacy page contains the DPDP Rule-3 notice block (itemised data + purposes · rights + withdrawal route · grievance contact with response-window · Board-complaint line · s.5(3) language-request line) and the processor clause ("your clients' data": on-instruction processing, confidentiality, no-AI-training, sub-processor list, export+deletion on exit) when `stores_third_party_client_data: true`. Required-clause-ID completeness lint: a missing mandatory block = FAIL (WARN-first in TRIAL) — provenance alone cannot pass an empty page | 0–1 |
| REQ-03 | Pages answer real situations, provably | Pinned scenario set (≥8: refund-day-N±1 · cancellation path · GST-invoice request · data-deletion request · account-termination-with-client-data · payment dispute · grievance escalation · notice-language request) each maps to its answering clause ID; an unanswered scenario fails the completeness lint. Scenario list is a versioned fixture — extending it is a reviewed diff | 0 |
| REQ-04 | The launch checklist checks PRODUCTION, not intentions | Checklist renders from facts + provider page-list (Razorpay's six, evidence-linked) and each row verifies against the live site: policy URLs fetch 200 · footer/signup DOM contains the links · deletion mailbox answers · cancel path stated matches the policy text (screenshot row). Self-attestation from render artifacts is structurally impossible (probe runner reads URLs, never local files). Probe automation depth is designated cut #1 — manual probe checklist is the floor. For a paused venture the probe rows record OPEN-at-venture-resume, never a fake green | 2 |
| REQ-05 | No page changes without a receipt — cryptographically | Render is a pure function (facts + template_set@sha + engine@version → bytes, fixture-proven byte-reproducible). `decision.recorded` binds the pair (facts_sha256, output_sha256) + template_set_sha; publish refuses any hash-pair mismatch (post-approval facts edit forces re-approval — TOCTOU fixture). effective_date ≥ decision timestamp and strictly monotonic per page (backdating fixture FAILs). `arc-legal --verify` re-renders and diffs the venture's committed pages (nonzero on drift); a ~10-line CI guard in the venture repo compares committed-page hashes to the latest publish receipt. Policy routes are static checked-in MDX/MD only — CMS/SSR/dynamic content on these routes is banned (the constraint that makes verification possible) | 1–2 |
| REQ-06 | Publishing is human, forever, and reviewable | `approval.requested` carries a strict payload profile `subject: "legal.publish"` (venture · page set · facts_sha · template_set_sha · output hashes · evidence-bundle path · diff summary; unknown keys rejected) → owner decides via existing inbox → `decision.recorded` with reason. First publish presents the full pages; re-publishes present the semantic diff (changed facts values + changed clause IDs) — full-blob re-approval is a lint warning. L1 permanent; zero new event kinds (note.logged + tags for the publish annotation; promotion trigger to a `legal.updated` kind = cross-venture structural queries actually needed, ADR then) | 1 |
| REQ-07 | The template set is governed like the asset it is | Template set is a versioned, manifest-hashed directory; template EDITS go through their own approval (a template diff in the inbox, not a silent commit); every publish receipt pins template_set_sha, so a template change forces visible per-venture re-approval via `--bump-templates`. Per-venture `legal/pins.yaml` lets venture A stay on v3 while B runs v5. Drafting is original text (government-source-derived + plain language) — no copy-paste from other companies' policies (copyright + wrong-fit); text-level attack panel (hostile-customer / regulator / competitor-lawyer stances) runs on the drafted set before P0 closes | 0, 2 |
| REQ-08 | One real venture, end-to-end | LexOS facts file authored (real values; unverified items resolved at kickoff) → six pages rendered → lints green → scenario fixtures answered → inbox approval with full-read → pages + pins + receipts committed into the LexOS working tree → **LexOS-side integration handoff checklist** produced (footer routes · signup consent capture · cancel-path UI parity · grievance mailbox · Razorpay dashboard fields). Live-deploy + production-probe rows recorded as OPEN-at-venture-resume (pause honored, machinery proven). Evidence bundle committed | 3 |

## Appetite

**5 working days hard cap. Tier: S/M** (8 REQs). Planned allocation **4d + 1d slack**
(portfolio C4's 112% overrun is the standing lesson; slack is never taken from the
adversarial passes). The 08-03 cost audit priced honest template AUTHORING at 1.5–2d
of the total — the research is banked in this plan and its evidence links, which is
what makes 5d real instead of hopeful.

**Kill criteria:** the text attack panel shows the template set needs real-lawyer
rewrite beyond appetite → ship the three core pages' content + bank the engine, and
the lawyer-review trigger escalates from tripwire to immediate · any lint boundary
unprovable by adversarial fixtures → STOP (an unprovable boundary is a no — executor
precedent) · at 100% appetite → ship rendered+approved for one venture; park
`--verify`/probe automation with their designated-cut rows recorded.

## Decisions to ADR at kickoff (legal century — next free per PORTFOLIO.md at kickoff)

| ID | Decision (candidate text — locked at v1.0 freeze, numbered at kickoff) |
|---|---|
| LEG-A | **Six pages, provider-branched.** The page set is the provider-activation superset (Razorpay's six), not the brief's three. `payment_model: gateway\|mor` is a REQUIRED enum selecting whole clause branches (gateway = operator-as-merchant wording, refund-to-original-method with processing days, merchant legal name matching card descriptor, GST posture lines; mor = provider-as-merchant tax lines). The old brief's "Indian operator selling globally via MoR" premise is CORRECTED on the record: client #1 class is gateway-domestic. No-tax-math law unchanged — posture wording only, CA owns tax |
| LEG-B | **Facts schema: enum-everything, three risk tiers.** ENUM/INT/BOOL/DATE = safe · FORMAT (regex: emails/URLs/dates) = low-risk · FREE-TEXT = dangerous (length ≤80, plain charset, no markup/URLs, compliance-claim token denylist). Mandatory fields incl.: operator {type: individual\|entity, legal_name, trade_name} ("trading as" disclosure) · geographic_address · support contact + phone · grievance {name, email, address, ack_days} · data_categories[] (closed enum) · purposes[] (closed enum) · retention tokens · deletion_route {mailbox v1} · analytics[] allow-list · payment_model · payment_provider enum · refund_window_days INT · gst_registered BOOL (+ GSTIN when true) · stores_third_party_client_data BOOL · sub_processors[] · site_url · effective_date. Every enum value maps 1:1 to a pre-approved clause block — that mapping is what makes trace-lint mechanical. Schema itself versioned; a venture that doesn't fit an enum forces a template-set version bump (the friction IS the review gate) |
| LEG-C | **Receipts: zero new kinds.** Approval chain = `approval.requested` (strict `subject: "legal.publish"` profile, POL-E/ABS-D precedent) → `decision.recorded` (reason mandatory); publish annotation = `note.logged` + tags `[legal, publish, <venture>]` carrying the render-receipt payload. Promotion trigger to a first-class `legal.updated` kind: the day cross-venture legal queries are real, by ADR — never by convenience |
| LEG-D | **Hash-chain + date law.** decision binds (facts_sha, output_shas, template_set_sha); publish refuses mismatch; effective_date ≥ decision time, monotonic per page; `--verify` + venture-side CI hash guard; policy routes = static checked-in MDX only (dynamic rendering on these routes banned). The receipt attests to bytes, not intent |
| LEG-E | **Topology: authored in arc, executed venture-side.** Templates + engine live in this lane (`products/legal/` + `.claude/scripts/legal/`); sync-to-project ships the pinned, manifest-hashed set into consumer repos; `/arc-legal` runs in the venture repo (root-mode), facts/pages/pins/receipts venture-local (single-emitter discipline — no cross-repo spine writes; HQ visibility later via the existing pull-side pattern). Template fixes reach ventures only by explicit re-sync + `--bump-templates` re-approval — deliberate roll-forward, never silent fleet propagation |
| LEG-F | **DPDP depth v1: light-but-correct.** Rule-3 notice block + unified grievance block (one named contact serving DPDP ≤90d · e-commerce-rules 48h-ack/1-month · IT-rules windows — strictest printed) + s.5(3) language line (English v1 + request-mailto; no 22 translations) + data-principal rights + Board-complaint line. NO consent-management platform, NO cookie banner; signup consent CAPTURE is venture-side work named in the REQ-08 handoff, never built here |
| LEG-G | **Lawyer-review triple trigger, recorded as tripwires:** ₹25k MRR (ledger when live) OR calendar ~Q1-2027 (before 2027-05 DPDP full enforcement) OR a design-partner advocate review when the first lawyer-customer relationship exists (near-free; the customer base is literally advocates). Whichever fires first; firing = a needs-you item, not a silent date |
| LEG-H | **Operational wording defaults:** deletion route v1 = monitored mailbox (form = future) · dark-pattern-clean cancellation stated in the Refund page and checked in the checklist (cancel ≤ clicks-to-subscribe · auto-renewal amount+date disclosed · no retention maze) · pricing page shows one all-inclusive INR figure with tax treatment stated |
| LEG-I | **Scenario-fixture law (REQ-03):** the pinned scenario set is part of the template set's definition of done; template edits that orphan a scenario fail completeness; new scenarios enter by reviewed diff. Text quality is judged by answerability, not prose taste |
| LEG-J | **OPEN — decided at kickoff, recorded with the kickoff ADR set:** century number (next free per the live board) · code home confirmation · first render target order (LexOS real-facts vs fixture venture first) · probe-runner automation depth v1 (designated cut #1) · checklist screenshot storage location |

## Non-negotiables

- **Not a lawyer, never pretends to be:** no invented legal claims; no compliance
  badges without demonstrable truth + evidence link (Constitution E3); output pages
  carry no "reviewed by counsel" implication until LEG-G fires and it's true.
- Human gate L1 **permanent** on every publish; propose-only everywhere; no
  auto-publish path exists in code.
- All three lints (value / trace / completeness) WARN-first in TRIAL; **adversarial
  pass before any FAIL promotion** (parser-class law — facts files and templates are
  hostile input: claim smuggling, markup injection, omission).
- Text-level attack panel on the authored template set before P0 closes — content is
  parser-class too.
- Hash-chain law (LEG-D) — no publish without a bound receipt; no silent edits, no
  backdating.
- Emitter/reader discipline; zero new event kinds; zero-dep Node/POSIX (A2); central
  `tests/` (ADR-0021); never delete — superseded template versions and retired pages
  keep their files (A10).
- Original drafting only — no copied third-party policy text (copyright + fit).
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A5, A8, A9, A10.

## No-gos (this cycle)

Legal advice, DPAs, customer contracts, IP assignments, employment docs · consent-
management platform / cookie banner · tax computation of any kind (posture wording
only) · jurisdiction tourism (jurisdiction enum locked to IN-operator v1; a non-IN
venture = template-set version bump by ADR) · CMS/SSR/dynamic rendering on policy
routes · auto-publish or scheduler wiring (scheduler's jobs never touch publishes;
publish stays a human act) · per-venture template forks (branches live inside the ONE
pinned set) · new event kinds · free-form model-generated clauses at render time
(models may help AUTHOR templates under review; the render path is deterministic code
only) · building the venture-side signup/cancel UI (handoff, not scope).

## Rabbit holes (named detours)

- **Template prose perfectionism** — REQ-03 scenario answerability defines done;
  taste iterations post-ship.
- **Lint over-engineering** — the enum→clause 1:1 map keeps trace-lint a lookup, not
  an NLP project; anything smarter is a future ADR.
- **Probe automation depth** — designated cut #1; a manual probe checklist with
  screenshots is honest v1.
- **Multi-language notices** — s.5(3) request-mailto line satisfies v1; translation
  machinery only on real requests.
- **Provider-terms watching** — re-verify at each publish and provider change; no
  standing watcher (a future scheduler job, if ever, by its own ADR).
- **Legal-domain feature dreams** (clause libraries for LexOS's product, contract
  review, e-sign) — separate briefs if ever; the provenance-lint tech transfer to
  LexOS drafting is a NOTED future idea, not scope.

## Assumptions ledger

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| Razorpay's six-page activation list is current | Kickoff re-check of the docs page shows a changed list → checklist source list updated, REQ-04 unaffected structurally | 0 |
| Operator (LexOS) is GST-unregistered today | Kickoff verification says registered → `gst_registered: true` branch renders; both branches exist either way | 0, 3 |
| LexOS has no existing policy pages / no conflicting legal text | LexOS repo audit at kickoff finds pages → REQ-08 becomes supersede-with-receipts instead of first-publish | 3 |
| DPDP obligations for a small fiduciary are covered by the Rule-3 notice + grievance + rights block (no SDF-class duties) | Scale/sensitivity crosses SDF thresholds or rules amendment lands → LEG-G lawyer trigger fires early; template bump | tripwires |
| 5d appetite holds because research is banked | P0 template authoring exceeds 2d → kill-criteria path (ship 3 core pages' content, bank engine) | 0 |
| Static-MDX constraint is acceptable to venture stacks | A venture's stack can't serve static policy routes → that venture is out of v1 scope until it can (constraint > convenience) | 2–3 |

## Pre-mortem (top 5 — seeded from this plan's own review history)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | **False tax/refund statements** (the round-1 finding: MoR language rendered for a gateway client) | LEG-A branch architecture + branch-mismatch lint fixture + REQ-02 evidence links + kickoff GST/provider verification |
| 2 | **Facts-value injection** — badges/markup riding interpolation into clean-tracing clauses (red-team #2) | LEG-B risk tiers + value-lint + HTML-escape at render + claim denylist on rendered output + adversarial corpus pinned |
| 3 | **Approved ≠ served** — deploy divergence, TOCTOU facts edits, backdating (red-team #3/#6/#7) | LEG-D hash-chain: bound pair in decision, refuse-on-mismatch, date law, `--verify`, CI guard, static-MDX constraint |
| 4 | **Template authoring eats the appetite** (YAGNI audit: the brief priced only apparatus) | Research banked in-plan · P0 timebox with kill path · designated cuts ordered (probe automation → verify polish; never template quality / hash receipts / human gate) |
| 5 | **Scope creep into "legal department" dreams** (brief pre-mortem #3, still the truest risk) | No-gos hold; anything beyond six pages + checklist = a future brief; retro asks the question explicitly |

## External dependencies

None at runtime (zero-dep render, local files). At kickoff: two web re-checks
(Razorpay activation page-list · DPDP timeline/status) run in-session with links
recorded into REQ-02 evidence; LexOS repo access for Phase 3.

## Phases (risk-ordered)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | **The content and its laws.** Facts schema (LEG-B) + value-lint · six-page template set AUTHORED (gateway/mor + GST branches · DPDP Rule-3 notice · processor clause · grievance block · dark-pattern-clean cancellation wording) · required-clause-ID map + scenario set (LEG-I) · enum→clause map → trace-lint + completeness lint · **text attack panel on the drafted set + adversarial pass on all three lints (untouchable)** | 2d |
| 1 | **Deterministic render + receipts.** `/arc-legal <venture>` pure-function render (byte-reproducible fixture) · version + effective-date stamping · evidence-link plumbing · inbox wiring (`legal.publish` profile → decision; semantic-diff for re-publishes) · hash-chain enforcement incl. TOCTOU + backdating fixtures | 1d |
| 2 | **Guards + governance.** `--verify` drift command · venture-side CI hash-guard snippet · pins.yaml + `--bump-templates` re-approval path · template-edit approval flow · launch-checklist renderer + production-probe runner (or manual probe pack per LEG-J cut) | 1d |
| 3 | **The real render (REQ-08).** LexOS kickoff-verifications resolved → real facts file → render → lints → approval (full read) → pages+pins+receipts committed to the LexOS tree · integration handoff checklist delivered · live-deploy + probe rows recorded OPEN-at-venture-resume · evidence bundle · retro | 1d |

**North-star:** any venture — including arc itself — goes from a facts file to six
honest, receipted, human-signed policy pages in under a day; no page ever changes
without a receipt; and no arc venture is ever again blocked at a payment provider's
"where are your policy pages" gate.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo

```
/arc-kickoff --lane legal legal pack — customer-facing policies per venture

Design source: docs/strategy/plans/PLAN-legal-pack.md (v1.1, approved; trigger FIRED
under the owner's Build-out Mandate 2026-08-09 — cite the same decision.recorded as
the other mandate kickoffs). Read it fully.
Gates before anything: mandate receipt cited · live slot free (A9 — no other lane
mid-cycle) · claim the NEXT FREE ADR century per PORTFOLIO.md (the band table at
kickoff is the truth — expectations in plans go stale).
First acts: the two web re-checks (Razorpay activation page-list · DPDP status) with
links recorded, and the LexOS verification set (existing pages? Razorpay ADR? GST
posture?) — assumptions ledger rows resolved before Phase 0 code.
Decisions LEG-A..I are locked; decide LEG-J now and record it with the kickoff ADR set.
The three lints are WARN-first with adversarial passes before any FAIL promotion; the
text attack panel on the template set is part of Phase 0's definition of done; the
hash-chain law (LEG-D) and the permanent human gate (REQ-06) are non-negotiable.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 work.
```

---

## External evidence (checked 2026-08-03; re-check at kickoff)

- Razorpay — mandatory business-website pages for activation (six incl. T&C/Privacy/
  Refunds): razorpay.com/docs/payments/dashboard/account-settings/business-website-details/
- DPDP Rules notified 2025-11-14; phased enforcement to 2027-05: india-briefing.com
  DPDP timeline · dpdpa.com/dpdparules/rule3.html (notice contents) · apnilaw.com DPDP
  s.5 (language option)
- Consumer Protection (E-Commerce) Rules 2020 — entity disclosures, grievance officer:
  indialaw.in summary
- Dark Patterns Guidelines 2023 (CCPA) — subscription-trap/cancellation: trilegal.com PDF
- GST — services registration threshold incl. inter-state exemption: taxwink.com note
- BSA 2023 s.132 — advocate-client privilege (the processor-clause stake): indiankanoon.org
