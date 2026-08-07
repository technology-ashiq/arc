# Phase 01 — Sequencer

**Goal (one line):** A draft cannot reach the inbox without a lint verdict, cannot be sent
after being edited, and cannot exceed a cap — proven by fixtures written to break each of
those three claims.
**Appetite:** 2.0 days
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] **ADR-0403 caps** in code, config-valued, hard-ceilinged: ≤20 submitted/IST day (bucketed by the intent's `submitted_at`, never the spine emit time) · ≤2 touches/lead/rolling-7d · IST business-hours window
- [ ] **Suppression ledger**: event-backed from `lead.suppressed`, reader-derived, checked before every send, surviving across campaigns, unsubscribe effective in the same run — **and matched across every key version in the store's keyring**: the guard derives `lead_hmac_v1..vN` for the candidate address under every retained secret and refuses on a hit under ANY of them. **A rotation adds a version and never retires one** — ADR-0400's "re-derived from dossier emails" cannot re-derive a suppression whose dossier ADR-0410 purged on delete-on-request; the retained v1 hmac is all that survives
- [ ] **No mutable counter file exists anywhere** — grep-provable, and a hand-edited or reset state file changes nothing
- [ ] **Single-writer lock on the store**: every send path takes an exclusive `$ARC_LEADS_STORE/.send.lock` (O_EXCL, holder pid + start time inside) for the whole read-derive → guard → submit → emit → resolve window. A lock held by a live pid → refuse and name the holder; a lock held by a dead pid → refuse and point at ADR-0411 recovery, **never auto-break** (the dead process may sit in the ack-to-receipt window). ADR-0056 forbids concurrent emitters by policy; this is the mechanism
- [ ] **Send-moment guard chain**, first two steps added because ADR-0403 defines HOLD/FROZEN and ADR-0411 defines unresolved intents but neither placed them in the chain: **campaign-state (HOLD or FROZEN → refuse) → unresolved-intent → suppression → reply-stop → touch-cap → daily-cap → window → `draft_sha` match.** **FROZEN is cleared only by an `arc-inbox` approval naming the incident — no CLI flag, config value or env var clears it; HOLD is cleared the same way after the cause check**
- [ ] **ADR-0411 journal + spine-first reconciler**: intent → submit → receipt → resolve; recovery checks the **spine first**; no send while any intent is unresolved; effective counts = receipts + unresolved intents. **The reader fails closed** — no `outreach.sent` receipt for a resolved intent is an error, never a count of 0
- [ ] **ADR-0404 personalization lint**: FAIL blocks inbox entry from birth; BELOW-BAR renders as a WARN **on** the inbox item; cross-draft similarity guard at 70%
- [ ] **ADR-0412 review boundary**: spine approval item carries `{what, gate, draft_ref, lead_hmac, campaign, lint_status, draft_sha}` — `what`/`gate` kept because `arc-inbox.mjs listInbox()` prints exactly `id what (gate) venture` and would otherwise render every leads approval as a blank line · `arc-inbox` gains `lint_status` + BELOW-BAR WARN rendering — **shared organ, edited by all lanes**: run `git log origin/main --oneline -5 -- .claude/scripts/hq/arc-inbox.mjs` first, and regenerate its bats suite + `tests/fixtures/sync-golden/tree-manifest.txt` in the same commit · `arc-leads review DRAFT_REF` renders locally from the store · approval binds `draft_sha`
- [ ] **Human-started daily command** prepares eligible next-touch drafts for approval — **no daemon, no cron, no background execution** (grep-provable)
- [ ] **ADR-0407 promotion bar is NOT built this cycle.** Its only input is trial-ledger evidence from ≥2 campaigns and campaign #1 is BLOCKED (ADR-0413), so the bar stays prose in ADR-0407 and the evaluator is Phase-03+ work. What this phase proves instead is the negative: **no promotion code path exists** — grep-provable, L1 unconditional
- [ ] Full fixture set green (below)
- [ ] **Adversarial pass bound to the PR that ships each gate, never to this close**: the ADR-0403 guard chain, the ADR-0411 reconciler and the ADR-0404 lint each merge with their own two fresh-agent reports (decision-logic + shell/OS boundary) in the same PR; a gate merged without both reports is reverted, not back-filled. This close only re-reads them and maps every hole to the fixture that pins it
- [ ] tests green **on CI** — per-JOB conclusions read, not the watcher's exit code
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Fixture manifest (this phase's, all mandatory)

> **ASCII-only `@test` names, and every file asserts its own declared test count.** bats
> silently drops a test whose name holds a non-ASCII char — the manifest below uses `·` and
> `→` for readability and must NOT be transcribed verbatim into test names.

**Caps/suppression:** 21st submitted send of the IST day refused · 3rd touch inside a rolling
7-day window refused · send to suppressed lead refused · send after recorded reply refused ·
approved-then-replied → permanently blocked at send moment · out-of-window refused · **config
raised past hard ceiling refused (ask-to-exceed)** · CLI flag bypass refused · env var bypass
refused · hand-edited/reset counter state irrelevant — counts rebuild from receipts · process
restart mid-day → identical counts · **second concurrent send process refused, holder named**
· **lock held by a dead pid → refused, never stolen** · **midnight-IST bucketed by
`submitted_at`: 23:59 and 00:01 land on the correct days, and a recovery receipt emitted
00:10 IST for a 23:55 IST submit counts against the 23:55 day — the 21st send of that day is
still refused** · **purge dossier → rotate to `_v2_` → same address still refused** · **a
secret retired from the keyring → every send path refuses** rather than silently matching less.

**Journal/reconcile:** provider timeout → retry with the same idempotency key → exactly one
delivery · ambiguous outcome → message-id lookup before any retry ·
**crash-after-provider-accept-before-receipt** → restart emits exactly one late receipt, zero
resends, cap counts it · **crash-after-receipt-before-journal-resolve** → intent resolved FROM
THE SPINE, zero provider calls, zero duplicate emits · **crash-before-provider-accept** →
intent voided, no receipt, cap slot released · **crash mid-recovery** → re-run converges · any
unresolved intent → all send paths refuse · **store fingerprint mismatch → an empty journal
does not read as zero unresolved intents**.

**Breakers:** first bounce → HOLD + review item · 2 bounces → FROZEN + `incident.raised` ·
≥3% at ≥50 lifetime sends → FROZEN · spam complaint → FROZEN · **send attempted while HOLD →
refused, naming the HOLD** · **send attempted while FROZEN → refused; `--force`, a raised
config value and an env override each also refused** · **no code path clears HOLD or FROZEN
except the inbox approval** · unsubscribe → `lead.suppressed` + same-run effect.

**Personalization:** zero-specific draft → FAIL (never reaches inbox) · cited fact absent from
dossier → FAIL · missing fact→offer relevance line → FAIL · one-generic-token draft →
BELOW-BAR (WARN on item) · two drafts ≥70% identical body → BELOW-BAR similarity flag · N real
cited facts + relevance → PASS · slop markers flagged · **ICP-generic dossier fact is not
citable to clear the FAIL check**.

**Review boundary:** draft edited after approval (sha mismatch) → send refused · approval
receipt payload contains no draft text · **`approval.requested` payload validator rejects a
draft body**.

**Cross-derivation:** the guard's remaining-quota and the report's submitted count agree on
the same seeded receipts, and neither is produced by a second code path.

## Verification plan

- **Test command:** `bats tests/leads-caps.bats tests/leads-suppression.bats tests/leads-journal.bats tests/leads-personalization.bats tests/leads-review-boundary.bats`
- **Expected failure first:** `tests/leads-caps.bats` → `"21st submitted send of the IST day is refused"` fails RED with `no such file: .claude/scripts/leads/guard.mjs` before the phase is built. Then, once the guard exists but before the reconciler does, `tests/leads-journal.bats` → `"crash after receipt before resolve makes zero provider calls"` must fail with a **non-zero provider call count**, not with a missing file — that distinction is what proves the fixture tests the ordering rather than the file's existence.
- **Live demo scenario:** seed the fake with 20 submitted sends for today; run the daily command; observe the 21st refused with the cap named and the current count shown. Then approve a draft, mutate one byte of the draft body in the store, run the send — observe refusal citing `draft_sha` mismatch. Then kill the process between provider ack and receipt emission (the fake's injectable crash point), restart, and observe exactly one late receipt and zero resends. Finally start a second `arc-leads` process while the first holds the lock — observe refusal naming the holder pid.
- **Real-system check:** n/a — fakes only this phase.
- **Expected evidence:** CI per-JOB output for all five bats files; the four demo transcripts; **the six adversarial-pass reports (two per gate surface), each attached to the PR that shipped its gate**, with every found hole mapped to the fixture that now pins it; `initiatives/leads/evidence/phase-01/manifest.json`.

## Adversarial pass (mandatory, parser-class — ADR-0403/0404/0411)

**Two fresh agents per gate surface, with different surfaces** — one on the decision logic,
one on the shell/OS boundary. A single agent's blind spot is structural, not effort. Fresh
means it has not seen the implementation: the author's own breaking inputs found 0 holes on a
prior gate where an unanchored agent found 9.

**Each attacker's prompt carries this lane's running list of already-fixed defects**, with
the instruction to check every one of them in every OTHER file. "Validate one read, compare
another" was closed in one module and left open in its twin one phase later, twice, after the
written rule failed to take. **A fix is not applied until it has been attacked somewhere it
was never made.**

**The pass attacks the TEST that protects the rule, not only the rule.** A prior cycle's
propose-only guard was a grep that a mutant module walked straight past. The mutant IS the
negative control here: an implementation that overwrites the canonical counter, deletes the
journal, spawns a background sender, or clears FROZEN without an inbox approval must each be
caught by these tests.

## Rabbit holes in this phase

Reply-classification logic → **Phase 02** · optimizing the shingle algorithm → **fixed
threshold, config** · building the promotion evaluator → **cut this cycle; ADR-0407 stays
prose**.

## Out of scope for this phase

Reply ingestion and triage → Phase 02. Real provider, seed smoke, real sends → Phase 03
(BLOCKED, ADR-0413). The ADR-0407 promotion evaluator → Phase 03+.

## Your-setup / pending

None — offline on fakes.

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
