# PLAN (design source) — ops v1: the keep-it-running engine

> **v1.1 build-out edition (2026-08-10).** Expanded from `BRIEF-ops.md` through
> repo-grounded analysis + two owner-review rounds (2026-08-03), then re-grounded against
> the repo as of 2026-08-10 before landing (the world moved: Constitution adopted, policy
> engine live, `metric.observed` law, scheduler plan ready — every delta is folded in
> below). Landed owner-instructed 2026-08-10; decisions OPS-A…M named as letters, real
> ADR numbers at kickoff from the century claimed per `PORTFOLIO.md`. `BRIEF-ops.md`
> superseded → moved to `docs/archive/` in the same drop (never deleted; marked in the
> strategy file map).
>
> **Trigger converted to FIRED under the owner's Build-out Mandate (2026-08-09 — same
> `decision.recorded` as strategy-README correction #15, cited by the kickoff ADRs;
> A8's letter kept).** Honesty note: the brief's pull (≥2 live ventures OR >5
> tickets/week) has NOT organically fired and no receipt is invented — one venture
> exists (lexos, paused, its deployed URL still serving) and support volume is ~0. The
> machinery builds now under the mandate; **the original pull survives as the
> live-value milestone**: REQ-05's "guarding ≥2 live ventures for a real week" row
> stays OPEN-at-venture-2 (the C2 REQ-07 closure pattern — mechanism proven, live
> value pending), and drills carry the proof until reality does.

## Goal

One sentence: the boring guardian — registry-driven health sweeps over every registered
surface with incidents as first-class receipts (raise → resolve, surfaced in the daily
brief until closed), L1 support triage whose replies are drafted but never sent by the
machine, and a weekly per-venture health report rendered from the spine reader alone —
**proven by drills before the first real fire, and quiet by design: no pushes, no pages,
the brief is the pager.**

## Current state (verified in-tree 2026-08-10 — re-verify at kickoff)

- Spine LIVE: standard emitter (`arc-event.mjs`, dual-mode ADR-0031), reader
  (`spine.mjs`), inbox (`arc-inbox.mjs` approve/reject working), daily brief renderer
  (`arc-brief.mjs`, SPINE-G reader-only, 40-line budget).
- **Constitution is LAW** (v1.0 adopted 2026-08-06, receipt `01KZ9V0QXNNMB3ZH18MSH8DKH3`,
  ADR-0073) — A5 extend-don't-duplicate, A6 human-merge, A8 (letter kept via the
  mandate), A9 live-slot all bind this plan for real, not as draft courtesy.
- **`incident.raised` ALREADY EXISTS** in the closed vocabulary and is already mapped to
  the brief's **needs-you** group. The rails are half-laid.
  **`incident.acknowledged` / `incident.resolved` do NOT exist** (verified against live
  `KINDS` 2026-08-10 — the closed set now spans core + experiment + leads + policy +
  `constitution.adopted`; per the ADR-0107 rule, counts below are stated against live
  `KINDS.length`, never hardcoded).
- **`metric.observed` is LAW — ADR-0408 (leads' cycle, the LEA-I contingency of
  strategy-README correction #11).** Ops needs NO metric vocabulary work — it conforms
  to the live validator (spec source: PLAN-evolve REQ-00). Note the honesty boundary:
  evolve's 4-week trigger clock belongs to **growth's GSC feed** (PLAN-growth REQ-05);
  ops' uptime stream is a SECOND honest metric stream, not the trigger.
- **Policy engine is LIVE** (policy C9, merged `677b67e` / PR #130, 2026-08-08; all five
  phases closed 2026-08-10). Consequences: new action kinds carry `hq.policy.yaml` rows
  in the same change (POL-I birth rule); ops' L1 support-draft ceiling is POL-G
  enforcement, not an honor-system note; promotions ride
  `approval.requested` → `decision.recorded` → `policy.level.changed`, human-only.
- **`PLAN-scheduler.md` is ready (converted 2026-08-09).** Its v1 job list already names
  a `lexos-canary` candidate; jobs are `hq.jobs.yaml` rows, script-jobs ₹0, ZERO
  scheduler-layer retries (ADR-0203/0204 own the ladder). The ops sweep is designed
  here as a future script-class job — see OPS-M for the boundary and the canary-job
  coordination rule.
- **`PLAN-leads.md` PII law on record** (private store OUTSIDE the tree + keyed
  `lead_hmac_v1` ids + SHA-bound L1 approvals; PLAN-ledger's LED-C already reapplied it
  to money). OPS-E reuses that machinery for support tickets — third application, same
  law, A5.
- **`arc-brief` is day-scoped** — an incident raised yesterday and still open is
  invisible today. REQ-03's cross-day surfacing is real extension work, not wiring.
- **`/arc-canary` emits NO spine events** — it writes incidents to `docs/canary/*.md`
  and acts (rollback) on regression. As-is, REQ-04's "canary history from the spine
  reader only" is impossible; OPS-D resolves it.
- Venture passports (ADR-0059/0061): lexos only — paused, deployed surface still
  serving; passports minimal by design, no URL/check columns (registry lives elsewhere,
  OPS-A).
- Lanes are law (ADR-0054): `--lane ops`; NEW lane — claims the next free ADR century
  per `PORTFOLIO.md` (0700s as of this writing; the board is the authority, never this
  file). Lane vocab shapes follow the established module pattern
  (`validate-leads.mjs` / `validate-policy.mjs` → `validate-ops.mjs`).
- **Mode B NOT CERTIFIED** (ADR-0056): concurrent emitters forbidden. The sweep is an
  emitter → one sweep session at a time, Mode A discipline.
- Balanced model policy (ADR-0069, + the executor amendment when it lands): seat tiers
  apply to ops' two LLM seats.
- **C2 retro lesson on record:** emit-path idem carries time, so re-runs do NOT
  auto-dedupe. Callers that know a logical identity supply `--idem` (arc-inbox
  precedent). The sweep is exactly such a caller — OPS-G is designed against precisely
  this class.
- Evidence grammar: repo-relative POSIX path ≤512 bytes. `scanSecrets` guards event
  payloads but **evidence FILES bypass the scanner today** — ops is evidence-heavy, so
  the gap closes here (non-negotiable below).
- The repo is headed public (SaaS direction): anything committed, and everything on the
  append-only spine, is eventually public. PII containment is load-bearing, not hygiene.

## Kickoff gates (verify ALL before pasting the prompt)

| # | Gate | Evidence |
|---|---|---|
| 1 | Build-out Mandate receipt | The 2026-08-09 `decision.recorded` (correction #15's receipt) cited in the kickoff ADRs |
| 2 | Live slot free (A9) | Absorb C10 / leads C8 / policy C9 tails resolved or parked per the board — one live cycle rule holds |
| 3 | Century claim | Next free band per `PORTFOLIO.md` at kickoff (0700s as of 2026-08-10) |
| 4 | Policy engine live re-verified | POL enforcement fixtures green at HEAD — POL-I rows in this cycle depend on it |
| 5 | Support inbound named | Mail-export method + private-store path decided (OPS-E open value) — or REQ-02 explicitly re-scoped at approval |

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-00 *(only if OPS-C = IN)* | Ops uptime becomes an honest metric stream | Per-venture uptime emitted as `metric.observed` **conforming to the LIVE ADR-0408 validator** (spec source PLAN-evolve REQ-00: closed payload, total-preimage idem, absent optionals = `-`, source_id grammar; deviations flagged back to PLAN-evolve, never absorbed). successes/trials per venture per day window; window COMPLETE only on strict idempotent emission — MISSING never zero (fixture). **Clock honesty: this stream does NOT start or feed evolve's 4-week trigger — that is growth's GSC feed (PLAN-growth REQ-05)** | 1 |
| REQ-01 | Every registered surface checked in one run; failures become receipts, not vibes | `arc ops sweep` reads the registry (OPS-A) and runs tier-1 deterministic checks per venture (HTTP status, cert days-remaining, error-page keyword, latency) — **zero LLM, zero browser**. Per-check retry ×2 with backoff before any raise (fixture: fail-then-pass → no incident). Failures → `incident.raised` with sev + signature + canonical JSON evidence (screenshot optional, never canonical). **Idempotent via explicit `--idem` (OPS-G): same open failure re-swept → `DUP_IDEM` no-op; resolved-then-recurs → NEW incident** (fixtures both directions). **Flood control:** >FLOOD_N distinct failures in one run → ONE sev1 meta-incident ("sweep environment suspect"), zero individual raises (fixture). Every sweep — all-green included — ends with a `run.completed` heartbeat carrying summary counts | 0 |
| REQ-02 | Support inbound triaged; replies drafted, never sent | File-drop inbound (mail export v1) → classified into **closed enums** (OPS-K: type × sentiment × urgency, `other` allowed) → reply DRAFT in the **private store outside the tree** (OPS-E — the PLAN-leads PII law); `approval.requested` carries keyed ticket id + class + content-hash + draft_sha — **ticket bodies and drafts never land in payloads, evidence, or any committed file** (grep fixture). Injection containment per OPS-K (adversarial corpus green). Nothing auto-sends; sending = the human's approve (SHA-bound to the exact draft, the leads pattern), and the L1 ceiling is **policy-enforced** (POL-G) | 2 |
| REQ-03 | Incidents have a loop, and open ones cannot be forgotten | raise → (optional ack = nag suppressor) → resolve, threaded by `incident_id` = the raise ULID (decides-pattern; resolve idem bound to it, exactly-once — fixture: double-resolve collides). Manual resolve carries `label: real \| false-alarm`; auto-resolve on observed recovery (if OPS-L = IN) carries `auto-recovered`. **Brief extension: cross-day open-incident fold** — an unresolved incident appears in needs-you EVERY day until resolved (or acked, which downgrades the nag), >24h age printed (fixture: raised day-1 → visible day-2). Drill incidents render with a drill marker, never mixed with real | 1 |
| REQ-04 | One honest screen per venture per week | Weekly report, **spine reader only** (grep-lint): uptime % from real denominators (heartbeats / REQ-00 metrics — never failures-only), incident counts by label (real/false/auto-recovered), tickets by class + first-response time (approve ts − ticket ts) + sent-as-is/edited/rewrote rates, canary history **via canary's own spine events** (OPS-D), ops cost line (`cost.incurred`), alert precision + budget usage, unclassified-rate. ≤1 screen per venture; a day with no sweep renders **MISSING, never 100%** (fixture). Replay → byte-identical (fixture) | 3 |
| REQ-05 | The guardian is proven, not assumed | **7 consecutive calendar days** guarding lexos' deployed surface + one arc-owned surface, with: ≥2 **drill** incidents (one sweep-raised, one support-ticket drill) traced end-to-end raise → brief → human action → resolve, receipts at every hop; every REAL incident that week traced the same way; ≥1 ticket (real or drill) through classify → draft → human send. An unacknowledged drill older than 72h is itself a retro finding (the drill tests the human loop too). **The brief's original "≥2 LIVE ventures" row stays OPEN-at-venture-2 — the live-value milestone, never closed by drills** (C2 REQ-07 pattern) | 4 |

## Appetite

**6 build-days hard cap (Phases 0–3) + a 7-calendar-day validation window (Phase 4,
~1 day of attention spread across it).** The validation window is calendar physics, not
build effort — the evolve "runway" precedent: it runs while the owner works other lanes.
**Designated cut #1 = OPS-C (the `metric.observed` uptime stream).** Burn pressure →
fall back to `run.completed` denominators (already in REQ-01); the cut is recorded.
Cheaper than it was in v1.0 — the vocabulary already exists — so cutting it now saves
conformance + fixtures only (~0.5d).
**Designated cut #2 = the sentiment axis in triage** (type + urgency survive).
**Never cut:** sweep + idem discipline + PII containment + the cross-day fold — they are
the module.
**Kill criteria:** 50% burnt without REQ-01's idem/flood fixtures green → the identity
formula is wrong at the mechanism level — stop, redesign the preimage on paper, retro
(the C2 lesson: test the mechanism, not the symptom). Cross-day fold can't reproduce
byte-identical on replay after 1 day of fixes → SPINE-G is being fought — stop, retro.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| OPS-A | **Registry = ops-owned config file** (`products/ops/registry.json`), not a passports extension — passports stay minimal by design (ADR-0059/0061 untouched). Closed schema per venture: slug (must match `VENTURE_RE`), base_url, allowed_domains[], checks[] (typed: http-status / cert-days / keyword / latency, each with params), cert_min_days, sla_hours, support drop-dir key. `registry-lint` hard-fails unknown fields (product-lint precedent, hostile corpus). **Adding venture #2 = one config row, zero code.** New check TYPES = ADR, not a patch — that is the anti-hobby ceiling |
| OPS-B | **Incident vocabulary micro-ADR: +2 kinds against live `KINDS.length`** (ADR-0107 derived-count rule; ledger's `month.closed` precedent): `incident.acknowledged` + `incident.resolved`, closed payloads, shapes in a lane module (`validate-ops.mjs` — the validate-leads/validate-policy pattern). `incident.raised` payload gains a closed **ops profile**: {check, sev(1\|2\|3), signature, mode(real\|drill), first_seen_day, summary}. Threading: `incident_id` = raise ULID; **resolve idem = sha256("incident.resolved\|" + incident_id)** (assertDecision template — exactly-once, double-resolve collides). Severity escalation = new raise superseding the old (`supersedes`), same signature + first_seen_day. Brief groups: resolved → progress, acknowledged → background (raised stays needs-you). **`hq.policy.yaml` rows for the new action kinds land in the SAME change (POL-I; policy C9 live)** |
| OPS-C | **Uptime as `metric.observed` (RECOMMENDED IN; owner may flip at approval).** The vocabulary is ALREADY LAW (ADR-0408) — ops does zero vocabulary work; it CONFORMS: per-venture uptime successes/trials per day window, emitted through the live validator to PLAN-evolve REQ-00's frozen spec (deviations flagged back, never absorbed). **Honesty boundary: this stream is NOT evolve's trigger feed** — growth's GSC ingest owns that clock (PLAN-growth REQ-05); ops' stream is a second honest metric surface (dashboards, future evolve baselines). **If OUT:** `run.completed` heartbeat counts are the report's denominator; payload field names mirror the metric spec so a later lift is a transform, not a redesign |
| OPS-D | **Canary → spine unification (A5: extend, never fork).** `/arc-canary` additionally emits via the standard emitter: `incident.raised` (ops profile, mode real, check `canary-<route>`) on regression, `run.completed` on a green window. `docs/canary/*.md` demote to evidence artifacts; REQ-04 reads canary history from the spine alone. **The asymmetry stays on record: canary ACTS (deploy-time guard may rollback); the ops sweep NEVER remediates (runtime observer, report-only)** |
| OPS-E | **Support inbound + PII containment = the PLAN-leads PII law, third application** (leads → ledger LED-C → here; A5 — reuse its machinery, never a parallel scheme). v1 inbound = file-drop dir (mail export .eml/.txt) in the **private store OUTSIDE the tree** (leads-pattern location + keyed HMAC ticket ids); ticket bodies and reply drafts live ONLY there. The spine receives keyed ticket id + classification + sha256 content-hash + draft_sha — never bodies, names, or addresses; event `evidence` stays null for ticket-bearing events (the store, not the repo, holds the text). An **ops PII lint** greps ops-emitted payloads/evidence for body leakage (fixture-backed). Rationale: the spine is append-only and the repo goes public — what it never receives it never has to erase |
| OPS-F | **Severity + surfacing + alert budget.** sev1 (surface down / money flow broken) → needs-you, same brief. sev2 (degraded, cert <7d) → needs-you, next brief. sev3 (heads-up, cert <30d) → weekly report only. Alert budget in config (default: ≤5 ops needs-you items/week); v1 the report PRINTS budget usage + precision and the human judges — budget-blown automation is parked (v1.1) |
| OPS-G | **Idempotency formula (the load-bearing decision).** Sweep supplies `--idem = sha256("ops.incident\|" + venture + "\|" + check + "\|" + signature + "\|" + first_seen_day)`. `signature` = stable failure class (http-5xx, cert-expiring, keyword-missing…). `first_seen_day` = the day the CURRENT failure streak began, derived from the open-incident fold: an OPEN incident with the same venture+check+signature → reuse its first_seen_day (→ same idem → `DUP_IDEM` no-op); last matching incident RESOLVED → today is a new first_seen_day (→ new incident). **Recurrence after resolve = new incident by construction; an open streak never duplicates.** Both directions fixture-proven — designed on paper before code (C2 mechanism lesson). **Flood control:** >FLOOD_N (default 5) distinct failures in one run → ONE sev1 meta-incident, individual failures only in the heartbeat summary |
| OPS-H | **Model seats + the LLM-free rule.** Scheduled paths (sweep, report render) are LLM-free **by construction** — always-on cost ≈ ₹0; cost scales with tickets, not time. Two LLM seats only (ADR-0069): triage classifier = cheap-scan tier; draft writer = balanced-workhorse. Triage runs emit `cost.incurred`. No other LLM entry points exist in ops v1. **The L1 draft ceiling is enforced by the live policy engine (POL-G), not by convention; promotion = trial-ledger evidence → human `decision.recorded` → `policy.level.changed`** |
| OPS-I | **Drill mode.** `--drill` injects synthetic failures/tickets; every resulting receipt carries `mode: drill`; brief + report render drill separated and never sum real with drill (the revenue real-vs-simulated discipline, applied to incidents). Drills are REQ-05's proof mechanism — and they test the HUMAN loop: an ignored drill is a finding, not a pass |
| OPS-J | **Heartbeat + staleness.** Every sweep ends with `run.completed` {ventures, checks, failures, duration}. The brief's ops section prints last-sweep age; age > STALE_H (default 24h) → a reader-side "guardian asleep" needs-you line — a DETERMINISTIC reader derivation relative to the rendered day (the scheduler plan's missed-run rule; wall-clock banned so replay goldens survive). **The absence of a heartbeat is itself the signal — quiet and asleep must never render the same** (the C2 torn-lines principle, applied to ops) |
| OPS-K | **Triage taxonomy + injection containment.** type ∈ {bug, billing, question, **other**} · sentiment ∈ {calm, frustrated, angry} · urgency ∈ {low, normal, high}. `other` is allowed and its weekly rate is surfaced — a rising unclassified-rate means the taxonomy needs revision, never force-fitting. Classifier output = closed JSON, validated; anything outside the enums → `other`, never an invented class. Containment: inbound stripped to plain text; classifier context has ZERO tool access; drafts are template-locked (greeting/body/signoff), carry a provenance line naming source docs, visibly quote ticket-derived text, and a deny-list lint refuses drafts containing approval/money-action language. Inbound mail is UNTRUSTED INPUT — the .eml parser and classifier I/O validator are parser-class → adversarial pass before any FAIL promotion |
| OPS-L | **Resolve semantics (RECOMMENDED: auto-resolve IN; owner may flip).** Manual resolve mandatory for real incidents, with `label: real \| false-alarm` (one word — this feeds the precision ledger). Auto-resolve on sweep-observed recovery allowed with `auto-recovered`; the weekly report lists auto-recovered incidents for one-line batch adjudication so precision data is never lost. The >24h nag applies to OPEN unacked incidents; ack suppresses the nag without closing anything |
| OPS-M | **Scheduling boundary + scheduler alignment.** Ops builds NO scheduler and NO in-process timer. The sweep is an idempotent, non-interactive, clean-exit CLI — **a script-class ₹0 job by design**, shaped for an `hq.jobs.yaml` row (idem = job@slot lives at the scheduler layer; ops' retry-before-raise is CHECK-level inside one run — compatible with the scheduler's ZERO-retry law, ADR-0203/0204). Until scheduler P2 lands, sweeps run attended (manual / owner-side OS scheduling). **Coordination rule: PLAN-scheduler's `lexos-canary` v1 job candidate and the ops sweep overlap — whichever cycle runs SECOND reconciles them into one registered job (sweep subsumes the candidate; canary stays deploy-time), recorded in that cycle's ADRs** |

## Non-negotiables

- Extend `arc-canary`, never fork it (Constitution A5 — law, not draft).
- Reader-only for every renderer (SPINE-G; the grep-lint applies to every new ops
  script). The standard emitter is the only writer.
- Support replies stay L1 (drafts) — **enforced by the live policy engine (POL-G)**;
  promotion only via trial-ledger evidence + human decision + `policy.level.changed`.
- **No push notifications, no pages, no PagerDuty-class infra.** The daily brief batches
  everything — deep work is protected by design; interruption is not a feature.
- No auto-remediation from the sweep — report, don't touch. (Auto-resolve under OPS-L is
  state RECORDING of an observed recovery, not remediation; the distinction is on the
  record.)
- Venture creds in their own env files; never centralized, never committed.
- **No PII on the spine or in committed files, ever** — the PLAN-leads private-store law
  (OPS-E); the spine carries keyed ids, classes, hashes (public-repo assumption).
- **LLM-free scheduled paths** (OPS-H) — the guardian's always-on cost is ₹0.
- Single-emitter sessions: no parallel sweeps (Mode A; ADR-0056 — Mode B stays
  not-certified).
- Real vs drill never mixed, rendered, or summed together.
- **Evidence writes pass `scanSecrets` before landing** — a scan that cannot complete →
  stub-only (closes today's evidence-file gap; ADR-0028 spirit extended to files).
- Parser-class adversarial pass before FAIL promotion: registry parser, .eml/inbound
  parser, classifier I/O validator. All new lints WARN-first in TRIAL.
- New action kinds carry their `hq.policy.yaml` rows in the same change (POL-I).
- Zero-dep Node ≥18, POSIX paths, IST timestamps — house style.

## No-gos

No PagerDuty/status-page/push infra (push revisit-trigger: first paying customer — and
then still a debate) · no auto-remediation v1 · no scheduler/daemon/timer build (OPS-M;
the scheduler module owns registration) · no metrics DB/warehouse (the spine is the
store) · no multi-vantage probes v1 (the retry ladder is v1's answer to "was that
real?") · no auto-send at L1, ever · no FAQ auto-publish (deflection proposals are
v1.1) · no browser automation in tier-1 checks (tier-2/canary territory) · no new deps
for HTTP/cert checks · no ticket bodies on the spine or in the tree · no centralized
creds · no alert-rule DSL · no new metric vocabulary (ADR-0408 is law — conform, never
fork).

## Rabbit holes (named so they stay unexplored)

The monitoring-tool hobby (the registry schema is the ceiling; new check types = ADR) ·
perfect email parsing (v1 = plain-text export; weird MIME → `other` + manual) ·
sentiment-model perfection (three buckets, move on) · dashboard pixels (the dashboard
module owns pixels later; the report is text) · SLA math elegance (one response-time
number) · retry/backoff tuning theater (2 retries, fixed backoff, done) · uptime-%
methodology debates (denominator = heartbeat-observed checks; stated, not argued) ·
re-deriving PII machinery leads already built (reuse, A5).

## Fixture manifest (must-have, adversarial-pass scoped)

Registry: unknown field → exit 2 · bad venture slug → rejected · missing/empty registry
→ loud error, never a silent empty sweep.
Sweep + idem: same open failure re-swept → `DUP_IDEM`, exactly one incident · resolved
then recurs next day → NEW incident (new first_seen_day) · open streak spanning days →
same idem via fold-derived first_seen_day · sev escalation → supersedes, thread intact ·
transient (fail, pass on retry) → NO incident · flood (FLOOD_N+1 failures) → exactly ONE
meta-incident, zero individual raises · heartbeat emitted on all-green.
Loop + brief: raised day-1, unresolved → visible in day-2 needs-you with age · ack
suppresses the nag, incident still open · double-resolve → `DUP_IDEM` · drill renders
marked, never summed with real · sweep-gap > STALE_H relative to the rendered day →
"guardian asleep" line (deterministic, replay-stable) · brief replay → byte-identical.
Triage + PII: injection corpus ("ignore instructions…", HTML payloads, oversized mail)
→ class stays in closed enums, template intact · unknown classifier output → `other` ·
draft containing money-action phrase → refused · **ticket-body string appears in ZERO
spine/committed bytes (grep fixture)** · ticket-bearing event with non-null evidence →
refused by the ops PII lint · evidence with a planted secret → scan catches it, stub
lands.
Report: replay → byte-identical · uptime matches fixture heartbeat counts exactly · a
MISSING sweep day renders MISSING, never 100% · auto-recovered batch listed for
adjudication.
*(If OPS-C = IN: conformance fixtures against the LIVE ADR-0408 validator — same-window
re-ingest idempotent · corrections supersede · window COMPLETE only on strict emission ·
ops' fields map cleanly to PLAN-evolve REQ-00's spec or the deviation is flagged back.)*

## Pre-mortem (top 8)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | False alarms train the owner to ignore the guardian (the classic monitoring death) | Retry-before-raise + deterministic tier-1 checks + flood control + severity tiers + precision ledger (resolve labels) + alert budget printed weekly — alert quality is a REQ, not a hope |
| 2 | Wrong-tone or injected drafts erode trust / social-engineer the owner | Template lock + zero tool access + provenance + visible quoting + deny-list lint + human send (policy-enforced L1) + sent-as-is/edited/rewrote tracking (honest resolution % vs the blueprint's 45–55% benchmark) |
| 3 | Ops becomes a monitoring-tool hobby | Config-schema ceiling (OPS-A) + no-gos + 6d cap + two designated cuts |
| 4 | **PII lands on the append-only, eventually-public spine** (irreversible-harm class) | The leads private-store law reused (OPS-E) + grep fixtures + the ops PII lint — enforced in code, not remembered |
| 5 | Idem formula wrong → real incidents silently deduped (the C2 lost-receipts class, inverted) | OPS-G designed on paper first; fold-derived first_seen_day; fixtures in BOTH directions (streak dedupes / recurrence doesn't) |
| 6 | A quiet validation week proves nothing (validation theater) | Drill mode is REQ-05's proof mechanism — the loop is exercised on demand, and an ignored drill is a finding about the HUMAN loop; the ≥2-live-ventures row stays honestly OPEN |
| 7 | The sweep itself dies silently — guarded ventures, unguarded guardian | Heartbeat + deterministic reader-side staleness line: absence is a signal; quiet and asleep never render the same |
| 8 | Evidence snapshots leak secrets (stack-trace error pages) | Evidence writes pass `scanSecrets`; incomplete scan → stub-only (ADR-0028 spirit extended to files) |

## Phases

| Phase | Scope | Exit evidence | Appetite |
|---|---|---|---|
| 0 — Registry + sweep | OPS-A schema + `registry-lint` (hostile corpus) · tier-1 checks + retry ladder · OPS-G idem + flood control · heartbeat | Registry + sweep + idem/flood fixtures green; a real sweep of lexos' deployed surface runs clean end-to-end | 1.5d |
| 1 — Incident loop + brief | OPS-B micro vocab ADR + `validate-ops.mjs` + `hq.policy.yaml` rows (POL-I) · (+ OPS-C ADR-0408 conformance if IN) · cross-day open-incident fold + ops brief section (age, nag, staleness, drill markers) · OPS-D canary extension | Loop fixtures green; day-2 visibility fixture; brief replay byte-identical; canary emits on the spine | 1.5d |
| 2 — Support triage | Drop-dir ingest + .eml/plain parsing · classifier + draft seats (OPS-H tiers) · leads-law private store + keyed ids + hash-on-spine (OPS-E) · template/deny-list lints · inbox wiring (SHA-bound approvals) · **adversarial pass on the injection corpus** | Triage + PII fixtures green (incl. the grep fixture); a drill ticket flows classify → draft → approve | 1.5d |
| 3 — Report + drill harness | Weekly reader-only report (denominators, labels, precision, cost, response time, MISSING) · drill injector (sweep + ticket drills) | Report replay byte-identical; both drill types trace end-to-end with receipts | 1.5d |
| 4 — Validation window | 7 calendar days guarding lexos' surface + one arc surface; ≥2 drills; daily brief ritual; **retro at close** (runs regardless of how quiet the week was) | REQ-05 evidence bundle; retro logged; trial-ledger rows for alert grades + the POL-G promotion path opened | ~1d attention across the window |

## North-star

One real week where the guardian earns its name: every morning the brief opens with
"last sweep 6h ago, all green" — and the day the drill fires, the incident is in
needs-you before the coffee is done, with a JSON snapshot as evidence, a one-line ack
silencing the nag, and a resolve receipt closing the thread; the support drill's angry
billing mail becomes a calm, template-locked draft with its sources named, sent only by
a human hand under a policy engine that would refuse anything more; Sunday's report
shows real uptime with a real denominator, one screen per venture, drills and reality
never blurred — **and at no point did the machine send a word to a customer, touch a
venture, page a phone, or put a byte of anyone's personal data where it can never be
deleted.**

## Changes vs BRIEF (the deviations, on the record)

1. **The pull-trigger is converted under the owner's Build-out Mandate** (2026-08-09,
   correction #15's `decision.recorded`, cited by the kickoff ADRs; A8's letter kept).
   No organic trigger receipt exists and none is invented; the original pull survives
   as REQ-05's OPEN live-value row.
2. **REQ-5 amended:** "one real week guarding ≥2 ventures" is physically impossible
   (one venture, paused). Amended to lexos' deployed surface + one arc-owned surface +
   mandatory drills — drill mode (OPS-I) is load-bearing, not decorative; the original
   row stays OPEN-at-venture-2.
3. **Kickoff prompt gains `--lane ops`** (ADR-0054 post-dates the brief); NEW lane,
   century per `PORTFOLIO.md`.
4. **REQ-4's internal contradiction resolved:** "spine reader only" + "canary history"
   was impossible while canary wrote only markdown — OPS-D makes canary a spine emitter.
5. **The uptime-denominator hole named and closed:** failures-only events cannot yield
   uptime %; heartbeats (and OPS-C's ADR-0408-conformant metrics) carry the denominator.
6. **The metric vocabulary question dissolved between drafts:** v1.0 (2026-08-03)
   carried EVO-H0 into ops; by landing (2026-08-10) `metric.observed` was already law
   (ADR-0408, leads' cycle) and the evolve trigger feed is growth's (PLAN-growth
   REQ-05). OPS-C is now pure conformance — no vocabulary work, no clock claim.
7. **Hardening absent from the brief:** PII containment via the leads private-store law
   (OPS-E), injection containment (OPS-K), evidence secret-scan, flood control + retry
   ladder, the OPS-G idem formula, severity tiers + alert budget (OPS-F), drill mode
   (OPS-I), heartbeat/staleness as a deterministic reader derivation (OPS-J), LLM-free
   scheduled paths + policy-enforced L1 (OPS-H), auto-resolve semantics (OPS-L),
   single-emitter note (Mode A), POL-I policy rows, scheduler-job alignment + the
   lexos-canary coordination rule (OPS-M).
8. **Triage taxonomy restructured:** "angry" moved from class to sentiment axis;
   `other` added as the escape valve with its rate surfaced.
9. **"Support replies L1 until trial-ledger promotes" got teeth:** the policy engine
   (C9, live) enforces the ceiling; promotion is a receipted human path, not a habit.

## Open decisions at approval (owner — flip any of these before kickoff)

OPS-C in/out (uptime as `metric.observed` conformance vs heartbeat-only — IN
recommended) · OPS-L auto-resolve allow/deny (allow recommended) · config values: alert
budget (≤5/wk), FLOOD_N (5), STALE_H (24h), cert thresholds (7d/30d) · registry + code
home confirm (`products/ops/` recommended) · support inbound mechanics (mail-export
method + private-store path — gate #5) · the second guarded surface for REQ-05 (arc
public site when growth builds it / repo CI health / owner's pick).

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the gates table is verified)

```
/arc-kickoff --lane ops ops v1 — keep-it-running engine
Design source: docs/strategy/plans/PLAN-ops.md (approved v1.1, build-out edition).
Trigger = the owner's Build-out Mandate (2026-08-09) — cite that decision.recorded in
the kickoff ADRs (A8's letter kept; honesty note per the plan header: the original
pull survives as REQ-05's OPEN live-value row). Verify the five kickoff gates first —
live slot free (A9), century claim per PORTFOLIO.md, policy enforcement fixtures
green. Read the plan fully. Decisions OPS-A..M are locked (OPS-C and OPS-L as
approved); OPS-B is a micro vocab ADR (+2 kinds against live KINDS.length, shapes in
validate-ops.mjs, hq.policy.yaml rows in the same change per POL-I); OPS-C conforms
to the LIVE ADR-0408 metric.observed validator — no new vocabulary, no evolve-clock
claim. The OPS-G idem formula and OPS-E PII containment (the PLAN-leads law, reused)
are load-bearing — fixtures before code, both directions. Extend arc-canary, never
fork (A5). LLM-free scheduled paths; L1 draft ceiling is policy-enforced (POL-G).
Parser-class adversarial pass on registry, inbound parsing, classifier I/O. STOP
after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```
