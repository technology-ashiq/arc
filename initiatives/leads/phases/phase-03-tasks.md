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
proof: tests/leads-rehearsal-guard.bats -- 13 tests. Every refusal case asserts WHICH rule refused and WHY, never merely that something refused; the shipped config already refuses for an empty sending_domain, so a bare refused-assertion would keep passing after an accidental unlock.
tier: contract
sources: phase-03-spec.md
decision: The spec asked for sending_domain to be set to automemory.ai. Building it showed that to be the wrong mechanism -- it makes the repo ship with the product domain as its configured sender, one env var from live. sending_domain stays empty and keeps refusing honestly; a separate rehearsal_domain is substituted only in rehearsal mode, leaving sending_domain free for the real cold domain in Phase 05. Also found a fourth gate row nobody had listed: default._domainkey.automemory.ai is NXDOMAIN while resend._domainkey resolves, so dkim_selector is now per-mode.
result: 9 behaviours executed directly against the module and read: mode-off refuses citing ADR-0402; declared-with-rehearsal_domain-unset refuses; declared-and-named-without-allowlist refuses; junk allowlist refuses; declared+named+locked passes naming ADR-0416 and the lock count; the substitution is announced as its own finding; rehearsal never selects lexos.app; selector resolves resend vs default; the shipped config still REFUSED first=sending-domain. pii-tripwire clean at 69 tracked files (rerun after git add -- the first run scanned 67 and had never seen the new files). kickoff-lint --lane leads: all checks passed.
commit: 2c7598b

#### slice: 02

title: **ADR-0416's narrowing is enforced by code, not by the ADR text** (added 2026-08-09 via `/arc-change`). `product_domains` is `["lexos.app"]`, so `automemory.ai` is not a product domain to `preflight()` and ADR-0402's `dedicated-domain` refusal cannot fire for it; `preflight.mjs` contains the string `rehearsal` zero times. **These two land together or not at all**: add `automemory.ai` to `product_domains` **and** make the `dedicated-domain` check rehearsal-aware in the same slice. Fixtures, all three: product domain + rehearsal mode ON + allowlist locked → **passes** · product domain + rehearsal mode **OFF** → **refused, citing ADR-0402** · product domain + rehearsal mode ON but the allowlist empty or absent → **refused** (rehearsal mode without a lock is the loophole, and it is the one an attacker reaches for first)
kind: logic
risk: medium
proof: Same suite. The three ADR-0416 fixtures the spec named, plus three the spec did not: an allowlist of non-address junk, an allowlist of bare at-signs, and rehearsal mode failing to unlock the OTHER product domain.
tier: contract
sources: phase-03-spec.md
decision: Rehearsal mode is THREE independent signals rather than one flag -- declared (env), locked (address-shaped allowlist entry), named (equals cfg.rehearsal_domain) -- and the absence of any one is the safe state. An env declaration rather than a caller argument, because a parameter someone forgets to pass defaults to permissive while a missing env var refuses. The named check exists because without it, turning rehearsal on would have unlocked lexos.app as well. Shipped in ONE commit with slice 01: either half alone is an unsafe intermediate.
result: Same executed run as slice 01. D5 closed in the adjacent file rather than only where it was found: sequencer.mjs built List-Unsubscribe from its own read of cfg.sending_domain, so the gate would have cleared automemory.ai while the header pointed at an empty domain. Both now call one exported resolver, effectiveSendingDomain.
commit: 2c7598b

#### slice: 03

title: **`lib/provider.mjs` really bound to Resend** — the real implementation, not the fake, and the Phase-00 contract suite runs green against it including the negative control (the real impl pointed at an unreachable endpoint reaches its own code and exits with its own failure code). **Bound only after the two criteria above are green**, so the transport is attached to a gate that already refuses rather than to an open path
kind: logic
risk: medium
proof: tests/leads-provider-contract.bats, 22 -> 25 tests, on CI. The negative control must now be GIVEN the config the bound provider requires, or it stops at the first config refusal and never reaches the socket -- reaching the transport failure against 127.0.0.1:1 is what proves the real module ran its own code rather than the fake being silently substituted.
tier: contract
sources: phase-03-spec.md, code:grep-fallback(17; no .codegraph/), adrs(17), learning(0), retro(13), churn(1)
decision: The CREDENTIAL binds the provider, not the base URL: LEADS_PROVIDER_BASE_URL now defaults to api.resend.com, so the old refuses-when-no-base-URL assertion would have passed for the wrong reason forever. Resend names its ack field id while the canonical field here is provider_message_id, and the mapping is a PARAMETER on the single decoder rather than a second decoder, so what-counts-as-an-ack keeps one definition (a drifted copy would be D5 in the one function whose only job is that decision). suppressionList and the non-address recipient are NAMED refusals rather than stubs, because returning an empty suppression list reads as nobody-is-suppressed and handing a keyed lead id to the vendor comes back as a 400 that reads like a transport fault.
result: CI 19/19 green, merged as eb0f83a on the base CI tested. Caught before commit: authStatus first returned dmarc true off Resend domain status, on the line directly below a comment saying that would invent a clause the vendor never checked -- Resend does not evaluate DMARC at all. It now returns dmarc null, a THIRD state meaning the vendor cannot answer, and preflight defers that clause to its own live DNS row and says which source decided. Returning false would have been equally wrong: it makes the gate unpassable for a domain whose DMARC is fine. Same defect class as the fixture loader that returned all-green when its file was missing. NOT proven: no live send has happened -- the five journeys, reply ingestion against real mail and crash-and-reconcile on a real idempotency key are slices 04 onward.
commit: 10d3d49

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
