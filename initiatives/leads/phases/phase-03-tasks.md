# Build Brief — phase 03 · Rehearsal campaign

spec-hash: sha256:5244a56d21720fa2e77dc035c6ea12bffca49f31a30a00543f3d49414aa8f068
lane: leads
reqs: 
adrs: 0400, 0402, 0404, 0407, 0410, 0415, 0416
blast-radius: .claude/config/leads.json, initiatives/leads/evidence/phase-03/
no-gos: 
blast-radius-dropped: 10

### Non-negotiables

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- The product domain reaches only people on an env-declared allowlist, refused in code before any network call, never by policy text: arc's own notification mail is owner-directed (ADR-0415), and the outreach path may bind the product domain ONLY in ADR-0416 rehearsal mode, allowlist-locked and receipt-marked. Real cold outbound always requires the dedicated domain (ADR-0402). Real, simulated and rehearsal sends are three classes and are never mixed in any count.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.

### Predictions

likely-failure-mode: (empty until proven)
likely-regression-site: (empty until proven)
riskiest-file: (empty until proven)
expected-blockers: (empty until proven)
expected-proof-failures: (empty until proven)

### Slices

#### slice: 01

title: **The preflight gate actually opens, and opens for the right reason** (added 2026-08-09 via `/arc-change`). `sending_domain` in `.claude/config/leads.json` is `""` today, and `preflight()` reads SPF for that domain **before** it reads DMARC — so it refuses at the SPF row and the DMARC row never executes. Setting `sending_domain` is therefore part of this phase, not a precondition someone else supplies. Fixture: with `sending_domain` empty, preflight refuses and **names the SPF row** — a test that only asserts "refused" passes for the wrong reason and would have hidden this for a second time
kind: logic
risk: high
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 02

title: **ADR-0416's narrowing is enforced by code, not by the ADR text** (added 2026-08-09 via `/arc-change`). `product_domains` is `["lexos.app"]`, so `automemory.ai` is not a product domain to `preflight()` and ADR-0402's `dedicated-domain` refusal cannot fire for it; `preflight.mjs` contains the string `rehearsal` zero times. **These two land together or not at all**: add `automemory.ai` to `product_domains` **and** make the `dedicated-domain` check rehearsal-aware in the same slice. Fixtures, all three: product domain + rehearsal mode ON + allowlist locked → **passes** · product domain + rehearsal mode **OFF** → **refused, citing ADR-0402** · product domain + rehearsal mode ON but the allowlist empty or absent → **refused** (rehearsal mode without a lock is the loophole, and it is the one an attacker reaches for first)
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 03

title: **`lib/provider.mjs` really bound to Resend** — the real implementation, not the fake, and the Phase-00 contract suite runs green against it including the negative control (the real impl pointed at an unreachable endpoint reaches its own code and exits with its own failure code). **Bound only after the two criteria above are green**, so the transport is attached to a gate that already refuses rather than to an open path
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 04

title: **Rehearsal mode, both properties fixture-proven before any real send**: a recipient outside the allowlist is refused **before any network call** · every rehearsal send carries its rehearsal mark in its receipt
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 05

title: **The mixing guard, proved by its own negative**: a report run over the rehearsal window, asked for real sends, returns **zero** — and the assertion checks the count, not the absence of a word in the output
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 06

title: **The full journey, all 5, end to end**: research → dossier with evidence → draft → ADR-0404 personalization lint → L1 approval in the inbox → send → receipt → reply ingested from a real mailbox → triage class → auto-stop takes effect. Not five sends — five complete journeys
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 07

title: **Reply ingestion against real mail, not the fixture corpus** — real MIME, real client quoting, at least one HTML-only reply and one bottom-posted reply among the five, since both were live bugs in Phase 02 and both were found in fixtures written by us
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 08

title: **Crash-and-reconcile against a real idempotency key**: kill a send mid-flight, run reconcile, confirm the mail was resolved rather than sent twice. **Also assert the 24-hour-expiry path** (ADR-0416): an expired key must be treated as unresolvable-by-provider and fall back to the spine-first path, never read as "never sent"
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 09

title: **REQ-07 seed-inbox smoke, dated**: ≥2 owned mailboxes of different classes, inbox placement verified from the delivered message's own received headers, auth headers pass, unsubscribe end-to-end, reply + bounce ingestion fire on the seeds
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 10

title: Caps and suppression observed under real timing: a 3rd touch inside 7d refused · a replied-to lead refused at the send moment · a suppressed address refused
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)

#### slice: 11

title: tests green **on CI**; tracker updated
kind: logic
risk: medium
proof: (empty until proven)
tier: (empty until proven)
sources: phase-03-spec.md
decision: (empty until proven)
result: (empty until proven)
commit: (empty until proven)
