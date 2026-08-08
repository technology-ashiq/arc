# Phase 04 — arc's own mail

**Goal (one line):** arc can reach its owner when he is not at a terminal — deploy/canary
failures, waiting approvals and the daily brief arrive in his inbox — from a mail path that
is structurally incapable of ever reaching a stranger.
**Appetite:** 1.0 day (released from the deferred Phase 03, not added to the cycle)
**Depends on:** phase-00

## Why this phase exists at all

Two things met on 2026-08-08. The owner confirmed he cannot name the 25 recipients a real
campaign would go to, which is direct evidence that a real offer does not yet exist — so the
real campaign parked to Phase 05. And arc has a real, currently-unserved need with a trigger
already pulled: every alerting surface it owns is terminal-only, so a deploy that breaks while
the owner is away is invisible until he next opens a shell.

**This phase runs FIRST, before Phase 03.** The rehearsal campaign needs a working Resend
transport and a working allowlist guard; this phase builds both and proves them on mail
addressed to the owner, where a mistake costs nothing. Doing it the other way round would mean
debugging a transport and a pipeline simultaneously, which is how a failure becomes
unattributable. `phases/phase-03-spec.md` declares `Depends on: phase-04` for that reason.

## Exit criteria (Definition of Done)

- [ ] **`mailer()` in `lib/deps.mjs` (interface + fake + Resend HTTP impl) and the policy in
      `lib/mail.mjs`** per ADR-0415 — a plain HTTPS POST, no SDK, key read from env. The policy
      module is deliberately NOT an outreach-policy module and must not import from that path
      (`sequencer.mjs`, `guard.mjs`, `journal.mjs`, `drafts.mjs`, `personalization.mjs`,
      `replies.mjs`, `preflight.mjs`, `ingest.mjs`) — sharing `deps.mjs`, the dumb transport
      shelf every external edge in this lane sits on, is not the coupling ADR-0402 forbids
- [ ] **The allowlist guard, as a fixture first**: a recipient absent from the env-declared
      owner allowlist is refused **before any network call**. This is the whole reason the
      product domain is safe to send from — it is a test, never a sentence
- [ ] **Caps in code, matching the free tier**: 101st send in one IST day → refused · 3,001st
      in a calendar month → refused · quota exhausted → **fails loudly with a named error**.
      A notification path that quietly stops is worse than no notifications at all
- [ ] **Secret handling proved, not asserted**: key absent → refused with a named error, never
      a silent success · key present in argv → refused · key never printed to stdout, a log, a
      receipt, or any **tracked** file. It lives in `.env.local` and nowhere else — arc's
      existing convention, already read by `/arc-toolcheck`
- [ ] **A test asserts `.env.local` is gitignored**, by asking git rather than by reading
      `.gitignore` — the file's safety rests entirely on one ignore rule, and a rule nothing
      checks is a rule that can be edited away without anyone noticing
- [ ] **Contract suite green against BOTH fake and real** (`tests/leads-mailer-contract.bats`),
      including the negative control: the **real** impl pointed at an unreachable endpoint
      reaches its own code and exits with its own failure code, so a silently-substituted fake
      cannot pass the suite
- [ ] **Three triggers wired end to end**: deploy/canary failure · L1 approval items waiting ·
      daily brief
- [ ] **Inbox placement proved from the delivered message, on two mailbox classes** — the Zoho
      `arc@` mailbox on the product domain and a Gmail-class mailbox. Not spam. SPF/DKIM/DMARC read from the
      **received headers of the delivered mail**, never from our own DNS lookup, which would
      prove only what we published and not what the receiver accepted
- [ ] tests green **on CI**; tracker updated

## Verification plan

- **Test command:** `bats tests/leads-mailer-contract.bats tests/leads-mailer-guard.bats`
  — on CI. No local suite runs (standing constraint).
- **Expected failure first:** `leads-mailer-guard.bats`'s allowlist case runs before
  `lib/mail.mjs` exists and fails on the missing module, not on an assertion — so the first
  green must come from the guard actually refusing a non-allowlisted recipient, and the suite
  asserts its own declared `@test` count so a test that never registers is visible as a falling
  number rather than a silent pass. ASCII-only test names (pre-mortem 8).
- **Live demo scenario:** break a deploy on purpose (or fire the canary path against a failing
  probe) with the owner away from the terminal; the alert mail arrives in the Zoho `arc@` mailbox.
  Then run the daily brief and watch it land in the Gmail-class mailbox. Then call the mailer
  with a recipient outside the allowlist and watch it refuse before any network call.
- **Real-system check:** open both mailboxes by hand. Confirm the message is in the inbox and
  not the spam folder, and read the received headers for SPF/DKIM/DMARC results. Check the
  Resend dashboard for the delivery record and the remaining daily quota. **Look at the
  artifact, do not carry an agent's report about it.**
- **Expected evidence:** `initiatives/leads/evidence/phase-04/` — the received-header block
  from each of the two mailboxes with the auth results visible, the refusal transcripts for
  each fixture class, CI run id with per-job conclusions, and `manifest.json`. The owner's own
  address appears as `owner-1` / `owner-2` in anything committed.

## Rabbit holes in this phase

Building a template/layout system for notification mail → **plain text, one screen, the fact
and a link**. Retrying and backoff sophistication → **one retry, then fail loudly**; a
notification that arrives late and silently is the failure mode being avoided. Making the
mailer generic enough to serve the campaign later → **no**; ADR-0415 separated the two on
purpose and a "shared" mailer is how the product domain ends up inside the cold-outbound path.

## Out of scope for this phase

**Anything that would let this be claimed as campaign progress.** This phase does not bind the
outreach provider (`provider()` and the outreach policy modules are untouched — that is Phase 03), does not resolve
ADR-0413, and does not validate a single Phase 00–02 provider fixture. Different interface,
different policy layer, even though Phase 03 will post to the same vendor. REQ-07's seed smoke
is *satisfied in kind* here — owned mailboxes, placement, auth headers — but REQ-07 itself is
Phase 03's to close, with its own dated run through the outreach path.

Cold outbound from `automemory.ai`, in any volume, for any reason. A second sending domain.
Unsubscribe handling and List-Unsubscribe headers — owner-directed mail has no unsubscribe
concept and adding one would blur exactly the line this phase exists to hold.

## Your-setup / pending

Done by the owner on 2026-08-08: the `arc@` mailbox created on Zoho (receive side);
`automemory.ai` verified in Resend (send side); and **`RESEND_API_KEY`, `ARC_LEADS_MAIL_FROM`,
`ARC_LEADS_MAIL_ALLOWLIST` and `ARC_LEADS_REHEARSAL_ALLOWLIST` placed in `.env.local`** — arc's
existing single home for credentials, gitignored, and already the file `/arc-toolcheck` reads.
Never in a commit, never in chat where it would land in a transcript.

The two allowlists stay separate on purpose: the mail allowlist is the owner's addresses only,
and the rehearsal recipients are their own list (Phase 03) so a rehearsal recipient never starts
receiving deploy alerts and the owner never becomes a valid cold-rehearsal target.

**`.env.local` carries credentials and nothing else.** `ARC_LEADS_FAKE`, `ARC_LEADS_NOW`,
`ARC_LEADS_STORE`, `ARC_LEADS_MAIL_BASE_URL` and `LEADS_FIXTURE_DIR` are refused when they
arrive from that file: it is read inside the mail subcommand, which is after the startup guard
that polices those doors, so a file setting `ARC_LEADS_FAKE=1` would otherwise switch the
notification path to the fake and report a delivered mail that never left.

**One caveat that belongs with the decision, not discovered later:** `git clean -xfd` deletes
ignored files, so a clean wipes `.env.local`. For the Resend key that is a two-minute re-paste
from the dashboard. It is **not** true of the ADR-0410 HMAC secret, whose loss permanently
breaks suppression matching — someone who unsubscribed could be mailed again — which is why
that one secret stays outside the repo and does not move to `.env.local`.

## Non-negotiables (verbatim from PLAN)

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- The product domain reaches only people on an env-declared allowlist, refused in code before any network call, never by policy text: arc's own notification mail is owner-directed (ADR-0415), and the outreach path may bind the product domain ONLY in ADR-0416 rehearsal mode, allowlist-locked and receipt-marked. Real cold outbound always requires the dedicated domain (ADR-0402). Real, simulated and rehearsal sends are three classes and are never mixed in any count.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.
