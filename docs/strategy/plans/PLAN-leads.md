# PLAN (design source) — leads v1: the outbound engine

> **v1.0 (frozen 2026-08-03).** Expanded from `BRIEF-leads.md` (v1.1, 2026-07-25)
> against the live repo state of 2026-08-03 (PORTFOLIO.md, plans/README.md,
> PLAN-evolve.md conventions), through **three same-day owner review rounds under
> delegated decision authority — all 27 rulings on the record in §Review round 1/2/3.**
> Round 1 hardened operations (send-moment guard · receipt-derived caps · provider
> idempotency · no scheduler · similarity guard). Round 2 closed four P0s (private
> store outside the repo · keyed HMAC ids · crash-safe send journal · private review
> boundary). Round 3 closed the final spec-precision gaps (spine-first recovery ·
> HOLD-compatible REQ-05 acceptance · tripwire exception model · measurable triage
> SLA). **Promoted to the repo 2026-08-03 on the owner's drop instruction; supersedes
> the brief as design source — `BRIEF-leads.md` moved to `docs/archive/`** (never
> deleted; marked in the strategy file map). Decisions are lettered LEA-A…M; real ADR
> numbers are assigned at kickoff from the lane's century band, never hardcoded here.
>
> **Trigger (pull):** a venture or the MVP-service lane needs outbound — concretely,
> **a real, named offer to sell exists.** **Prereqs:** spine + inbox (every send is an
> event; sequences need the approval flow) · a real offer · the Pre-kickoff gate below
> fully evidenced. **NOT fired as of 2026-08-03** — LexOS is pre-billing (P5 = billing,
> Sep '26 first-₹ target) and no offer is defined. **This plan sleeps. Do not start
> before the trigger fires** (Constitution A8) — but Pre-kickoff gate rows 2–4 are
> calendar-gated, not effort-gated, and should start as soon as outbound is plausibly
> ≤6 weeks away.

## Goal

One sentence: `/arc-leads <icp>` turns an ICP definition into a small, deeply-researched,
evidence-backed lead list (quality over volume — 25, not 2,500), drafts first-touches that
are structurally incapable of being template-blast, and runs a capped, human-approved
sequence from a warmed dedicated domain — every send/reply/meeting/suppression a typed
receipt on the spine, every cap enforced in code and proven unbypassable by fixture,
L1 (draft-approve) until the trial ledger earns anything more.

## Current state (as of 2026-08-03 — re-verify at kickoff)

- Spine LIVE (C2 closed 2026-07-28): standard emitter, reader/replay, inbox
  (`arc-inbox.mjs` — approve/reject by ULID, mandatory reason, decisions final).
- **Event vocabulary CLOSED** (ADR-0026; KINDS = 22 as verified in PLAN-evolve
  2026-08-02 — re-count at kickoff). No `lead.*` / `outreach.*` / pipeline kind exists —
  emitting one today is `UNKNOWN_KIND`. LEA-A is a vocabulary-extension ADR by
  construction (ADR-0106/0107 precedent).
- Lanes are law (ADR-0054): this work lives in `initiatives/leads/`; kickoff needs
  `--lane leads`; the lane claims the next free ADR century at birth (**0300–0399 as of
  2026-08-03** — confirm against PORTFOLIO.md band table at kickoff).
- `arc-kickoff` is a GENERATED command (engine C6, ADR-0201/0202) — kickoff behavior
  changes go through the process layer, never by editing the command.
- Model policy is law (C5 closed 2026-08-02): any researcher/triage agent seat gets a
  tier assignment under the policy ADRs — no quiet model choices.
- develop harness LIVE (arc-develop C6): the build loop (plan-approval → phase-done)
  runs through it.
- **LexOS** (venture #1, own repo, root-mode arc, passport row only — ADR-0059): stack
  already includes **Resend for transactional email** on the product domain. Phase 1
  LIVE (lexos-bay.vercel.app); billing lands at its P5. The product/root domain never
  sends cold mail (LEA-C).
- PLAN-evolve v1.0 in-tree (SLEEPING): `metric.observed` spec frozen there; EVO-H0
  (vocabulary + feed) is pinned to "the FIRST CLIENT's cycle — growth inherits". If
  leads kicks off before growth, that pin needs an on-the-record owner resolution
  (LEA-I) — leads' campaign metrics would otherwise start evolve's 4-week clock with
  no vocabulary to land on.
- No leads code exists anywhere: no `/arc-leads` command, no pipeline kinds, no
  suppression state, no sending-domain DNS (verify all four at kickoff).
- **Open PRs ahead of any new lane:** develop PR #100 and engine PR #103 are
  merge-ready (PORTFOLIO 2026-08-03). Land them BEFORE `/arc-kickoff --lane leads` —
  a lane born onto a tree with two unmerged cycles inherits churn for free. Mode B
  (parallel worktrees) is NOT CERTIFIED and concurrent emitters stay forbidden
  (ADR-0056): leads runs Mode A parked-lane switching like everything else, one
  session at a time — one more reason the campaign loop is a human-started command,
  never a background process.
- **The repo is headed public later** (owner strategy): anything committed today is in
  git history forever. Lead PII must therefore never enter the tree at all — see LEA-K.

## Pre-kickoff gate (nothing below builds until ALL of this is true)

| # | Item | Evidence required |
|---|---|---|
| 1 | **A real offer, named** | One-pager: what is sold (LexOS pilot / paid plan / MVP-service), to whom, at what price or pilot terms, with what call-to-action ("book a 20-min demo"). Owner-written; a URL or PDF the first-touch can honestly point at |
| 2 | **Dedicated sending domain live + warmed** | Domain purchased (NEVER the product/root domain) · SPF + DKIM + DMARC published and verified green · **warm-up log ≥14 days** (gradual volume, engagement-positive). Calendar-gated — start the moment outbound is plausibly ≤6 weeks out |
| 3 | ICP v0 file | Geography (v1 allowlist candidate: India) · segment (e.g. solo advocates / 2–10-staff firms) · practice area · firm-size proxy · why-they-buy hypothesis · disqualifiers. One ICP only (rabbit hole #1) |
| 4 | Calendar link live | Booking URL created and test-booked once (cal.com or equivalent — 15-minute setup) |
| 5 | Capability scout done | `/arc-capability` report on (a) lead-research sources, (b) an email-verification method, (c) sending provider with suppression API + **idempotency-key or message-id lookup (hard filter — REQ-03)** + (ideally) inbound support — report only, installs nothing (ADR-0110). Shared-ADR note: this is also growth's transactional-email decision — decide ONCE (both briefs say so) |
| 6 | LEA-I resolved | Owner ruling on the record: does leads adopt EVO-H0 (metric vocabulary to PLAN-evolve's frozen spec) as first client, or does that obligation stay pinned to growth? |

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-00 | Sends can't burn the company's name | Deliverability preflight — **live checks, not file existence (round 2, P1-6: a stale or fake evidence file must not open the gate):** the gate itself resolves SPF/DKIM/DMARC via live DNS lookup + queries provider auth status through the interface (fake in fixtures) · warm-up log ≥14d, **genuine engagement only — no fake-engagement/bot warm-up networks (dishonest signals, provider-ToS risk; warm-up method verified in the capability scout)** · dedicated domain confirmed ≠ product/root domain (and not a subdomain of it — LEA-C) · List-Unsubscribe header present on every send template. **No send #1 before this gate passes — code, not checklist** (fixtures: DNS record absent → refused · evidence file present but live check fails → refused). **Phase-3 entry re-verification: DATED seed-inbox smoke test, ≤7 days old at campaign start** — send to ≥2 owned seed mailboxes (Gmail + Outlook-class), verify inbox placement (not spam), auth headers pass, unsubscribe flow works end-to-end, reply + bounce ingestion fire on the seeds — BEFORE lead send #1 (fixture: stale/undated seed evidence → refused) | 0 + 3-entry |
| REQ-01 | ICP in → 25 researched leads with receipts for WHY | `arc-leads research <icp-file>` → 25 leads, each with a **dossier** (private, LEA-K store): why-they-fit narrative + ≥2 source links + **provenance class** from a closed allowlist (firm site · public directory · public listing · manual-LinkedIn-note) + geography + **verified email** (verification method from LEA-J; unverifiable → HELD, never sent blind) + **≥1 lead-specific fact with its evidence URL and an explicit fact→offer relevance line** (why this fact makes the offer land — feeds LEA-E). **Rejected candidates keep a record too** (exclusion reason + source) — the 25 must be a filtered set with an audit trail, not a survivor list. Purchased-list and login-wall provenance classes are **structurally rejected by lint** (fixture), not policy text. No raw personal data on the spine — spine carries `lead_id = lead_hmac_v1_<hex32>` (keyed HMAC, LEA-A); names/emails/drafts live ONLY in the LEA-K private store, outside the repo directory | 0 |
| REQ-02 | Template-blast is structurally impossible | Personalization lint, three classes: **FAIL** = structural violations — no lead-specific reference at all, or a cited fact that does not exist in the dossier (fake personalization mechanically impossible), or no fact→offer relevance line · **BELOW-BAR** = heuristic shortfalls — fewer than N (default 2) dossier-cited facts, slop markers ("hope this finds you well", claimed-familiarity without an evidence link), or **cross-draft similarity above threshold** (body ≥X% identical to other drafts in the campaign — per-draft checks alone cannot see template-blast; default X=70%, config) · PASS. **Gate split (owner round-1, adjudicated): FAIL-class drafts never reach the inbox — these checks are deterministic, so hard-gate from birth is safe. BELOW-BAR/heuristic classes start WARN-first in TRIAL (standing rule) and are shown ON the inbox item** — the approver sees the warnings, false positives don't silently block a good draft, and the trial ledger collects real evidence for promotion. Rationale: an absence-only pass condition cannot detect mediocrity (ADR-0049) — one generic token must not pass. **Adversarial pass before any WARN→FAIL promotion** | 1 |
| REQ-03 | Caps and suppression CANNOT be exceeded — even if asked | In code, config-valued, fixture-proven: **≤20 successfully SUBMITTED sends per IST (Asia/Kolkata) calendar day** — attempts that the provider refused don't count; the day boundary is fixture-tested at midnight IST · **≤2 touches/lead in any ROLLING 7-day window** (not calendar week) · auto-stop on reply · send-window (IST business hours, weekdays) · **global suppression ledger**: event-backed (`lead.suppressed` receipts → derived state, reader-only), checked before EVERY send, survives across campaigns, unsubscribe honored instantly (same run). **All cap/suppression state derives from spine receipts via the reader — no mutable counter file exists to reset; process restart mid-day rebuilds the same counts, and effective counts = receipts + unresolved LEA-L intents (fixture)**. **Approval authorizes a send ATTEMPT, never a send: the full guard chain re-runs at the send moment — a reply/bounce/unsubscribe recorded after approval permanently blocks that send, and the draft's sha must equal the approved sha (LEA-M) (fixtures)**. **Provider-side idempotency + crash safety per LEA-L: deterministic idempotency key on every submit, journal-intent before submit, reconcile-before-anything on restart — timeout/retry/crash can never deliver the same mail twice or slip a send past the cap (fixtures on the fake)**. **Circuit breakers, sample-size-honest (round 2, P1-5): FIRST bounce → automatic HOLD (sends pause, review item in inbox; human resumes after cause check) · 2 bounces in a campaign, OR rolling bounce ≥3% once ≥50 lifetime sends, OR any spam complaint → campaign FROZEN + `incident.raised`. Rationale: at n=25 one bounce is 4% — a bare percentage floor freezes on noise (the evolve lesson: thresholds without sample floors can't be trusted); HOLD is the honest small-n response, FREEZE the evidenced one. Values config, ceilings hard.** Fixtures include the ask-to-exceed class (config raised past the hard ceiling / CLI flag / env var / hand-edited counter → refused) and the 21st-send, 3rd-touch, suppressed-lead, post-reply-send cases. **Adversarial pass mandatory** (parser-class discipline) | 1 |
| REQ-04 | Replies never rot | Reply ingestion (interface + fake first — LEA-F): provider inbound webhook if supported, else `arc-leads ingest-reply --file <path>` (**file/stdin import only — raw reply content never passes through argv; shell history is a log too, LEA-M**); parsed → `outreach.replied` receipt with triage class (interested / later / no / bounce / unsubscribe) → auto-stop takes effect before the next batch · **"interested" → calendar-link draft, on a measurable SLA (round 3, fix 4 — "same day" was calendar-ambiguous): clock starts at INGESTION (webhook receipt, or manual import time — the system cannot act on mail it hasn't seen; the daily triage ritual IS the manual clock-start); ingested before 16:00 IST on a business day → draft in inbox by end of that IST business day; ingested after 16:00 IST or on a weekend → by 10:00 IST next business day (cutoff + deadline config; defaults stand). Fixtures: 15:59 ingest → same-day deadline · 16:01 ingest → next-day 10:00 · Saturday ingest → Monday 10:00** · unsubscribe-in-reply → suppression receipt instantly | 2 |
| REQ-05 | One real campaign, honestly measured | ≥25 sends over ≥3 days to real ICP leads, **every send individually approved in the inbox (L1)**. **Acceptance (round 3, fix 2 — the old `bounce <3%` standalone criterion contradicted REQ-03's HOLD design at n=25, where one bounce = 4%):** zero cap/suppression violations · **zero spam complaints · no FREEZE breaker fired · every HOLD reviewed and resolved before any further sends**. Bounce rate is RECORDED in the report and feeds the retro — it is never a standalone pass/fail threshold at campaign sample sizes. Reply-rate + meeting count recorded on the spine (and as `metric.observed` iff LEA-I adopted). Campaign report derived reader-only. Retro at close | 3 |
| REQ-06 | RevOps truth lives on the spine | Every send / reply / meeting / suppression / (manual v1) deal event = typed receipt via the standard emitter: closed payloads, idem total-preimage (e.g. `sha256("outreach.sent\|campaign\|lead_id\|touch_n")` — a touch can never double-record; C2 dup-idem class closed by construction; `lead_id` = the LEA-A keyed HMAC), corrections via `supersedes`. `arc-leads report` renders from the reader only; wipe derived state → replay → byte-identical (fixture) | 0–3 |

## Appetite

**1 week (7 days) hard cap.** Effort ≈ 5.5d inside the window: Phase 0 = 1.5d ·
Phase 1 = 2d (the adversarial passes on caps + suppression + lint + parser are the
heaviest honest work in the cycle) · Phase 2 = 1d · Phase 3 = 0.5d effort spread over
≥3 elapsed campaign days + 0.5d retro.
**Elapsed-calendar honesty:** even with the domain warmed pre-kickoff, expect **7–10
elapsed days** kickoff → retro (build days + ≥3 campaign days + daily approval rhythm);
the pre-kickoff infra (DNS, warm-up) adds 2–4 calendar weeks BEFORE that. The 7-day cap
bounds effort-burn, not wall-clock — stated so nobody reads the cycle as "outbound in a
week from a standing start."
**Designated cuts, in order:** (1) automated inbound webhook → falls back to the manual
`ingest-reply` command (REQ-04 still met on a daily cadence); (2) triage
auto-classification → manual class picks in the inbox. **The real campaign is never the
cut** — it is the point of the cycle; the Pre-kickoff gate (domain warmed BEFORE kickoff)
exists precisely so Phase 3's physics are already paid for.
**If deliverability breaks mid-cycle** (DMARC regression, warm-up insufficient): the
campaign becomes an operational-runway milestone (evolve precedent — honest physics,
stated out loud), the cycle banks Phases 0–2 on fixture evidence, and the retro records
the miss. Never send from a cold or broken domain to make a deadline.
**Kill criteria:** 50% burnt without REQ-03 fixtures green → stop; nothing sends,
ever, without the cap/suppression guard — bank the vocabulary ADR + lint as
documentation, retro. Cap/suppression enforcement can't be made fixture-deterministic
after 1 day of fixes → stop and redesign; never ship a cap that can be argued with.
**Cascade rule:** offer undefined, warm-up <14d, or DMARC not green at kickoff → the
trigger was mis-read — STOP at kickoff-lint; never build ahead of the domain.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| LEA-A | **Pipeline receipt kinds = first-class vocabulary extension** (not `note.logged`+tags): candidate set `lead.researched` · `outreach.sent` · `outreach.replied` (carries triage class) · `meeting.booked` · `lead.suppressed` (bounce/unsubscribe/manual — the suppression ledger's source) · (`deal.won` / `deal.lost` — manual CLI emission v1); exact list + closed payloads frozen at kickoff (ADR-0106/0107 precedent). Naming note: owner's `lead.sent` rejected — the lead isn't sent, the outreach is (house grammar: subject.verb-past, cf. `content.published`); owner's `lead.suppressed` ACCEPTED over v0.1's `suppression.added` (cleaner subject). Rationale for first-class kinds: RevOps queries, the campaign report, and evolve's later consumption all want typed kinds; tags-on-notes make every consumer parse prose. Cost: extending the ADR-0026 closed set — made deliberately, by ADR. **Payload discipline: keyed ids only — `lead_id = lead_hmac_v1_<hex32>` = HMAC-SHA256(normalized email [lowercase, trimmed], private secret) truncated to 128 bits, versioned prefix for future rotation** — plus campaign id, class/status enums, timestamps, provider message-id ref; no raw names/emails/URLs, and no free-text "summaries" either (a summary can leak PII as easily as a field; prose belongs in the LEA-K store). **Why keyed (round 2, P0-2): a bare `sha256(email)` — evolve's `h-<hex16>` form — is dictionary-attackable: emails are low-entropy, so anyone holding a candidate list (say, a public lawyer directory) can hash-and-match every id on a future-public spine. HMAC with a secret that never touches the repo/spine kills that class. Deliberate deviation from evolve's source_id grammar, scoped to person-derived ids; the secret lives in the LEA-K store; secret loss breaks suppression matching → backup named in LEA-K; rotation = `_v2_` prefix, re-derived from dossier emails. If LEA-I fires, `metric.observed` source_ids derived from leads use the same HMAC form.** (Fixtures: raw-email payload rejected · bare `h-<hex16>`/unkeyed-sha form rejected for lead ids) |
| LEA-B | **Pipeline truth lives on the COMPANY spine (arc)** — deals are company revenue; RevOps is a company organ (blueprint role #41). The venture repo's own root-mode spine (ADR-0059) carries its build receipts, never pipeline kinds. One spine to answer "how many meetings did outbound book this month" |
| LEA-C | **Sending domain + provider — ONE ADR, shared with growth** (both briefs mandate deciding once): product/root domains NEVER send cold — **and not a subdomain of the product domain either** (spam filters aggregate reputation to the organizational domain; a burned subdomain burns the parent) · dedicated cold-outbound domain (sibling/alt domain) · LexOS's Resend transactional setup untouched · provider requirements: API send + custom domain + suppression API + **idempotency-key support or message-id lookup (REQ-03 duplicate-send guard depends on it — a provider without either is disqualified)** + inbound route (nice-to-have; LEA-F fallback exists) · warm-up schedule + daily ramp values in config, **enforcement in code**. Exact provider picked from the Pre-kickoff capability report |
| LEA-D | **Caps + suppression enforcement model:** values in config, enforcement in code, hard ceilings above config (config can lower, never raise past ceiling) · **send-moment guard chain** (approval ≠ authorization — re-check at the moment of send): suppression → reply-stop → touch-cap (rolling 7d) → daily-cap (IST day, submitted-count) → send-window · **state derived from receipts via the reader, restart-proof, no mutable counters** · provider submits carry deterministic idempotency keys; ambiguous outcomes resolved by message-id lookup, never blind retry; crash safety = the LEA-L journal + spine-first reconcile · circuit breakers per REQ-03's sample-size-honest structure: first bounce → HOLD (pause + review); 2 bounces / rolling ≥3% at ≥50 lifetime sends / any spam complaint → FROZEN + incident · List-Unsubscribe on every send · **no background execution: sequence advancement is a human-started daily command that prepares eligible next-touch drafts for approval — the scheduler module (policy-engine-gated, README order) owns background execution in some later cycle, not here** · all of it fixture-proven including the ask-to-exceed class |
| LEA-E | **Personalization gate spec:** FAIL / BELOW-BAR / PASS as in REQ-02; N (dossier-cited facts) default 2, config; citation mechanism = draft frontmatter lists fact→dossier-source pairs, lint verifies both directions (fact appears in draft; source exists in dossier) **plus the fact→offer relevance line from REQ-01 must be present** · **cross-draft similarity guard: campaign-scope body comparison (shingle overlap), ≥X% identical → BELOW-BAR (default 70%, config — some overlap is legitimate: the offer sentence repeats; whole-body cloning is what it catches)** · **gate split: FAIL (deterministic/structural) blocks inbox entry from birth; BELOW-BAR + slop markers (heuristic) start WARN-first, rendered on the inbox item for the approver to see** · promotion only via trial-ledger ritual · slop-marker list shared philosophically with growth's content lint |
| LEA-F | **Inbound reply architecture:** interface + fake from Phase 0 (offline-first) · v1 default = provider inbound webhook if the LEA-C provider supports it · fallback = `arc-leads ingest-reply --file <path>` (raw mail saved into the LEA-K store, imported from file/stdin — never argv, per LEA-M) → parsed → receipt · auto-stop is enforced at pre-send check time, so even manual ingest on a daily cadence keeps REQ-03 honest · reply parser is parser-class → adversarial pass |
| LEA-G | **Jurisdiction guard:** every lead carries geography; v1 sends only to an allowlist (recommendation: **India only**) · expanding the allowlist = its own ADR with the rules of that regime encoded (EU/UK = opt-in regimes — out of v1 scope entirely) · lint rejects out-of-allowlist leads at research time (fixture) · every send: truthful sender identity, business-context B2B content, working unsubscribe, instant suppression · DPDP-conscious handling (business-contact data minimalism; delete-on-request honored via suppression + workspace purge). NOT legal advice — owner reviews before campaign #1; the legal-pack module formalizes later |
| LEA-H | **L1→L2 promotion evidence, defined now** (trial-ledger rows): a send-autonomy promotion PROPOSAL requires ≥30 consecutive unedited approved drafts across ≥2 campaigns · zero cap/suppression violations · bounce <3% across the qualifying campaigns (sample ≥50 sends by construction — the same floor the FREEZE breaker uses, so unlike a single-campaign n the percentage is meaningful here) · zero spam complaints · stable-or-better reply rate. Meeting the bar creates a proposal in the inbox; the human decides. Lint promotions (WARN→FAIL) travel the normal trial-ledger path separately |
| LEA-I | **EVO-H0 adoption (conditional):** IF leads reaches kickoff before growth, leads' cycle ships EVO-H0 (the `metric.observed` vocabulary + validator + fixtures to PLAN-evolve's frozen spec — deviations flagged back to that plan) and emits campaign outcomes (`reply_rate` as replies/sends, `meeting_count`) — knowingly starting evolve's 4-week trigger clock. PLAN-evolve pins this obligation to growth — the shift is an owner ruling recorded at kickoff (deviation on the record, evolve-plan precedent) |
| LEA-J | **Research provenance + verification:** provenance classes = closed allowlist (REQ-01); purchased/login-wall = rejected at lint · email verification method from the capability report (vetted verifier, or minimum MX+syntax check) · unverifiable → HELD · bounce outcomes wired to the LEA-D HOLD/FREEZE breakers |
| LEA-K | **PII storage policy — nothing personal ever enters the repository directory, full stop.** The repo goes public later (owner strategy) and git history is forever, so this is structural, not preference. v0.2's "gitignored dir inside the worktree" was a contradiction (round 2, P0-1): an ignored dir is still one `.gitignore` regression or one `git add -f` from a permanent leak — **and `git clean -xfd`, a routine command, DELETES ignored files: lead data must never live anywhere git considers disposable.** Rule: **the private store lives OUTSIDE the repo directory entirely, owner-controlled — default `~/.arc/leads/` (exact path in config, confirmed at kickoff).** It holds: dossiers (names, emails, drafts, notes, reply content) · the LEA-A HMAC secret · the LEA-L send journal. The repo holds ONLY: schemas, fake fixtures, non-secret config, and opaque refs (`draft_ref`/`lead_hmac`). **The store path itself is never hardcoded in tracked config — it resolves at runtime from environment (`ARC_LEADS_STORE`) with the `~/.arc/leads/` default (round 3: a personal filesystem path in a future-public repo is itself a leak).** Full email bodies exist only in the store + at the provider — never on the spine, never in receipts, never in the tree. **The hygiene lint stays as a TRIPWIRE, honestly framed, with an explicit exception model (round 3, fix 3 — fixtures legitimately contain sample addresses):** declared fixture paths may contain ONLY reserved-domain addresses (`example.com` / `.test` / `.invalid` — RFC 2606), so even a fixture can never hold a real address; email-shaped strings ANYWHERE else in tracked files (code, docs, config, lane data) FAIL; a resolved store path appearing in any tracked file FAILS. It detects the common accident — it cannot prove arbitrary prose PII-free (location isolation is the primary defense; the lint is the alarm, not the wall). Delete-on-request = dossier purge + `lead.suppressed` receipt, **with the suppression HMAC retained** (minimal-data suppression — without it the same person resurfacing in a future research list would be re-contacted; see LEA-A). Store + secret backup is an owner concern, named out loud: outside the repo there is no git safety net, and losing the secret breaks suppression matching (LEA-A) |
| LEA-L | **Crash-safe send journal + provider reconciliation (round 2, P0-3).** The gap: provider accepts the mail → process crashes BEFORE `outreach.sent` lands → receipts undercount → a blind restart could resend (duplicate to a human) or oversend past cap. Contract: **two-phase journal in the LEA-K store (the spine stays confirmed-truth only; operational scratch state never rides it):** (1) BEFORE submit, journal an `intent` {idempotency key, lead_hmac, campaign, touch_n, draft_sha}; (2) submit; (3) on provider ack, emit `outreach.sent` (payload carries provider message-id + provider timestamp); (4) mark intent resolved. **Startup + pre-send recovery — SPINE-FIRST, in this exact order (round 3, fix 1: the receipt-emitted-but-intent-unresolved crash window means a provider-first reconcile would re-emit into a dup-idem error):** (1) compute the intent's deterministic send idem and check the SPINE first; (2) receipt already exists → mark the intent resolved — NO provider call, NO emit; (3) no receipt → provider reconciliation by idempotency key/message-id; (4) found-accepted → emit exactly one missing receipt (same idem preimage); (5) not-found → void the intent. **The recovery is itself idempotent — a crash DURING recovery re-runs safely, because step 1 always re-derives from the spine.** NO new send is attempted anywhere while an unresolved intent exists, and effective cap counts = receipts + unresolved intents (conservative until resolved). Fixtures: crash-after-provider-accept-before-receipt → restart → reconcile emits exactly one receipt, zero resends, cap counts it · **crash-after-receipt-before-journal-resolve → restart → intent resolved FROM THE SPINE, zero provider calls, zero duplicate emits** · crash-before-provider-accept → intent voided, no receipt, cap slot released · unresolved intent present → every send path refuses · crash mid-recovery → re-run converges to the same state |
| LEA-M | **Private review/approval boundary (round 2, P0-4) — the approver sees the draft; the spine never does.** The inbox is spine-fed, and drafts are PII — so the flow is two-plane: **spine approval item carries only {opaque `draft_ref`, `lead_hmac`, campaign, lint status, `draft_sha`}** · **`arc-leads review <draft_ref>` renders the actual draft locally from the LEA-K store** (dossier evidence alongside, so the approver can check the cited facts) · the approve/reject decision receipt carries the opaque ref + **`draft_sha` — approval binds the EXACT content, and the send-moment guard verifies current draft sha == approved sha; edited-after-approval → refused (evolve candidate_sha discipline applied to outreach)** · **no PII ever passes through argv: raw replies are ingested via file import from the store or stdin (`arc-leads ingest-reply --file`), never pasted as a command argument — shell history and process listings are logs too. Round-3 boundary tightening: `--file` REJECTS any path that resolves inside the repo directory (the import source is the store, not the tree — otherwise "save reply into repo, import it" leaves raw mail sitting in the worktree); and parser/ingest errors are loud about WHERE and WHY (path, offset, reason code) but NEVER echo reply content or excerpts — terminal scrollback is a log surface too.** Fixtures: draft edited after approval → send refused · approval receipt payload contains no draft text · argv-pasted reply content → refused with pointer to --file · `--file` path inside the repo → refused · forced parse error → error output contains zero content bytes from the input |

## Non-negotiables

- Every send human-approved (L1) until an LEA-H promotion is granted — and promotion is
  proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking
  pass on cap enforcement, suppression, the personalization lint, and the reply parser
  (parser-class rule) before any FAIL promotion.
- No purchased lists · no scraped emails from login-walled sources · no fake
  personalization — all three structurally enforced (lint/fixtures), not requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected,
  unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce/complaint.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory:
  keyed HMAC lead ids on the spine (LEA-A); names/emails/drafts/journal only in the
  LEA-K private store outside the repo, tripwire-lint-watched (the repo goes public
  later; git history is forever).
- Spine discipline: standard emitter, reader-only consumption, closed payloads,
  total-preimage idems, `supersedes` corrections, real vs simulated never mixed.
- Zero-dep Node + POSIX; provider behind an interface with a fake (offline-first —
  Phases 0–2 fully buildable with zero real emails).

## No-gos

No volume mode (25-not-2,500 — the daily ceiling is a hard cap in code) · no cold mail
from product/root domains or their subdomains, ever · no sends outside the jurisdiction
allowlist · no auto-send at L1 · no auto-replies (reply handling produces DRAFTS) ·
**no background scheduler/daemon/cron — sequence advancement is a human-started
command; the scheduler module (policy-engine-gated) exists for exactly this, later** ·
**no open/click tracking v1 — no pixels, no wrapped links, no tracking params: opens
are unreliable, pixels hurt deliverability and smell wrong, and reply quality is the
only success metric until it's proven** · no raw email bodies or PII on the spine or in
the repo (LEA-K) · no CRM build-out (the spine + dossiers are the CRM v1; the dashboard
module owns pixels later) · no A/B or self-optimizing logic (evolve owns experiments
later — v1 only tags templates in receipts) · no bought intent data · no mass
enrichment tooling · no multi-channel v1 (email only; LinkedIn = manual drafts) · no
attachments in cold mail (links only — deliverability) · no deliverability tooling
build-out (provider reports suffice v1) · no HTML template engineering (plain-text
first) · no follow-up of any kind after reply, bounce, or unsubscribe.

## Rabbit holes

Perfect ICP taxonomy (one ICP, v1) · email-finder tool cascades (one vetted source +
manual fill for 25 leads) · reply-classification ML (rules + human triage) · send-time
optimization science (fixed IST business window) · CRM feature creep (stages, notes UIs)
· deliverability scoring engines · HTML email design · sequence-length experimentation
(2 touches is the cap; test later under evolve).

## Fixture manifest (must-have, adversarial-pass scoped)

Caps/suppression: 21st submitted send of the IST day refused · 3rd touch inside a
rolling 7-day window refused · send to suppressed lead refused · send after recorded
reply refused · **approved-then-replied → that send permanently blocked at send moment**
· out-of-window send refused · config raised past hard ceiling refused (ask-to-exceed) ·
CLI/env bypass attempt refused · **hand-edited/reset counter state irrelevant — counts
rebuild from receipts (+ unresolved intents); process restart mid-day → identical
counts** · **midnight-IST boundary: 23:59 and 00:01 sends land on the correct days** ·
**provider timeout → retry carries the same idempotency key → exactly one delivery
(fake-proven); ambiguous outcome → message-id lookup before any retry** ·
**crash-after-provider-accept-before-receipt → restart reconcile emits exactly one late
receipt, zero resends, cap counts it** · **crash-after-receipt-before-journal-resolve →
restart resolves the intent from the SPINE: zero provider calls, zero duplicate emits
(spine-first order)** · **crash-before-provider-accept → intent voided, no receipt, cap
slot released** · **crash mid-recovery → re-run converges (recovery idempotent)** ·
**any unresolved intent → all send paths refuse until reconciled** · **draft edited
after approval (sha mismatch) → send refused** · first bounce → HOLD + review item · 2 bounces (or ≥3% at ≥50 lifetime
sends) → campaign FROZEN + incident · spam complaint → FROZEN · unsubscribe →
`lead.suppressed` + same-run effect.
Personalization: zero-specific draft → FAIL (never reaches inbox) · cited fact absent
from dossier → FAIL · missing fact→offer relevance line → FAIL · one-generic-token
draft → BELOW-BAR (WARN on inbox item) · **two drafts ≥X% identical body → BELOW-BAR
similarity flag** · N real cited facts + relevance → PASS · slop markers flagged.
Research lint: purchased provenance → rejected · login-wall provenance → rejected ·
missing geography → rejected · out-of-allowlist geography → rejected · unverified
email → HELD (never sent) · rejected candidate without exclusion reason → invalid.
Receipts/report: duplicate send idem collision impossible · raw email/URL/free-text-PII
in payload → rejected (grammar) · **bare-hash lead id (`h-…`/unkeyed sha) → rejected;
only `lead_hmac_v1_` accepted** · approval receipt payload contains no draft text ·
replay → byte-identical report · corrections supersede.
PII hygiene (LEA-K/M): email-shaped string in a tracked non-fixture file → tripwire
FAILS · non-reserved-domain address in a declared fixture path → FAILS (only
example.com/.test/.invalid pass) · resolved store path in any tracked file → FAILS ·
argv-pasted reply content → refused with pointer to `--file` · `--file` path inside
the repo directory → refused · forced parse error → error output contains zero input
content bytes.
Reply path (on the fake): bounce classified · unsubscribe-in-reply → suppression ·
"interested" → calendar draft within SLA (15:59 → same business day EOD · 16:01 →
next business day 10:00 · Saturday → Monday 10:00, IST) · malformed inbound → parser
refuses loudly by path/offset/reason-code, never by content.
Deliverability gate: live DNS check fails → refused regardless of evidence files ·
stale/undated seed-test evidence (>7d) → refused · Phase-3 entry without seed-inbox
smoke → refused.

## Pre-mortem (top 9)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Domain burned by volume/spam signals | Dedicated domain + warm-up in the PRE-KICKOFF gate + hard caps + breakers (bounce/complaint freeze) + List-Unsubscribe |
| 2 | Generic outreach → 0 replies + reputation cost | BELOW-BAR class with evidence-file citation (absence-only passes are not enough — ADR-0049) + 25-not-2,500 philosophy |
| 3 | Replies rot unanswered | Measurable triage SLA (16:00 IST cutoff / next-day 10:00, clock from ingestion) + inbox surfacing + auto-stop; the daily triage ritual is the manual-mode clock-start |
| 4 | Warm-up physics vs 1-week appetite | Warm-up moved OUT of the appetite into the Pre-kickoff gate (calendar-gated, starts weeks early); cascade rule stops a kickoff on a cold domain |
| 5 | Bad emails → bounce burn | LEA-J verification (HELD when unverifiable) + sample-size-honest breakers (first bounce HOLD; 2 bounces / ≥3%@≥50 / any complaint FROZEN) |
| 6 | Re-contacting an unsubscribed/suppressed person | Event-backed global suppression ledger (HMAC-matched — survives even dossier deletion), checked pre-send, survives campaigns, fixture-proven |
| 7 | PII lands on the spine — or in a repo that later goes public | Keyed HMAC lead ids (dictionary-attack-proof) + payload grammar fixtures + LEA-K store fully outside the repo directory (git history is forever; `git clean` deletes ignored files) + tripwire lint |
| 8 | The human is the bottleneck (L1 = every send waits on Ashiq) | Named out loud: ~15 min/day inbox ritual during a campaign; batch cadence; approvals stalling → campaign auto-PAUSES (never auto-sends); LEA-H defines the earned path to lighter gates |
| 9 | Crash/retry races double-send or slip the cap | LEA-L two-phase journal + reconcile-before-anything + effective counts include unresolved intents + idempotency keys end-to-end (fixture family) |

## Phases

| Phase | Scope | Exit evidence | Appetite |
|---|---|---|---|
| pre | Pre-kickoff gate rows 1–6 (offer · warmed domain · ICP v0 · calendar · capability scout · LEA-I ruling) | All six evidenced; kickoff-lint passes the cascade rule | — |
| 0 — Foundations | **LEA-K first: private store outside the repo + HMAC secret init + tripwire lint (before any PII exists)** · LEA-A vocabulary ADR + typed receipt validators (idem, keyed-id grammar) · LEA-L journal schema · ICP file format · researcher (`arc-leads research`) + dossiers (incl. fact→offer relevance + rejection records) + provenance/geography/verification lint · deliverability preflight LIVE-check gate · provider interface + fake | Hostile research-lint + receipt fixtures green (bare-hash id rejected); tripwire fixture catches tracked email-shaped strings + in-repo store paths; 25-lead run on the fake ICP produces valid dossiers; preflight gate refuses on live-check failure regardless of evidence files | 1.5d |
| 1 — Sequencer | Caps + suppression ledger + send-window + HOLD/FREEZE breakers + receipt-derived state (LEA-D) · **LEA-L send journal + reconcile-on-start** · personalization lint incl. similarity guard (LEA-E) · **LEA-M review boundary: spine-safe approval items + `arc-leads review` local render + sha-bound approvals** · send-moment guard re-check · human-started daily command (no background execution) · **adversarial pass on caps + suppression + journal/reconcile + lint** | Full fixture set green incl. ask-to-exceed, restart, midnight-IST, retry-dedup, crash-after-accept, crash-after-receipt (spine-first), crash-before-accept, crash-mid-recovery, unresolved-intent-blocks, draft-sha drift; a draft cannot reach "approved" without lint verdict recorded; FAIL drafts provably never reach the inbox; approval receipts provably PII-free | 2d |
| 2 — Replies | Reply ingestion (webhook or `--file` manual fallback, store-side only) + parser (adversarial pass, zero-content-echo errors) + triage classes → receipts · SLA calendar-draft path (16:00 IST cutoff rules, clock from ingestion) · auto-stop wired to pre-send check | Reply-path fixtures green on the fake incl. the three SLA boundary cases (15:59 / 16:01 / weekend); triage → inbox drafts demonstrated; error output provably content-free | 1d |
| 3 — Real campaign | Live provider wired (LEA-C pick) · **seed-inbox smoke test passed (REQ-00 Phase-3 entry: inbox placement, headers, unsubscribe, reply+bounce ingestion on owned seeds)** · **the campaign: ≥25 sends / ≥3 days under the daily cap (e.g. 8+8+9 — exact distribution set at kickoff), every send L1-approved** · daily triage ritual · metrics recorded (+ `metric.observed` iff LEA-I) · retro | Campaign report (reader-derived, replay-identical): researched 25 · approved · submitted · **reply rate = unique replying leads / SUBMITTED first touches** (round-2 P1-5 ruling: submitted is always known and provider-independent — "delivered" is only knowable when the provider emits delivery events, so delivery counts MAY be recorded when available but are never the denominator; comparability by construction) · positive-reply rate · meetings · bounce rate · unsubscribes · cap/suppression block + HOLD events · zero violations. **Qualitative retro doc (human-written, not derived): top objections · which personalization evidence actually earned replies · L1-stay recommendation (LEA-H path only via trial ledger)** | 0.5d effort over ≥3d elapsed + 0.5d retro |

**North-star:** one real lead's journey, every hop a receipt: researched with sealed
evidence → a draft that cites two true facts from that evidence and would have FAILED
without them → Ashiq approves it in the inbox → it sends inside every cap from a warmed
dedicated domain → the reply lands, the sequence stops itself before anyone asks → the
"interested" triage puts a calendar-link draft in the inbox within its SLA → the
meeting books, the receipt lands — and at no point could the system have sent one email more
than the caps allow, sent the same mail twice on a retry, mailed a suppressed address,
put a human's raw email on the spine, or committed a name into git history. Replay the
spine and the campaign report reproduces byte-for-byte.

## Changes vs BRIEF (the deviations, on the record)

1. **Warm-up moved OUT of the appetite into the Pre-kickoff gate.** 2–4 weeks of domain
   warm-up is calendar physics that cannot fit a 1-week appetite; the brief's
   "deliverability basics evidenced before send #1" stays, but the domain work starts
   weeks before kickoff, and the cascade rule stops a kickoff on a cold domain.
2. **Personalization gate gains BELOW-BAR + evidence-citation mechanics.** The brief's
   rule ("references nothing specific → FAIL") is an absence-only pass condition —
   ADR-0049's lesson says that cannot detect mediocrity. N cited facts, verified against
   the lead's dossier, makes fake personalization mechanically impossible too.
3. **Email verification + bounce breaker added (LEA-J).** The brief classifies bounces
   after the fact; nothing prevented them. Pre-mortem #1 is mitigated mechanically.
4. **Global suppression ledger promoted to a REQ with fixtures.** "Unsubscribe honored
   instantly" was a no-go line; now it is event-backed state checked before every send,
   surviving across campaigns.
5. **PII hygiene on the spine — keyed HMAC lead ids (`lead_hmac_v1_`).** Started as
   evolve's hashed source_id idea (v0.1), then hardened past it in round 2: bare
   hashes of low-entropy emails are dictionary-attackable on a future-public spine,
   so leads deviates deliberately to HMAC with a private secret. Postdates the brief
   entirely.
6. **Spine-location decision added (LEA-B).** ADR-0059 venture passports postdate the
   brief; "RevOps truth lives on the spine either way" now names WHICH spine.
7. **Jurisdiction allowlist lint (LEA-G).** The brief was silent on geography/regimes;
   cold-email law differs by jurisdiction and the ICP must declare it.
8. **LEA-I conditional EVO-H0 adoption.** PLAN-evolve postdates the brief and pins the
   metric-vocabulary obligation to growth; if leads goes first, the pin moves by owner
   ruling — otherwise leads' campaign starts evolve's trigger clock into a void.
9. **Kickoff prompt gains `--lane leads`** (ADR-0054 postdates the brief) and the lane
   claims its ADR century at birth.
10. **`deal.won`/`deal.lost` demoted to manual CLI emission v1** — closing deals is not
    in the outbound loop's appetite; the kinds exist so revenue truth has a home.
11. **No background execution of any kind (v0.2).** The brief's "runs a capped sequence"
    could be read as a daemon; the module order says the scheduler (policy-engine-gated)
    owns background work later. v1 sequence advancement = human-started daily command.
12. **PII never enters the repo (v0.2, LEA-K).** The brief said no scraped private data;
    the repo-goes-public strategy makes even legitimately-collected lead PII in git
    history a permanent leak. Dossiers live outside the tracked tree, enforced by lint.

## Review round 1 (2026-08-03) — owner suggestions, adjudicated under delegated authority

| # | Suggestion | Ruling |
|---|---|---|
| 1 | Merge engine/develop PRs before lane birth; Mode A only | **ACCEPT** → Current state (ordering precondition; Mode B uncertified reinforces human-started commands) |
| 2 | `--lane leads` kickoff command | Already in v0.1 (Changes #9) |
| 3 | 7-decision lock table (offer/ICP/identity/provider/calendar/vocabulary/privacy) | Already in v0.1 (Pre-kickoff gate + LEA-A/C); privacy row EXTENDED into LEA-K |
| 4 | Two-layer data model (private dossier vs spine receipts) | **ACCEPT + STRENGTHEN** → LEA-K: v0.1 kept PII in "lane workspace files" — that IS the repo, and the repo goes public later. Owner's best catch of the round; dossiers move outside the tracked tree with a hygiene fixture |
| 5 | Re-check caps/reply/suppression at SEND moment; reply-after-approval = permanent block | **ACCEPT** → REQ-03/LEA-D made explicit: approval authorizes an attempt, never a send (TOCTOU closed; was implicit in v0.1's fixture list) |
| 6 | "20 successfully submitted / campaign-timezone day" + rolling 7-day window | **ACCEPT** → REQ-03: submitted-count, IST day + midnight fixture; rolling window replaces v0.1's ambiguous "per week" |
| 7 | Caps state receipt-derived, restart-proof, no counter reset | **ACCEPT** → LEA-D (house replay-derivation philosophy; v0.1 missed it) |
| 8 | Provider idempotency key; retry must never double-send | **ACCEPT** → REQ-03 + LEA-C provider requirement: receipt idem stops double-RECORDING, this stops double-SENDING — distinct failure, real gap |
| 9 | No automatic background follow-ups; human-started daily command | **ACCEPT** → LEA-D + No-gos (scheduler module is policy-engine-gated by the README order — v1 daemon would jump the queue) |
| 10 | Lint-fail drafts never reach the inbox, WARN-first preserved | **ACCEPT-WITH-FIX** → gate split (REQ-02/LEA-E): deterministic FAIL class hard-gates from birth; heuristic classes (BELOW-BAR, slop, similarity) WARN on the inbox item during trial — a blanket hard gate would let one false positive silently kill a good draft and starve the trial ledger of evidence |
| 11 | Cross-draft generic-body reuse detection | **ACCEPT** → LEA-E similarity guard (per-draft checks cannot see template-blast; threshold config, default 70%) |
| 12 | Dossier fields: fact→offer relevance + exclusion reason for rejected candidates | **ACCEPT** → REQ-01 (relevance feeds the lint; rejection audit trail keeps the 25 honest) |
| 13 | Kind names `lead.sent` / `lead.replied` / `lead.suppressed` | **MIXED** → `lead.suppressed` ACCEPTED (cleaner than v0.1's `suppression.added`); `lead.sent`/`lead.replied` REJECTED for `outreach.sent`/`outreach.replied` — the outreach is sent, not the lead (house grammar); `lead.researched` + `deal.lost` KEPT (research provenance + honest revenue truth need homes) |
| 14 | Seed-inbox test (Gmail/Outlook), header/unsubscribe/ingestion live checks | **ACCEPT** → REQ-00 Phase-3 entry smoke test (bridges the fake→real gap cheaply) |
| 15 | Campaign report field list + reply-rate definition | **ACCEPT-WITH-PLACEMENT** → numeric fields in the reader-derived report; objections/what-worked in the human retro doc (a derived report must stay replay-derivable) |
| 16 | No open/click optimization before reply quality proven | **ACCEPT + STRENGTHEN** → No-gos: no tracking at all v1 (pixels hurt deliverability; opens unreliable; reply = the only metric) |
| 17 | 7–10 elapsed days realism | **ACCEPT-AS-CLARIFICATION** → Appetite: 7d cap bounds effort, not wall-clock; elapsed expectation stated |

## Review round 2 (2026-08-03) — owner P0/P1 review, adjudicated under delegated authority

| # | Item | Ruling |
|---|---|---|
| P0-1 | LEA-K contradiction: "outside tracked tree" but example path inside the worktree | **ACCEPT — real contradiction, must-fix.** Store moved fully outside the repo directory (default `~/.arc/leads/`, config). Added rationale the review missed: `git clean -xfd` DELETES ignored files — lead data must never live anywhere git considers disposable. Tripwire lint KEPT with honest framing (detects the common accident; cannot prove prose PII-free — location isolation is the wall, lint is the alarm) |
| P0-2 | `sha256(email)` hex16 is dictionary-attackable | **ACCEPT.** `lead_hmac_v1_<hex32>` = HMAC-SHA256(normalized email, private secret), secret in the LEA-K store. Deliberate, scoped deviation from evolve's `h-` grammar (emails are low-entropy; URLs were a lighter threat class). Suppression HMAC retained after delete-request (his sub-point — without it a deleted contact could be re-contacted). Added beyond the review: secret-loss consequence + backup obligation, `_v2_` rotation path, LEA-I metric source_ids inherit the HMAC form |
| P0-3 | Crash window: provider accepted, receipt not yet written | **ACCEPT — best catch of the round.** LEA-L two-phase journal (intent → submit → receipt → resolve) in the private store + reconcile-before-anything on restart + no sends while any intent unresolved + effective counts include unresolved intents. STRENGTHENED past the review's "pending occupies cap slot": all send paths refuse until reconciled, and the inverse fixture (crash-before-accept → void, slot released) is included |
| P0-4 | Spine-fed inbox cannot display private drafts | **ACCEPT.** LEA-M two-plane boundary: spine carries {draft_ref, lead_hmac, campaign, lint status, draft_sha}; `arc-leads review` renders locally from the store; ingest via --file/stdin only (argv is a log). ADDED beyond the review: **approval binds `draft_sha`** and the send-moment guard verifies it — approve-then-edit is refused (evolve candidate_sha discipline applied to outreach) |
| P1-5 | Denominator ambiguity + bounce threshold at n=25 | **ACCEPT-WITH-STRUCTURE.** Denominator = SUBMITTED first touches, always (delivery events recordable when the provider has them, never the denominator — comparability by construction). Breakers restructured sample-size-honest: first bounce → HOLD (pause + review, human resumes); 2 bounces / ≥3% at ≥50 lifetime sends / any complaint → FROZEN + incident (the evolve lesson: a percentage floor without a sample floor freezes on noise) |
| P1-6 | Evidence-file gate spoofable; warm-up honesty | **ACCEPT.** Gate does LIVE DNS + provider-auth checks through the interface (fake in fixtures); seed evidence must be dated, ≤7d old at campaign start; no fake-engagement warm-up networks (dishonest signals + provider-ToS risk) — warm-up method verified in the capability scout |

## Review round 3 (2026-08-03) — final spec-precision review, adjudicated under delegated authority

| # | Item | Ruling |
|---|---|---|
| 1 | LEA-L missing crash window: receipt emitted, journal not yet resolved → provider-first reconcile would re-emit into a dup-idem error | **ACCEPT.** Recovery order rewritten SPINE-FIRST (5 steps): check the send idem on the spine → exists = resolve intent, no provider call, no emit → absent = provider lookup → accepted = emit exactly once → not-found = void. ADDED beyond the review: the spine-first order makes recovery itself idempotent — crash mid-recovery re-runs safely. New fixtures: crash-after-receipt-before-journal-resolve · crash-mid-recovery converges |
| 2 | REQ-05 `bounce <3%` contradicts REQ-03's HOLD design (n=25: one bounce = 4% → acceptance fails on a reviewed, resumable event) | **ACCEPT — real internal contradiction.** REQ-05 acceptance now: zero cap/suppression violations · zero spam complaints · no FREEZE fired · every HOLD reviewed and resolved before further sends. Bounce rate recorded + fed to retro, never a standalone small-n pass/fail |
| 3 | Tripwire needs an exception model (fixtures hold sample emails); store path must not be tracked; `--file` must reject repo paths; errors must not echo content | **ACCEPT, all four.** Fixture paths: reserved-domain addresses ONLY (RFC 2606 — even fixtures can't hold a real address); email-shaped strings anywhere else FAIL. Store path: runtime env (`ARC_LEADS_STORE`) + default, never tracked config (a personal path is itself a leak). `--file` inside the repo → refused. Parser errors: path/offset/reason-code, zero content bytes — terminal scrollback is a log |
| 4 | "Same day" triage SLA unmeasurable at calendar boundaries | **ACCEPT-WITH-FIX.** His cutoffs adopted as config defaults (before 16:00 IST → same business day EOD; after / weekend → next business day 10:00). THE FIX: the clock starts at INGESTION (webhook receipt or manual import), not mail arrival — the system cannot act on mail it hasn't seen, and without this the fixture is untestable in manual-fallback mode; the daily triage ritual is the manual clock-start |

## Open decisions at kickoff (11)

Exact kind list + closed payloads (LEA-A freeze) · provider + verifier picks from the
capability report (LEA-C/J — idempotency support is a hard filter; warm-up method
honesty verified) · N for BELOW-BAR (default 2) + similarity threshold X (default 70%)
· cap values confirm (20/day · 2/lead/rolling-7d · window; defaults stand unless
argued) · breaker values confirm (HOLD at 1 bounce · FREEZE at 2 or ≥3%@≥50 · seed
evidence ≤7d) · triage SLA values confirm (16:00 IST cutoff · next-day 10:00) ·
jurisdiction allowlist confirm (India-only default) · which offer +
campaign target numbers (sends target, daily distribution e.g. 8+8+9, meeting goal) ·
calendar tool confirm · private-store exact path + backup owner for store AND HMAC
secret (LEA-K) · LEA-I ruling (owner).

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (ONLY after the Pre-kickoff gate is fully evidenced)

```
/arc-kickoff --lane leads leads v1 — outbound engine
Design source: docs/strategy/plans/PLAN-leads.md (approved; pre-kickoff gate evidenced:
offer = <offer>, sending domain <domain> warmed ≥14d + DMARC green, ICP v0 + calendar
link + capability report attached, LEA-I ruled: <leads adopts EVO-H0 | stays with
growth>; tree clean — no unmerged cycle PRs). Read it fully. Decisions LEA-A..M are
locked; assign ADR numbers from the lane's century band (LEA-A extends the ADR-0026
vocabulary — closed payloads, idem formulas, keyed lead_hmac_v1 id grammar; LEA-C is
the ONE shared sending-domain/provider ADR growth later inherits; LEA-K's private
store OUTSIDE the repo + HMAC secret init land in Phase 0 BEFORE any dossier exists).
Caps + suppression + journal/reconcile + personalization lint + reply parser are
parser-class: fixtures before code, adversarial pass before any FAIL promotion —
ask-to-exceed, restart-rebuild, midnight-IST, retry-dedup, crash-after-accept,
crash-after-receipt (spine-first recovery), unresolved-intent, draft-sha-drift, and
reply-after-approval classes included.
Approval authorizes an attempt, never a send: the guard chain re-runs at send moment
against the approved draft_sha. No background execution — sequence advancement is a
human-started daily command. Every send is L1 until an LEA-H proposal is granted.
Designated cuts in order: inbound webhook → manual ingest; triage auto-class → manual.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```
