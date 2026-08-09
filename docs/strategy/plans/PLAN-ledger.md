# PLAN (design source) — ledger module · "the money brain" — v1.0 DRAFT

> **Status: READY FOR KICKOFF — owner-approved 2026-08-09.** v1.0, produced from
> `BRIEF-ledger.md` v1.1 + the live-repo grounding below over four review rounds
> (2026-08-03 → 2026-08-09, Cowork planning session). Supersedes the brief on every
> point where they differ — `BRIEF-ledger.md` → `docs/archive/`, never feed it to a
> kickoff.
> **Trigger converted to FIRED under the owner's Build-out Mandate** (2026-08-09 —
> same `decision.recorded` as strategy-README correction #15, cited by this kickoff's
> ADRs; A8's letter kept). **Honesty note:** the live spine's money side is zero events
> and none are invented — real views render honest-empty until the first real ₹;
> fixtures + `revenue.simulated` carry the proof burden. The old pull-trigger
> ("≥2 revenue sources") survives only as the **live-value milestone**, and closure
> uses the C2 REQ-07 pattern: **mechanism proven, live value pending.** Real P&L views
> never contain a simulated rupee, by construction.

## Grounding (verified against the live repo + spine, 2026-08-09 — re-verify at kickoff)

- Spine **LIVE** since 2026-07-23, events through 2026-08-06 (hq CLIs exist:
  `arc-event`, `arc-brief`, `arc-inbox`, `arc-replay`, `spine` reader). Ingest path
  `arc-event ingest <kind> --json F` exists (C2 REQ-03), content-idem dedupe proven
  (same payload twice = one receipt).
- Live spine money side is **completely dark** (re-verified 2026-08-09): 0
  `revenue.received`, 0 `revenue.simulated`, 0 `run.completed`, 0 `cost.incurred`.
  Ledger's real views start from real zero — honest, and exactly why fixtures carry
  the proof burden.
- **REQ-08 (cost) was CUT in Cycle 2 — owner's call** (`docs/archive/PROGRESS-2026-07-28.md`
  L74). This module is its named revival (org-blueprint role #49, "agent payroll").
- **The Constitution is LAW** (v1.0 adopted 2026-08-06, receipt
  `01KZ9V0QXNNMB3ZH18MSH8DKH3`) — A-articles below are cited as law, not draft.
- The closed event vocabulary is **live and growing** — state counts against
  `KINDS.length`, never hardcode (ADR-0107 derived-count rule; 31 at the 2026-08-04
  policy draft, +4 authority receipts since via ADR-0508). **`month.closed` is not in
  it** (verified 2026-08-09) — this plan adds it by micro vocab ADR, the
  constitution-adoption pattern.
- **ADR numbering is century-banded per lane** (`PORTFOLIO.md`; 0600–0699 = "next lane
  to be born" as of 2026-08-09). Ledger is a NEW lane — it claims the next free century
  at kickoff; `/arc-kickoff` assigns, never assume.
- **Policy engine C9 is MERGED** (`677b67e` / PR #130, 2026-08-08). The two ledger
  action kinds that touch the spine (month-close emission, revenue ingest) get their
  `hq.policy.yaml` rows **in the same change** (POL-I birth rule); everything else in
  the CLI is reader-only.
- `redact.mjs` is **secrets-only** — no PII layer; and PLAN-leads has already made
  personal-data-never-in-the-repo law (private store + keyed HMAC ids). LED-C applies
  the same law to money: what the immutable spine never receives, it never has to erase.
- No `ventures.yaml` anywhere; no pnl code anywhere (verified 2026-08-09).
- Lanes live: design · develop · engine · evolve · leads · model-policy · policy ·
  portfolio (ADR-0053/0054/0055). Kickoff is lane-native; root company organs are the
  placement pattern for cross-lane files; live-slot discipline (A9) gates every kickoff.
- Model policy exists (MP-A…F): **MP-F** fingerprint/cost discipline — recorded,
  estimated and fabricated are three different things; only the first is allowed;
  absent stays absent. Ledger's cost lines inherit this, they do not re-invent it.

## Goal

For Ashiq, arc gains its **money brain**: per-venture P&L truth derived ONLY from spine
receipts — revenue (real money only) split gross/fees/tax/net, MRR with full churn
transitions, AI + fixed costs with source-honest labels, and kill-distance meters
against machine-readable kill criteria — rendered as `arc pnl` and inside the daily
brief, byte-reproducible from replay, with a month-close ritual that freezes each month
behind a **reconciliation gate**, so a number, once closed, can never silently change —
and not one byte of any customer's personal data ever lands on the spine.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | P&L is true and reproducible | `arc pnl [--venture V] [--month YYYY-MM]` renders real revenue only — a fixture spine containing both real and simulated events yields output **byte-identical** to the same spine with simulated events removed. Rows carry gross/fees/tax/net; an absent component renders absent, never ₹0. `venture: arc` costs land in a separate **Overhead** section, never attributed to a venture. `rm derived → arc-replay → arc pnl` byte-identical to golden on 3-OS (twin-determinism pattern). All access via the spine reader (grep-lint clean) | 0 | draft |
| REQ-02 | MRR math survives its edge cases | Pinned fixtures cover new / expansion / contraction / churn / reactivation transitions; refunds and partial refunds enter as **superseding negative events**, never edits; over-refund (refund > original) → needs-you flag, never silently netted; annual/quarterly plans normalized to MRR (/12, /3) **beside** a cash-in line — both labeled, never conflated. MRR base = recurring amount **ex-tax** (gateway fees do not reduce MRR; they appear in the fee line) | 0 | draft |
| REQ-03 | Kill-distance is visible and tamper-evident | Kill criteria per venture live in root `ventures.yaml`; `arc pnl` shows distance-to-line per criterion; ≥80% approach renders a warning line; crossing → needs-you item in the brief (computed at render via the ledger lib — **no event is emitted from event data**). An edit to `ventures.yaml` is honored only with an accompanying `decision.recorded` receipt naming the change — fixture: silent edit → loud `UNRECEIPTED CRITERIA CHANGE` refusal | 1 | draft |
| REQ-04 | Currency honesty | INR + one foreign currency; every conversion carries rate + source + rate-date **recorded at ingest inside the event**; render and replay perform zero lookups — fixture: replay fully offline is byte-identical. Foreign rows show original currency beside INR | 0 | draft |
| REQ-05 | A month closes only behind a green reconciliation | `arc pnl --close YYYY-MM` (IST month boundary): requires per-rail reconciliation input (provider export sum or manually entered provider total). Spine ≠ provider **in either direction** blocks the close: shortfall → missing-payment candidates listed; excess → duplicate suspects by provider payment id. Green gate → `month.closed` event (new kind, 22→23 by ADR) carrying the summary + file shas — day.closed pattern at month scale. Post-close corrections book into the month they are **recorded**; a closed month never restates — fixture: post-close refund leaves the closed month's bytes unchanged and appears in the current month | 2 | draft |
| REQ-06 | Costs are honest three ways | (a) measured/derived run costs consumed per **MP-F** (absent stays absent); (b) declared fixed + subscription costs as monthly `cost.incurred` events — **the spine is the only money store, no cost config file**; (c) apportionment views labeled `allocated`, never summed with measured into one number — fixture: mixed-source month renders two labeled lines, not one total. Daily spend line in the brief when present (C2 REQ-08 revived) | 2 | draft |
| REQ-07 *(stretch)* | Every number explains itself | `arc pnl --explain <line>` lists the contributing event ULIDs + amounts; drill-down matches golden | 2 | draft |
| REQ-08 *(stretch)* | Demo without lies | `arc pnl --simulated` renders the same views over `revenue.simulated` ONLY, watermarked `SIMULATED` on every line; real and simulated never co-render | 3 | draft |

## Appetite

**1.5 weeks part-time, hard cap. Tier S+.** (The brief said 1w; scope grew ~40% with
PII validation, reconciliation gate and the cost trichotomy — priced honestly.)
**Kill criteria:** 50% burnt (~4d) without REQ-01 + REQ-02 green on fixtures → cut to
the pnl-math lib only (bank; kill-distance/close take a later slot). First cut REQ-07,
second REQ-08, third REQ-03's 80%-warning line (crossing detection stays). Any phase at
2× estimate → stop, bank, `/arc-retro`. 100% → cut or kill, never extend.

## Decisions to ADR at kickoff (numbered from the lane's claimed century per `PORTFOLIO.md`; LED-A…K)

| ID | Decision |
|---|---|
| LED-A | Ledger is a **reader-only derivation layer**: consumes the spine exclusively via the reader lib (SPINE-G); writes exactly one event kind — `month.closed`, from the human-run close command. Nothing else is ever emitted by ledger code; **no events derived from events** |
| LED-B | **Money data lives ONLY on the spine** — revenue and costs are events. The only ledger config file is `ventures.yaml` (criteria, not money). No parallel money store, no `costs.yaml` |
| LED-C | **Revenue payload contract v1, PII-free by construction**: required `amount, currency, venture, provider, provider_payment_id` (namespaced `provider:id`); optional `plan, interval, customer_ref` (opaque provider id or hash — never email/phone/name), `gross/fees/tax/net, fx`. Strict-mode validator **rejects PII-shaped fields** in `revenue.*` payloads; adversarial corpus pinned. Rationale: append-only + immutable closed days means nothing here can ever be deleted (redact.mjs asymmetry); DPDP erasure rights; LexOS is a legal product; PLAN-leads' PII law (personal data never in the repo) applied to money. Data that never enters never needs erasing |
| LED-D | **FX-at-ingest**: conversion facts are receipts — rate, source, rate-date inside the event; render/replay perform zero external lookups, ever |
| LED-E | `month.closed` joins the closed vocabulary by **micro vocab ADR** — count stated against live `KINDS.length` (ADR-0107 derived-count rule), never hardcoded. **IST month boundaries** (event ts is +05:30). Post-close corrections book into the recording month; frozen months never restate |
| LED-F | **Reconciliation is a close gate, not a report**: per-rail, both-direction (missed + duplicate), blocking. It is the safety net for every ingest mistake made between now and each close |
| LED-G | **Cost source trichotomy**: measured/derived (MP-F rules) · declared (`cost.incurred`) · allocated (labeled, never mixed with measured). Absent ≠ 0. Subscription AI plans are **declared fixed costs** — a flat fee apportioned per-run would be fake precision. `venture: arc` → Overhead, unattributed. The per-venture "₹ returned per AI-₹ spent" ratio is a future `metric.observed` candidate for evolve — named when the EVO-H0 vocabulary lands; nothing ships here |
| LED-H | **MRR definitions pinned**: base = recurring ex-tax; transitions new/expansion/contraction/churn/reactivation; annual normalized; cash-in reported beside MRR, never conflated. Definitions live in fixtures — re-litigating them is a rabbit hole |
| LED-I | `ventures.yaml` = **root company organ** (ADR-0053/0055 pattern), schema-versioned, parser-class (adversarial pass mandatory); edits require a `decision.recorded` receipt — **goalposts move only on the record** |
| LED-J | **CLI-first**: `arc pnl` under `.claude/scripts/hq/`; no slash command v1 (SPINE-D pattern; the brief's `/arc-pnl` phrasing is retired). The HTML dashboard later consumes the same lib/reader unchanged |
| LED-K | **Natural-key duplicate detection lives in the derived layer**: the same `provider_payment_id` on >1 event → needs-you flag + excluded from totals pending human decision. C2's content-idem stays untouched — this catches the same payment ingested in two different representations |

## Non-negotiables

- Derived-only: delete derived state → replay → identical P&L. Twin-determinism bats in
  CI from Phase 0, never leave.
- Real money only in real views; simulated structurally excluded (REQ-01 fixture).
- **PII never lands on the spine** (LED-C). A money brain does not need to know anyone's
  name.
- Payload normalizer, `ventures.yaml` parser, FX handling, export parsers = parser-class
  → mandatory adversarial construct-a-breaking-input pass, holes fixed + pinned as red
  fixtures, BEFORE FAIL promotion (council 43-hole history stands).
- Nullable-cost honesty end-to-end; `source` surfaced on every cost line (MP-F inherited).
- Month-close is human-run, always. A future scheduler may invoke the same CLI; the
  ritual's gate logic never moves into a daemon.
- Inherited whole: zero-dep Node ≥18 · bash-3.2/POSIX, no GNU-only constructs · bats in
  central `tests/` (ADR-0021) · 3-OS CI red = no merge · new lints WARN-first in TRIAL ·
  evidence bundle per phase-done · emit via emitter, read via reader only.

## No-gos

No accounting/tax books (GST and filings stay with the CA — this is management truth) ·
no invoicing/billing engine · no payment-provider API/webhook integration v1 (export
files + manual JSON only) · no forecasting · no dashboards (text first; HTML consumes
the reader later) · **no auto-kill** (meters inform; killing a venture stays a human
`decision.recorded`) · no PII on the spine · no second money store · no new slash
commands · no estimated/backfilled costs where data is absent · no new event kinds
beyond `month.closed`.

## Rabbit holes

MRR taxonomy bikeshedding (LED-H pins it — move on) · provider-adapter framework
(exactly two concrete export parsers; a third provider is its own later slot) ·
multi-currency beyond INR+1 · real-time/webhook ingest · GST computation · cost
allocation "fairness" modeling (labeled `allocated`, crude is fine) · Windows locale
chase (canonical serialization + pinned CRLF/BOM fixtures, as C2).

## Assumptions ledger

| Assumption | Trigger it's wrong | Phase |
|---|---|---|
| Provider exports (Razorpay / MoR) obtainable as CSV/JSON | no export → manual per-payment JSON template becomes the canonical entry path | 0 |
| LexOS pricing lands subscription-shaped | one-time-only → MRR section renders empty honestly; cash view carries the truth | 0 |
| Subscription AI costs known as monthly figures | unknown → absent; Overhead shows "unknown", never a guess | 2 |
| Fixture volumes representative (≤ thousands of events/month) | render ≥5s on owner's box → sqlite accelerator path, equivalence-gated (inherited) | 0 |
| No real revenue arrives during the build | first real ₹ mid-build → ingest ritual starts that day; Phase-3 proof upgrades from simulated to live | 3 |

## External dependencies

None new (zero-dep). Real Razorpay + MoR export format **samples** fetched at Phase 0 —
redacted, PII-stripped, then pinned as fixtures. MP policy doc (in repo) for cost
evidence rules. C2 spine mechanisms (live).

## Pre-mortem (top 6)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Money math wrong once → trust dead forever | Fixture-first; every edge pinned (refund/partial/over-refund/dup/FX/23:59-boundary); adversarial pass before anything renders |
| 2 | Fake precision — costs or FX | Source labels everywhere; absent stays absent; `allocated` never mixed with measured (LED-D/G) |
| 3 | Missed or doubled ingest discovered months later | Reconciliation GATE at close, both directions, blocking (LED-F) + natural-key dupe flag (LED-K) |
| 4 | Customer PII lands on an immutable spine | LED-C validator + adversarial PII corpus; data that never enters never needs erasing |
| 5 | Kill-distance ignored or quietly gamed | needs-you placement + 80% warning + goalpost receipts (LED-I) |
| 6 | Scope swells into accounting software | No-gos + pre-agreed cut order in the appetite |

## Phases (risk-ordered)

**Phase 0 — Money math core (3d):** revenue payload contract + strict validator (PII
adversarial corpus pinned) · normalization lib (gross/fees/tax/net, FX-at-ingest) · pnl
math on pinned fixtures (all MRR transitions, refunds, over-refund, natural-key dup,
23:59 IST boundary, cross-currency) · `arc pnl` v0 render · two export parsers
(razorpay, MoR) against redacted samples · twin-determinism bats · **adversarial pass,
holes fixed + pinned.** DoD: REQ-01/02/04 green 3-OS, adversarial report committed.

**Phase 1 — Kill-distance (2d):** `ventures.yaml` schema + parser (+adversarial) ·
distance / 80%-warning / crossing render · brief needs-you integration (render-time lib
call, no emission) · goalpost-receipt enforcement fixtures. DoD: REQ-03 green.

**Phase 2 — Close + costs (2d):** reconciliation gate (export-sum + manual-total paths,
both-direction blocking) · `month.closed` ADR + emission + post-close correction
fixtures · cost trichotomy + Overhead + daily-spend brief line (C2 REQ-08 revived) ·
`--explain` if appetite intact. DoD: REQ-05/06 (+07) green.

**Phase 3 — Proof (1d):** replay the REAL live spine — expected output "no real revenue
yet", rendered honestly (that output IS the acceptance) · `--simulated` demo view
(REQ-08) · evidence bundle (fixture index, adversarial reports, golden pnl/briefs) ·
`/arc-retro`. **Closure language: mechanism proven, live value pending.** Live-value
milestone: first real month closed with reconciliation green (expected ~Sep–Oct '26,
when LexOS earns).

**North-star:** a P&L any future arc user could trust with zero explanation — every
number replayable, every unknown labeled unknown, every month frozen behind a green
reconciliation, and not one byte of anyone's personal data on the spine.

## Appendix A — revenue payload contract v1 (normative sketch; final at kickoff)

```json
{ "amount": 1000, "currency": "INR",
  "gross": 1180, "tax": 180, "fees": 20, "net": 980,
  "venture": "lexos", "provider": "razorpay",
  "provider_payment_id": "razorpay:pay_XXXX",
  "customer_ref": "cust_XXXX",
  "plan": "pro", "interval": "monthly|annual|one_time",
  "fx": { "rate": 83.20, "source": "provider-settlement", "date": "2026-09-14" } }
```
Absent optional fields stay absent. `customer_ref` is an opaque provider id or hash —
email/phone/name shaped values are strict-mode rejections.

## Appendix B — ventures.yaml v1 (sketch; final at kickoff)

```yaml
version: 1
ventures:
  lexos:
    kill:
      days_without_revenue: 90
      traffic_floor_monthly: 100
# money data is NEVER declared here — costs are cost.incurred events (LED-B)
```

## Appendix C — planning-round provenance map

Every point raised in the 2026-08-03 → 2026-08-09 planning rounds, and where it landed:

| Discussed | Landed |
|---|---|
| Reconciliation gate at month-close (the #1 idea) | REQ-05 · LED-F |
| Gross/fees/tax/net semantics; GST would inflate MRR ~18% | REQ-01 · LED-C · Appendix A |
| FX rate fetched at render would break replay → rate-as-receipt | REQ-04 · LED-D |
| Goalpost-moving attack → ventures.yaml edits need a receipt | REQ-03 · LED-I |
| `--explain` provenance drill-down | REQ-07 (stretch; first cut) |
| Refund after close: frozen month never restates | REQ-05 · LED-E |
| Cash-in vs MRR conflation; annual-plan normalization | REQ-02 · LED-H |
| Kill-distance 80% early warning + loud crossing | REQ-03 (warning = third cut) |
| Fixture corpus: over-refund, dup, amount-drift, 23:59 boundary, cross-currency | Phase 0 |
| PII on an immutable spine can never be deleted (DPDP; redact.mjs is secrets-only) | LED-C · pre-mortem #4 · kickoff prompt ordering rule |
| Same payment in two representations = double count (content-idem verified) | LED-K |
| Subscription AI cost is flat — per-run apportionment = fake precision | LED-G |
| OS work (`venture: arc`) must not pollute venture P&L | REQ-01 Overhead · LED-G |
| `month.closed` missing from the 22-kind vocabulary | LED-E (ADR, 22→23) |
| ventures.yaml = root organ, parser-class | LED-I |
| Brief's `/arc-pnl` vs `arc pnl` inconsistency | LED-J (CLI wins) |
| Brief's kickoff prompt pre-dated lanes | Kickoff prompt (`--lane ledger`) |
| IST month boundaries | LED-E |
| Agent-payroll as a future evolve metric | LED-G note |
| Pre-wake obligations (LED-H0) / ingest ritual / trigger-sensor | Dissolved by the owner's Build-out Mandate (2026-08-09) — the module now ships before first revenue; reconciliation (LED-F) + validator-first ordering carry the same protections |
| Trigger ambiguity (2 ventures vs 2 rails) | Moot as a gate (Build-out Mandate); reconciliation is per-rail regardless |

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after approval)

```
/arc-kickoff ledger — the money brain --lane ledger

Design source: docs/strategy/plans/PLAN-ledger.md (v1.0, owner-approved 2026-08-09).
Context: docs/strategy/plans/README.md. Trigger: FIRED under the owner's Build-out
Mandate (2026-08-09) — cite the same decision.recorded as the executor Phase-0 receipt
in this kickoff's ADRs (A8's letter kept). The old pull-trigger (≥2 revenue sources)
is the live-value milestone, not a gate; closure uses the C2 REQ-07 pattern
(mechanism proven, live value pending).

Pre-kickoff checklist (verify, else STOP):
- Live slot free (Constitution A9).
- NEW lane — claim the next free ADR century per PORTFOLIO.md (0600s next as of
  2026-08-09; verify) and number LED-A..K inside it, including the month.closed
  micro vocab ADR (count against live KINDS.length, ADR-0107 rule; verify
  month.closed is still absent).
- Policy C9 is live: hq.policy.yaml rows for the month-close and revenue-ingest
  action kinds land in the same change (POL-I birth rule).

Instructions:
- Decisions LED-A..K are locked — do not re-litigate.
- Code under .claude/scripts/hq/ (arc-pnl.mjs + lib), tests in central tests/
  (ADR-0021). No new slash commands. Spine data stays instance-only, never synced.
- ventures.yaml is a root company organ (ADR-0053/0055 pattern).
- LED-C (PII-free revenue payloads) ships its validator BEFORE any real payload is
  ever ingested — this is ordering-critical.
- Parser-class surfaces (payload normalizer, ventures.yaml, FX, export parsers) get
  the adversarial pass before FAIL promotion. New lints WARN-first in TRIAL.
- If anything here contradicts current repo state, STOP and flag it to me.
- STOP after the lane's PLAN.md + phases/phase-00..03-spec.md are written and
  kickoff-lint passes — I review and approve before any Phase 0 code.
```
