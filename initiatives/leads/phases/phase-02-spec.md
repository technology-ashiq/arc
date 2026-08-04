# Phase 02 — Replies

**Goal (one line):** A reply stops its sequence before the next batch, an "interested" reply
puts a calendar draft in the inbox in the same run, and a malformed reply fails loudly
without echoing one byte of its content.
**Appetite:** 1.0 day
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] **ADR-0405 ingestion**: `arc-leads ingest-reply --file <path>` (or stdin); webhook path behind the same interface for when a provider supports it
- [ ] **ADR-0412 boundary enforced at ingest**: `--file` **refuses any path resolving inside the repo directory**; raw reply content never passes through argv
- [ ] **Parser** (parser-class): triage classes `interested` / `later` / `no` / `bounce` / `unsubscribe` → `outreach.replied` receipt carrying the class
- [ ] **Errors are loud about WHERE and WHY** (path, byte offset, reason code) and contain **zero content bytes** from the input
- [ ] **Auto-stop** wired to the Phase-01 pre-send check — not to ingest time, so a daily manual cadence keeps ADR-0403 honest
- [ ] **Calendar-draft path**: an `interested` class produces the calendar draft **in the same run as its ingestion** — no cutoff, no deadline arithmetic, no public-holiday calendar. This satisfies the design source's 16:00-IST SLA in both webhook and manual mode **by construction** (drafting at ingestion is strictly stronger than any deadline measured from ingestion), and removes a weekend/holiday model nothing this cycle can validate
- [ ] **Unsubscribe-in-reply** → `lead.suppressed` receipt, effective in the same run
- [ ] **Adversarial pass on the parser complete**, holes pinned as fixtures
- [ ] tests green **on CI** — per-JOB conclusions read, not the watcher's exit code
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Fixture manifest (this phase's)

Bounce classified · unsubscribe-in-reply → suppression, same run · **interested reply → draft in
the store + inbox item before the run exits** · **same reply ingested twice → exactly one draft
(idem)** · malformed inbound → parser refuses loudly by
path/offset/reason-code, **never by content** · argv-pasted reply content → refused with a
pointer to `--file` · `--file` path inside the repo directory → refused · unresolved-intent
class from ADR-0411 still blocks sends while a reply is mid-ingest.

## Verification plan

- **Test command:** `bats tests/leads-reply-parser.bats tests/leads-reply-triage.bats tests/leads-reply-contract.bats`
- **Expected failure first:** refine at phase start via `/arc-change` — the coarse line is: `"interested reply produces a draft before the run exits"` must fail RED with **zero drafts written** once the ingest path exists but before the calendar-draft path does, not with a missing file. ASCII-only `@test` names; the file asserts its own declared test count.
- **Live demo scenario:** refine at phase start.
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
