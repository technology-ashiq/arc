# Phase 00 handoff — leads Cycle 8, Foundations

**Closed:** 2026-08-04 · **Appetite:** 1.5d · **Burn:** 1.5d · **PR:** #111 (draft)

## What was built

| Capability | Where |
|---|---|
| Private store outside the repo, HMAC keyring, 0700/0600 | `.claude/scripts/leads/lib/store.mjs` |
| PII tripwire (the alarm) | `.claude/scripts/leads/pii-tripwire.sh` |
| Vocabulary `KINDS` 31 → 39 (7 pipeline kinds + `metric.observed`) | `.claude/scripts/hq/lib/validate-leads.mjs` |
| Researcher, provenance/jurisdiction lint, ICP-generic predicate | `.claude/scripts/leads/lib/research-lint.mjs` |
| Deliverability preflight (live DNS + provider auth) | `.claude/scripts/leads/lib/preflight.mjs` |
| Provider / DNS / verifier / lead-source interfaces + fakes | `.claude/scripts/leads/lib/deps.mjs` |
| Journal schema, reader-only spine fold | `lib/journal.mjs`, `lib/spine-read.mjs` |
| CLI: `store init` · `research` · `preflight` · `state --json` | `.claude/scripts/leads/arc-leads.mjs` |

## Live demo (temp spine, temp store, fakes)

```
arc-leads store init
arc-leads research tests/fixtures/leads/icp-fake.json
  -> 25 PASS · 1 HELD · 3 BELOW-BAR · 5 REJECTED
  -> 29 dossiers in the store, 29 lead.researched receipts
  -> events/ 29, events/_quarantine/ 0
pii-tripwire.sh <repo>  -> clean (28 tracked leads files scanned)
arc-leads preflight     -> REFUSED (empty sending_domain — the honest committed value)
```

## Adversarial passes — BOTH surfaces, as the gate rule requires

Two fresh agents, neither having seen the implementation, different surfaces.
**39 confirmed holes total. CI was green throughout.** That is the whole argument for
the rule: a green suite was not evidence of correctness in any of the 39 cases.

**Surface 1 — decision logic: 22 holes.** Four broke a stated safety property:
- `lead_hmac_v01_` (leading zero) validated but could never match a minted id → a suppression
  receipt indexed under a string no lookup would find → the person gets contacted again
- no Unicode normalization → NFC/NFD spellings of one mailbox were two identities
- verification FAILED OPEN → a lookup miss and every real-provider verdict (`invalid`,
  `risky`, `catch-all`) mapped to *verified*, i.e. sendable
- idem preimages were not total despite the header claiming so → an edited draft resent on
  the same touch collided and one receipt was silently dropped while two mails were sent

Four were **twin-fix recurrences** of this lane's own defect list, including D3 itself.

**Surface 2 — shell / OS / filesystem: 17 holes + 3 test defects.** It shared almost none of
surface 1's findings. The headline: **`pii-tripwire.sh` had no caller anywhere in the repo.**
It only ever ran against its own sandbox while the DoD claimed it was green on every leg.
Also: the gate reported success while scanning nothing (three ways); paths with spaces,
non-ASCII names, or NUL bytes were silently skipped; `assertOutsideRepo` was bypassable by
case, symlink, UNC and extended-length spellings; `initStore` could clobber a live secret on a
case-insensitive filesystem; dossiers were world-readable while the secret was 0600; the
payload travelled in argv and into an error message.

**Test defects it found:** the count assertion was a **tautology** (it grepped the same file it
compared against, so it could not see a test bats dropped — the one thing it existed for), and
**four mutant tripwires passed the original suite**. Each now has a killing test.

## Definition of Done

- [x] ADR-0410 store lands before any dossier exists
- [x] Tripwire green and hostile-proven, **and wired to a caller that runs on every leg**
- [x] Vocabulary in ONE edit; `approval.requested` given a leads-scoped emitter guard, not a
      closed validator that would have broken every other lane
- [x] Research lint, preflight, provider interface + fake with a real-code-path test
- [x] Receipts land in `events/`, not `_quarantine/` — looked, not assumed
- [x] `state --json` determinism / order-independence / fold-completeness (the planned
      wipe-and-replay fixture was vacuous — there is no cache to wipe)
- [x] Sync-golden + `leads` manifest + `hq` manifest regenerated
- [x] **Both adversarial surfaces complete**, all 39 holes closed and pinned
- [x] CI green on all legs

## What this does NOT prove

Every provider fixture encodes a **guess** at a vendor nobody has chosen (ADR-0413). The fake
is the only oracle, and it was written from the same guess. Phase 03 is where they get tested,
and Phase 03 is BLOCKED on business physics. **This phase makes the foundation fixture-proven
and unexercised. It does not make outbound ready.**

## Carried forward

The running defect list now has 6 entries (D1–D6), and every Phase 01 attacker prompt must
carry it and check each entry in every *other* file. Of 39 holes, **8 were recurrences of a
defect already fixed elsewhere in this same lane** — a fix is not applied until it has been
attacked somewhere it was never made.
