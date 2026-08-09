# Phase 03 — Rehearsal campaign

**Goal (one line):** run the entire outreach pipeline once, end to end, against a real mail
server, on 5 allowlisted addresses — so that every fixture written across Phases 00–02 is
finally checked against something other than our own guess.
**Appetite:** 1.0 day
**Depends on:** phase-04

## Why this is Phase 03 and why it runs after Phase 04

The old Phase 03 was one thing — a real campaign — and it was blocked because it needed an
offer, an ICP and a warmed cold domain. On 2026-08-08 the owner split that block open by
supplying **5 addresses he controls or knows**. That does not produce an offer, so the business
half moved to the parked Phase 05. What it does produce is the ability to answer the entirely
mechanical question the lane has never been able to answer: **does the machine work against a
real mail server?**

It runs after Phase 04 because Phase 04 builds the two things this phase needs — the Resend
transport and the env-declared allowlist guard — and proves both on mail addressed to the owner,
where a mistake costs nothing. Building them here instead would mean debugging a transport and
a pipeline at the same time, which is how a failure becomes unattributable.

**ADR-0416 is what makes this legal.** The outreach path binds the product domain only in
rehearsal mode: allowlist-locked, and every send receipt-marked so these five can never be
counted as real first touches by any report, ever.

## Exit criteria (Definition of Done)

**Order is load-bearing here, and the first draft of this list had it wrong** (fixed 2026-08-09,
same day it was written). The provider-bind criterion was listed first, so `/arc-develop` handed
out "bind the real Resend implementation" as slice 01 — before any slice that builds the
rehearsal lock. That sequence puts a live send path on the product domain with nothing yet
refusing a non-rehearsal send. **The guard is built and proven first; the real transport is bound
onto a gate that already refuses.** The list below is in execution order, not importance order.

- [ ] **The preflight gate actually opens, and opens for the right reason** (added 2026-08-09
      via `/arc-change`). `sending_domain` in `.claude/config/leads.json` is `""` today, and
      `preflight()` reads SPF for that domain **before** it reads DMARC — so it refuses at the
      SPF row and the DMARC row never executes. Setting `sending_domain` is therefore part of
      this phase, not a precondition someone else supplies. Fixture: with `sending_domain`
      empty, preflight refuses and **names the SPF row** — a test that only asserts "refused"
      passes for the wrong reason and would have hidden this for a second time
- [ ] **ADR-0416's narrowing is enforced by code, not by the ADR text** (added 2026-08-09 via
      `/arc-change`). `product_domains` is `["lexos.app"]`, so `automemory.ai` is not a product
      domain to `preflight()` and ADR-0402's `dedicated-domain` refusal cannot fire for it;
      `preflight.mjs` contains the string `rehearsal` zero times. **These two land together or
      not at all**: add `automemory.ai` to `product_domains` **and** make the
      `dedicated-domain` check rehearsal-aware in the same slice. Fixtures, all three:
      product domain + rehearsal mode ON + allowlist locked → **passes** · product domain +
      rehearsal mode **OFF** → **refused, citing ADR-0402** · product domain + rehearsal mode
      ON but the allowlist empty or absent → **refused** (rehearsal mode without a lock is the
      loophole, and it is the one an attacker reaches for first)
- [ ] **`lib/provider.mjs` really bound to Resend** — the real implementation, not the fake, and
      the Phase-00 contract suite runs green against it including the negative control (the real
      impl pointed at an unreachable endpoint reaches its own code and exits with its own
      failure code). **Bound only after the two criteria above are green**, so the transport is
      attached to a gate that already refuses rather than to an open path
- [ ] **Rehearsal mode, both properties fixture-proven before any real send**: a recipient
      outside the allowlist is refused **before any network call** · every rehearsal send
      carries its rehearsal mark in its receipt

      **Design, settled 2026-08-09 while slice 03 was being bound — start here, not with a
      fresh investigation.** The allowlist check must NOT resolve the address first. The
      allowlist holds addresses; the send path carries `draft.lead_id`, a keyed HMAC
      (ADR-0400). Compare in ID SPACE:

      ```
      allowedIds = union over each allowlist address of leadIdsAllVersions(store, address)
      draft.lead_id not in allowedIds  ->  refuse, before any network call
      ```

      `leadIdsAllVersions` (`store.mjs`) exists already, and **all versions is the whole
      point**: `guard.mjs` carries the same lesson in its own comment — checking ONE id meant
      that after a key rotation every person who had unsubscribed became contactable again,
      "the single worst thing this system can do". An allowlist checked at one key version has
      the mirror-image bug: after a rotation the five allowlisted people stop matching and the
      guard silently refuses everything, or worse, a future variant reads a miss as unknown.
      No raw address touches the send path, and the check works across rotations.

      The VENDOR still needs the real address. That resolution belongs in the real provider,
      reading `store.dir/dossiers/<leadId>.json` `.email` — the shape `resolveKeyringIds` in
      `guard.mjs:33` already uses, and it must be **lifted into a shared exported helper
      rather than copied**, or it is defect class D5 the moment one of the two grows a
      normalisation the other lacks. `deps.mjs providerReal.submit` currently refuses any
      recipient that is not address-shaped, which is what holds the line until this lands.

      Reuse `loadAllowlist(env, varName)` and `assertAllowed(to, list)` from `mail.mjs:125`
      for parsing — the `varName` parameter exists precisely so a second allowlist can reuse
      it, and `preflight.mjs` hand-rolled a weaker counter instead, which the adversarial pass
      flagged. Parse with the shared helper; compare in id space as above.

      **Before writing the code, check whether the `outreach.sent` payload is a closed key
      set.** Spine payloads are closed (a non-negotiable) and the kinds are closed at 18
      (ADR-0026). The rehearsal mark is a payload FIELD, not a new kind, but if the payload
      schema is closed it needs an explicit update — and a mark that fails validation would
      quarantine every rehearsal receipt, which is worse than no mark.

      Fixtures this needs, and the third is the one an attacker reaches for: an allowlisted
      lead sends · a non-allowlisted lead is refused **with no socket opened** (assert the
      refusal happens before the provider is called, not merely that the send failed) · an
      allowlisted lead whose id was minted under a PREVIOUS key still matches · a rehearsal
      receipt carries the mark · a report over the rehearsal window asked for real sends
      returns **zero by count**.
- [ ] **The mixing guard, proved by its own negative**: a report run over the rehearsal window,
      asked for real sends, returns **zero** — and the assertion checks the count, not the
      absence of a word in the output
- [ ] **The full journey, all 5, end to end**: research → dossier with evidence → draft →
      ADR-0404 personalization lint → L1 approval in the inbox → send → receipt → reply
      ingested from a real mailbox → triage class → auto-stop takes effect. Not five sends —
      five complete journeys
- [ ] **Reply ingestion against real mail, not the fixture corpus** — real MIME, real client
      quoting, at least one HTML-only reply and one bottom-posted reply among the five, since
      both were live bugs in Phase 02 and both were found in fixtures written by us
- [ ] **Crash-and-reconcile against a real idempotency key**: kill a send mid-flight, run
      reconcile, confirm the mail was resolved rather than sent twice. **Also assert the
      24-hour-expiry path** (ADR-0416): an expired key must be treated as
      unresolvable-by-provider and fall back to the spine-first path, never read as "never sent"
- [ ] **REQ-07 seed-inbox smoke, dated**: ≥2 owned mailboxes of different classes, inbox
      placement verified from the delivered message's own received headers, auth headers pass,
      unsubscribe end-to-end, reply + bounce ingestion fire on the seeds
- [ ] Caps and suppression observed under real timing: a 3rd touch inside 7d refused · a
      replied-to lead refused at the send moment · a suppressed address refused
- [ ] tests green **on CI**; tracker updated

## Verification plan

- **Test command:** `bats tests/leads-provider-contract.bats tests/leads-rehearsal-guard.bats`
  — on CI. No local suite runs (standing constraint).
- **Expected failure first:** `leads-rehearsal-guard.bats`'s mixing case runs before the
  rehearsal mark exists and fails because the report counts 5 sends as real where it must count
  0 — a count assertion, so a mutant that changes the wording cannot pass it. The suite asserts
  its own declared `@test` count and uses ASCII-only test names (pre-mortem 8).
- **Live demo scenario:** the five journeys, watched live. Pick one of the five and follow it
  all the way: its dossier, its draft, the lint verdict, the approval, the send, the mail
  arriving in that real inbox, a reply typed by hand from that inbox, the triage class, and the
  sequence refusing to touch that address again. Then attempt a send to an address deliberately
  left off the allowlist and watch it refused with no network call made.
- **Real-system check:** open the recipient mailboxes by hand and read the received headers for
  SPF/DKIM/DMARC results and inbox-vs-spam placement. Open the Resend dashboard and match every
  send to a delivery record. **Look at the artifact — an agent's report about a mailbox is not
  the mailbox.**
- **Expected evidence:** `initiatives/leads/evidence/phase-03/` — the reader-derived rehearsal
  report with its rehearsal-vs-real counts, received-header blocks with auth results, the
  refusal transcripts, the crash-and-reconcile transcript including the expired-key case, CI run
  id with per-job conclusions, `manifest.json`. **Recipients appear as `rehearsal-1` … `-5`,
  never verbatim** — these are real people's addresses and ADR-0410 applies to them exactly as
  it applies to leads.

## Rabbit holes in this phase

Tuning the drafts to get a nice reply from someone you know → **the reply content is not
evidence here, only that the pipeline carried it**. Treating a green run as validation of the
cold-outbound vendor → it is not, and Phase 05 re-validates every fixture. Building a rehearsal
"mode switch" that a caller can pass → the mode is a property of the binding and its receipts,
never a flag someone can forget.

## Out of scope for this phase

**Every claim that needs strangers.** Reply rate, positive-reply rate, bounce rate, complaint
rate, cold-domain reputation, whether the offer works, whether personalization earns replies —
none of these are testable on five known recipients and all of them are Phase 05's. A report
from this phase that quotes a reply rate is reporting a number about the owner's own friends.

Cold sends from `automemory.ai` in any volume. The dedicated cold domain. The cold-outbound
vendor pick (`/arc-capability`, Phase 05). ADR-0407 autonomy promotion.

## Your-setup / pending

- **The 5 addresses**, in `ARC_LEADS_REHEARSAL_ALLOWLIST` in `.env.local` — **a separate list
  from the mailer's** (`ARC_LEADS_MAIL_ALLOWLIST`), so a rehearsal recipient never starts
  receiving arc's deploy alerts and the owner never becomes a valid cold-rehearsal target.
- **Which kind they are**: mailboxes the owner controls, or people he knows. Both are fine for
  the mechanics; the difference is only what may be claimed afterwards, and it is recorded in
  the evidence bundle so a later reader cannot mistake one for the other.
- **The Resend API key** — already in `.env.local` from Phase 04, same key, nothing new.
- **At least one recipient willing to reply by hand**, since reply ingestion against real mail
  is the half of the pipeline a send cannot exercise.

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
