# Phase 02 — Replies

**Goal (one line):** A reply stops its sequence before the next batch, an "interested" reply
puts a calendar draft in the inbox in the same run, and a malformed reply fails loudly
without echoing one byte of its content.
**Appetite:** 1.0 day
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [x] **ADR-0405 ingestion**: `arc-leads ingest-reply --file <path>` (or stdin); webhook path behind the same interface for when a provider supports it
- [x] **ADR-0412 boundary enforced at ingest**: `--file` **refuses any path resolving inside the repo directory**; raw reply content never passes through argv
- [x] **Parser** (parser-class): triage classes `interested` / `later` / `no` / `bounce` / `unsubscribe` → `outreach.replied` receipt carrying the class
- [x] **Errors are loud about WHERE and WHY** (path, byte offset, reason code) and contain **zero content bytes** from the input
- [x] **Auto-stop** wired to the Phase-01 pre-send check — not to ingest time, so a daily manual cadence keeps ADR-0403 honest
- [x] **Calendar-draft path**: an `interested` class produces the calendar draft **in the same run as its ingestion** — no cutoff, no deadline arithmetic, no public-holiday calendar. This satisfies the design source's 16:00-IST SLA in both webhook and manual mode **by construction** (drafting at ingestion is strictly stronger than any deadline measured from ingestion), and removes a weekend/holiday model nothing this cycle can validate
- [x] **Unsubscribe-in-reply** → `lead.suppressed` receipt, effective in the same run
- [x] **ADR-0414 reply identity**: `outreach.replied` carries `reply_ref` (content hash of the raw bytes) and its idem preimage is `campaign|lead_id|triage_class|reply_ref` — `ingested_at` leaves the preimage
- [x] **Adversarial pass on the parser complete**, holes pinned as fixtures
- [ ] tests green **on CI** — per-JOB conclusions read, not the watcher's exit code
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

### Carried in from the Phase-01 review (recorded there, owed here)

- [x] **Bounce/complaint scoping asymmetry**: `deriveState` counts bounces across all campaigns while complaints are campaign-scoped — the *more severe* signal has the narrower blast radius. The shared asset is the sending domain, so both go global.
- [x] **`providerReal.submit` ignores `statusCode`** — a 500 whose body happens to parse as JSON is currently an ack.
- [x] **Four config keys with no reader**, two of them named `*_ceiling` — an operator would reasonably believe those move a hard ceiling.
- [x] **`KINDS is 39` is hard-typed** where its neighbours derive the count.

## Fixture manifest (this phase's)

Bounce classified · unsubscribe-in-reply → suppression, same run · **interested reply → draft in
the store + inbox item before the run exits** · **same reply ingested twice → exactly one draft
(idem)** · malformed inbound → parser refuses loudly by
path/offset/reason-code, **never by content** · argv-pasted reply content → refused with a
pointer to `--file` · `--file` path inside the repo directory → refused · unresolved-intent
class from ADR-0411 still blocks sends while a reply is mid-ingest.

## Verification plan

- **Test command:** `bats tests/leads-reply-parser.bats tests/leads-reply-triage.bats tests/leads-reply-contract.bats`
- **Expected failure first** (refined 2026-08-05, `/arc-change`): the RED run is
  `arc-leads ingest-reply --file <interested.eml>` against a store holding that lead's dossier,
  with `replies.mjs` + the ingest path present and `meetings` unwritten. It must exit **0**,
  emit the `outreach.replied` receipt, and leave `$ARC_LEADS_STORE/meetings/` **absent or
  empty** — the assertion is `meeting draft count == 0` **after asserting the receipt was
  emitted**, so the test cannot pass by the command having failed to run at all. Red for a
  missing module, a usage error, or a non-zero exit is **not** the expected failure and the
  test says so in its own message. ASCII-only `@test` names; each file asserts its own declared
  test count.
- **Live demo scenario:** a single terminal transcript, fakes only — `store init` → `campaign
  init` → `research` → `draft` → approve → `ingest-reply` an *interested* reply → show the
  meeting draft and its `leads-meeting` inbox item minted **in that same command**; then
  `ingest-reply` an *unsubscribe* reply from a second lead → show `arc-leads daily` refusing
  that lead at `[suppression]` and the first lead at `[reply-stop]`, on the next run, with no
  further human step.
- **Real-system check:** n/a — fakes only this phase.
- **Expected evidence:** CI job output; the parser adversarial-pass report; `initiatives/leads/evidence/phase-02/manifest.json`.

## Rabbit holes in this phase

Reply-classification ML → **rules + human triage** · handling every MIME shape → **the fake's
corpus plus loud refusal for the rest** · deadline/business-day arithmetic → **cut; drafting at
ingestion satisfies the SLA by construction**.

## Out of scope for this phase

Real provider, seed smoke, real sends, the campaign → Phase 03 (BLOCKED, ADR-0413).

## Your-setup / pending

None — offline on fakes.

## Non-negotiables (verbatim from PLAN)

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.
