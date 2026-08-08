# ADR 0416 — the outreach path may bind the product domain only in rehearsal mode

**Status:** accepted
**Date:** 2026-08-08
**Product:** `leads`
**Reversibility:** one-way (it narrows a non-negotiable; widening it again means re-opening ADR-0402)
**Revisit trigger:** a dedicated cold-outbound domain is warmed and a cold-outbound vendor is bound — at which point rehearsal mode stops being the only way the outreach path can run, and the real campaign moves off the product domain permanently.

## Context

ADR-0402 says cold outbound never sends from the product or root domain, and ADR-0413 left the
whole outreach engine fixture-proven and unexercised because the real campaign needs an offer,
an ICP and a warmed dedicated domain that do not exist. The consequence has been that a fully
built send path — caps, suppression, journal, reconcile, personalization lint, reply triage —
has never once run against a real mail server, and could not until business inputs arrive that
are weeks or months away.

On 2026-08-08 the owner supplied the missing piece from a different direction: five addresses
he controls or knows, to run the pipeline against end to end. That is not cold outbound. Every
recipient is known and consenting, there is no stranger to burn a reputation with, and the
question it answers is entirely mechanical — does the machine work against a real server.

The tension is that answering it means running the **outreach** code path (`provider()` on
`lib/deps.mjs` with its policy in `sequencer.mjs`/`guard.mjs`/`journal.mjs`, not `lib/mail.mjs`)
from `automemory.ai`, the product domain. ADR-0402's rule is structural
on purpose: it does not say "do not send cold mail from the product domain", it says the
outreach path and the product domain never meet, because a rule with a judgement call in it
gets relaxed under deadline pressure, and one spam complaint on `automemory.ai` also puts
Automemory's own signup, reset and invoice mail in the spam folder.

## Options considered

1. **Wait for the dedicated domain** — pros: ADR-0402 untouched, no new concept. Cons: the
   engine stays unexercised for the 2–4 weeks of warm-up plus however long the offer takes,
   which on current evidence is a quarter; and every week it sits unexercised is a week its 96
   already-found holes are joined by unfound ones.
2. **Relax ADR-0402 to "no cold outbound from the product domain"** — pros: trivially allows
   this. Cons: converts a structural rule into a judgement call, which is precisely the failure
   the original ADR was written to prevent. The relaxation would be permanent and would be
   available to every future deadline.
3. **Rehearsal mode: a distinct, allowlist-locked, receipt-marked mode** — pros: keeps
   ADR-0402 structural, since the outreach path still cannot reach a stranger from the product
   domain in any mode; makes the exception narrow, named and machine-checkable rather than a
   sentence someone remembers. Cons: a new mode to build and, more importantly, a new way for
   numbers to be mixed if a rehearsal send is ever counted as a real one.

## Decision

**Option 3.** The outreach path may bind the product domain **only** in rehearsal mode, and
rehearsal mode carries two hard properties, both enforced in code and both fixture-proven:

**Allowlist-locked.** The recipient set is the same env-declared allowlist mechanism ADR-0415
gave the mailer. A recipient outside it is refused before any network call. Combined with
ADR-0402's existing rule, the outreach path can therefore reach a stranger only from a
dedicated domain, and can reach the product domain only for people on an explicit list. There
is no third combination, and no flag that produces one.

**Receipt-marked, so the numbers can never mix.** Every rehearsal send is marked as such in its
receipt. The existing non-negotiable already says real and simulated are never mixed; rehearsal
is a third class and gets the same treatment. A campaign report that would otherwise count five
self-addressed rehearsal sends as real first touches is the specific failure this prevents, and
it is a quiet one — the number would simply be wrong, with nothing to notice.

**Transport.** Rehearsal binds Resend, the same vendor ADR-0415 chose for the mailer, which
satisfies ADR-0402's hard filter: Resend supports idempotency keys on its send endpoint, so a
crashed or retried send can be resolved rather than double-sent, which is what ADR-0411's
reconcile depends on. The policy layers stay separate — `lib/mail.mjs` is owner-directed,
`sequencer.mjs`/`guard.mjs`/`journal.mjs` are the outreach path — even though both post to the
same vendor, and even though both sit on the same `lib/deps.mjs` transport shelf. Sharing a
dumb HTTP client is not the coupling ADR-0402 forbids; sharing a *domain* under cold-outbound
conditions is.

**Evidence:** Resend supports idempotency keys on `POST /emails` and `POST /emails/batch`, up
to 256 characters, retained for 24 hours —
[Idempotency Keys changelog](https://resend.com/changelog/idempotency-keys),
[Idempotency Keys docs](https://resend.com/docs/dashboard/emails/idempotency-keys). Checked
2026-08-08. **Confidence:** high on the feature; the **24-hour retention window is a real
constraint** and is recorded below rather than discovered later.
**Rejected because:** waiting — the cost is a quarter of an unexercised engine for no gain that
rehearsal does not already provide. Relaxing ADR-0402 — it trades a structural guarantee for a
judgement call, permanently, to buy something a narrow named mode buys safely.

## Consequences

**Easier.** The whole outreach pipeline finally runs against a real mail server: real auth
headers, real MIME on the reply side, real timing through the caps, real idempotency keys
through the crash-safe reconcile. Every one of those is a place a fixture encoded a guess.

**Harder.** There is now a third send class to keep straight — real, simulated, rehearsal — and
every counter, report and reader path has to exclude rehearsal or say it is including it. This
is the main new risk the mode introduces and it is why the marking is a receipt property rather
than a runtime flag.

**A constraint that must not be discovered later.** Resend retains idempotency keys for **24
hours**. ADR-0411's reconcile resolves an unresolved send by asking the provider whether the
key was already used; past 24 hours that question has no answer, and reconcile must treat an
expired key as unresolvable-by-provider and fall back to its spine-first path rather than
reading the absence as "never sent" — which would authorise a duplicate.

**What this does not do.** It does not make the real campaign possible, does not resolve
ADR-0413 for a real audience, and does not permit one additional cold email from the product
domain. Reply rates, bounce behaviour, complaint behaviour and domain reputation under cold
conditions remain entirely untested, because five known recipients cannot test any of them.
