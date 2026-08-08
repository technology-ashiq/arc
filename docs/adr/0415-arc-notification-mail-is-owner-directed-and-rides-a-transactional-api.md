# ADR 0415 — arc's own notification mail is owner-directed and rides a transactional API

**Status:** accepted
**Date:** 2026-08-08
**Product:** `leads`
**Reversibility:** two-way
**Revisit trigger:** the free tier stops covering the need (a sustained day above 100 sends, or a month above 3,000); or the owner allowlist needs to grow past a handful of addresses; or cold outbound goes live and a second, dedicated sending domain enters the picture.

## Context

arc has no way to reach its owner unless he is sitting at a terminal. The daily brief, the
L1 approval queue and the canary/deploy failure path are all terminal-only surfaces. A deploy
that breaks while he is away stays invisible until he next opens a shell — which is the one
failure where minutes matter.

Two facts made this actionable on 2026-08-08. The owner already runs `automemory.ai` with
Zoho Mail on the receiving side and has created `arc@automemory.ai`. And this cycle's cold
campaign (Phase 03) is blocked on an offer that does not exist, so the send path built across
Phases 00–02 is fixture-proven and completely unexercised (ADR-0413) with no prospect of
being exercised this cycle.

The binding constraint is ADR-0402: cold outbound never sends from the product or root domain,
because one spam complaint against `automemory.ai` also lands Automemory's own signup, reset
and invoice mail in spam. So any mail capability we put on the product domain must be
**structurally incapable** of becoming cold outbound — not merely instructed not to.

## Options considered

1. **Zoho SMTP on `automemory.ai`** — pros: the mailbox is already there, one vendor for both
   directions. Cons: Zoho's Forever Free plan is webmail-only — SMTP, IMAP and POP are paid
   features behind Mail Lite (~$1/user/month), so this costs money on day one; and SMTP under
   the zero-dep Node rule means hand-writing the protocol, which is materially more code than
   the alternative and more code in the exact place a bug is silent.
2. **Resend HTTP API on `automemory.ai`** — pros: the free tier (3,000/month, 100/day, one
   domain) covers this need many times over at zero cost; it is a plain HTTPS POST, which Node
   does natively, so the zero-dep rule holds with a fraction of the code; it is purpose-built
   for transactional mail, which is exactly what owner-directed notification is. Cons: a second
   vendor to reason about; the 100/day free cap is a real ceiling that must be enforced in code
   rather than hoped for.
3. **Reuse the leads outreach provider interface (`provider()` on `lib/deps.mjs`, with its
   policy in `sequencer.mjs`/`guard.mjs`/`journal.mjs`)** — pros: no new
   interface, no new contract suite. Cons: that interface is shaped entirely for cold outbound
   — suppression lists, idempotency-key lookup, bounce and complaint webhooks — and none of it
   applies to mail addressed to the owner. Worse, it would place the product domain inside the
   outreach code path, which is precisely the coupling ADR-0402 exists to forbid.

## Decision

**Option 2, with a hard separation.** The transport joins the other external edges in
`lib/deps.mjs` as `mailer()` — interface, fake and real together, the shape every dependency in
this lane already has — and the POLICY lives in a distinct `lib/mail.mjs`, deliberately not
an outreach-policy module, sending through Resend's HTTP API from `automemory.ai`.

**A naming correction that matters, because the separation is the decision.** The PLAN's
external-dependency table calls the outreach provider `lib/provider.mjs`; no such file exists.
`provider()` sits on `lib/deps.mjs` — the shelf every external edge in this lane sits on — and
the outreach POLICY lives in `sequencer.mjs`, `guard.mjs` and `journal.mjs`. So `lib/mail.mjs`
sharing `deps.mjs` with the outreach transport is not a violation of this decision; it is the
same shelf, and the separation being asserted is between the two POLICY layers. Stating it
against a filename that does not exist would have made the rule unverifiable — and the first
test written to enforce it grepped for exactly one module name and passed while `mail.mjs`
imported any of the other seven.

The separation that matters is the policy one. Two transports posting to the same vendor is
unremarkable; two policy layers sharing a module is how the product domain acquires a
cold-outbound code path.

The separation is enforced in code, not in prose: the mailer's recipient set is an **explicit
owner allowlist read from env**, and a recipient outside that allowlist is refused before any
network call. The product domain therefore cannot reach a stranger even by mistake, even if a
future caller passes an arbitrary address, and the guard is a fixture rather than a sentence in
this file.

**No new spine event kind.** Notification mail is a delivery channel for a fact that already
carries a receipt — the canary failed, the phase closed, an approval is pending. Emitting a
`mail.sent` kind would double spine volume to record the postman rather than the news, and the
event kinds are a closed set whose extension needs its own ADR. The mailer keeps a small local
delivery log for debugging. Cold outbound keeps `outreach.sent`, which already exists and is
unaffected by this decision.

**Where the key lives: `.env.local`, arc's existing single home for credentials.** It is
gitignored (`.gitignore` covers `.env.*`), it is already the file `/arc-toolcheck` reads to
report which credentials are set, and `.env.example` already carries the convention that names
are declared there and values never are. An earlier draft of this ADR proposed a separate file
inside the ADR-0410 private store; that was wrong. It would have created a second, parallel
secret mechanism for no gain, and the reason ADR-0410 lives outside the repo does not transfer:
that store holds **lead PII and the HMAC secret that de-anonymises lead ids**, while this is an
ordinary vendor credential that is not PII and reveals nothing about anyone.

The one asymmetry is worth stating because it is the reason the two secrets do **not** share a
home. `git clean -xfd` deletes ignored files, so a clean wipes `.env.local`. Losing the Resend
key costs a two-minute re-paste from the vendor dashboard. Losing the ADR-0410 HMAC secret
permanently breaks suppression matching — a person who unsubscribed becomes unrecognisable and
can be mailed again — which is unrecoverable at any price. Same storage question, two different
loss consequences, so two different answers.

Because the key's safety now rests on a single ignore rule, **a test asserts that `.env.local`
is ignored by asking git**, not by reading `.gitignore`. A rule nothing checks is a rule that
can be edited away without anyone noticing.

**Evidence:** Zoho Mail's Forever Free plan restricts IMAP/POP/SMTP to paid plans, with Mail
Lite at ~$1/user/month unlocking them — [Zoho Mail free plan limitations](https://mail.mailbux.com/blog/email-comparisons/zoho-mail-free-plan-limitations-alternative),
[Zoho SMTP/IMAP/POP settings 2026](https://smtpedia.com/zoho-email-settings-pop3-imap-and-smtp/).
Resend's free tier is 3,000 emails/month, 100/day, one verified domain —
[Resend free tier 2026](https://automationatlas.io/answers/resend-free-tier-explained-2026/),
[Resend pricing 2026](https://nuntly.com/resend-pricing). Both checked 2026-08-08.
**Confidence:** high on the current tier facts; medium on their longevity, which is what the
revisit trigger is for.
**Rejected because:** Zoho SMTP — costs money on day one for a capability the alternative gives
free, and puts hand-written protocol code where a silent bug is expensive. Reusing
the outreach policy modules — it would put the product domain inside the cold-outbound code path, the
one coupling ADR-0402 forbids.

## Consequences

**Easier.** arc can reach its owner off-terminal, which unblocks the whole class of alerts that
are useless if he has to go looking for them. The send path gets its first genuinely real
exercise — a live API, real auth headers, real inbox placement — at zero reputation risk,
because the recipient is the owner and he will never mark his own mail as spam. REQ-07's
seed-inbox smoke (send to owned mailboxes, verify placement, verify auth headers) happens by
construction rather than as a separate errand.

**Harder.** Two mail vendors now sit in the picture — Zoho receives, Resend sends — and anyone
debugging has to know which side owns which symptom. The free tier's 100/day ceiling becomes a
real constraint that code must respect, and a notification path that silently stops at send 101
would be worse than no notifications at all, so quota exhaustion has to fail loudly.

**What this does NOT do, stated plainly so it is not claimed later.** This does not resolve
ADR-0413. Resend is not the cold-outbound provider and `lib/mail.mjs` is not the outreach
policy. Exercising the notification path says nothing about whether the outreach
fixtures match the behaviour of whichever vendor is eventually bound in a real campaign.
ADR-0413's standing caution — that the outreach engine is fixture-proven and unexercised —
remains true and is only retired by a real campaign.
