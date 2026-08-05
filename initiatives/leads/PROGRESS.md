# PROGRESS.md — Cycle 8 · arc-leads "The Outbound Engine"

status: LIVE
cycle: arc-leads (Cycle 8, opened 2026-08-04)
phase: 03
appetite: 7d
burn: 4.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Born by `/arc-kickoff --lane leads` on 2026-08-04; claims **ADR band 0400–0499**.
> Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/`) stay
> at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/leads/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-leads.md` (v1.0, frozen 2026-08-03).

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Foundations — ADR-0410 store + secret + tripwire FIRST, ADR-0400 vocabulary + validators, ADR-0408 `metric.observed`, ADR-0411 journal schema, researcher + dossiers + provenance lint, deliverability preflight, provider interface + fake | 1.5d | ✅ closed 2026-08-04 |
| 01 | Sequencer — caps, suppression, breakers, receipt-derived state, spine-first reconcile, personalization lint + similarity, ADR-0412 review boundary, send-moment guard | 2.0d | ✅ closed 2026-08-04 |
| 02 | Replies — ingestion, parser, triage, calendar drafts, auto-stop | 1.0d | ✅ closed 2026-08-05 |
| 03 | Real campaign | 1.0d | 🚫 **BLOCKED** |

**Appetite burn: 4.5 of 7 days used (64%).** 5.5d allocated across the four phases; **1.5d
deliberately unallocated** as the overrun absorber — the arc-portfolio lesson (Cycle 4
allocated 100%, `appetite-sum` warned every run, Phase 02 overran with nothing to absorb it,
closed ~112%).

**Kill checkpoint: at 3.5 days burned (50%), are REQ-03's cap/suppression fixtures green?**
If not: stop. Nothing sends, ever, without the guard. Bank the ADR-0400 vocabulary and the
ADR-0404 lint as documentation, retro.

## Phase 03 is BLOCKED — the four things code cannot supply

| # | Gate row | Who unblocks | Cost |
|---|---|---|---|
| 1 | A real offer, named | owner | blocked on LexOS billing (P5, Sep '26) |
| 2 | **Dedicated domain warmed ≥14d + DMARC green** | owner | **2–4 calendar weeks — the long pole** |
| 3 | ICP v0 file | owner | ~1 hour |
| 4 | Calendar link live | owner | ~15 min |
| 5 | Capability report → provider + verifier | `/arc-capability` | ~1 session |
| 6 | LEA-I / EVO-H0 ruling | ✔ resolved — ADR-0408 | done |

Rows 2–4 are **calendar-gated, not effort-gated** — start them the moment outbound is
plausibly ≤6 weeks away. Row 2 is the critical path and cannot be compressed.

## Done log

- **2026-08-04 — kickoff.** Lane born, ADR band 0400–0499 claimed. 14 ADRs, PLAN, 4 phase
  specs. Gates: `kickoff-lint` green · attacker panel ×3 (21 findings, 20 applied, 1
  applied-with-fix, 0 rejected) · `plan-simulator` 13 → 12 → 2 → 0 blockers.
- **2026-08-04 — Phase 00 code complete, CI green** (PR #111, all legs). Vocabulary 31 → 39,
  private store outside the repo, PII tripwire, researcher + provenance/jurisdiction lint,
  deliverability preflight, provider interface + fake. Demo: 25 PASS / 1 HELD / 3 BELOW-BAR /
  5 REJECTED, 29 dossiers, 29 receipts, 0 quarantined.
- **2026-08-04 — adversarial pass, decision-logic surface.** One fresh agent, **22 confirmed
  breaking inputs while CI was green**, all closed and pinned as fixtures. Four broke a stated
  safety property (id canonicalization, Unicode suppression bypass, fail-open verification,
  non-total idem preimages). Four were twin-fix recurrences of this lane's own running defect
  list — including D3 itself, and a D4 twin where both tests protecting a safety property
  matched the rejection MESSAGE TEMPLATE rather than the input.
- **2026-08-04 — adversarial pass, shell/OS surface. 17 more holes + 3 test defects**, sharing
  almost nothing with surface 1 — which is the argument for the two-surface rule. Headline:
  **`pii-tripwire.sh` had NO CALLER anywhere in the repo** while the DoD claimed it was green
  on every leg. Also: the gate reported success while scanning nothing (three ways); paths
  with spaces, non-ASCII names or NUL bytes were silently skipped; `assertOutsideRepo` was
  bypassable by case, symlink, UNC and extended-length spellings; `initStore` could clobber a
  live secret on a case-insensitive filesystem; dossiers were world-readable while the secret
  was 0600. The test-count assertion was a **tautology**, and **four mutant tripwires passed
  the original suite** — each now has a killing test.
- **2026-08-04 — Phase 00 CLOSED.** 39 holes across both surfaces, all closed and pinned.
  Evidence: `initiatives/leads/evidence/phase-00/`. CI green on every leg.
- **2026-08-04 — Phase 01 CLOSED.** The send path, wired and guarded. **28 more holes across
  the two mandatory surfaces**, again with CI green throughout and again with the two agents
  sharing almost nothing. The sharpest: `reconcile` took no lock while both emitting receipts
  and deleting intent files, so running it during a live send voided that send's intent and
  the next run re-authorised the identical mail — and the trigger was the documented remedy.
  A mutation pass then showed **7 of 12 mutant guards passing the first suite**, because
  `sequencer.mjs` and `journal.mjs` had zero coverage. Two new suites close that.
  Evidence: `initiatives/leads/evidence/phase-01/`. CI green on every leg.
- **2026-08-05 — Phase 02 CLOSED.** The reply path, end to end. **29 more holes across the two
  mandatory surfaces**, again with CI green throughout and again with the two agents sharing
  almost nothing. Running total for the cycle: **96**. The sharpest: a multipart carrying only
  `text/html` parsed to an EMPTY body and classified `later`, so an HTML-only "remove me from
  your list" produced no suppression; `stripQuoted` ate the whole message of a bottom-posted
  reply; "Do not call me" classified as `interested` and minted a calendar draft; a transient
  "delivery delayed" DSN suppressed a live lead permanently and two of them froze the campaign;
  and reply-stop, already-sent and the touch cap each checked ONE lead id while suppression
  checked the whole keyring, in adjacent branches.
  **ADR-0414** was routed through `/arc-change` before any code: `outreach.replied` was keyed on
  `ingested_at`, which both split one reply into two receipts on re-ingest AND collapsed a "no
  thanks" and an "unsubscribe me" from the same second into one. It is keyed on content now.
  **The pre-merge review found the worst one:** the negated-contact rule accepted the ASCII
  apostrophe and not U+2019 — what every phone and word processor actually inserts — so
  `please don't call me again`, typed normally, classified as `interested`. The test named "the
  apostrophe spelling" tested the ASCII one that already worked.
  **CI caught three more that I did not**, including two new tests whose assertions could never
  have matched on any code. Run 31018199453: **19/19 jobs success**.
  Evidence: `initiatives/leads/evidence/phase-02/`.

## Now

**Current position: Phase 02 CLOSED (2026-08-05).** Phases 00, 01 and 02 are all closed with
both adversarial surfaces run on each: **96 holes total**, every one found while CI was green.
Phase 01 merged as `52a7a63` (PR #111); Phase 02 is PR #113.

**Next step: Phase 03 — and it is BLOCKED, not next.** It waits on four things no code
produces (the table above): a named offer, a dedicated domain warmed >=14d with DMARC green,
an ICP v0 file, and a capability report naming a provider. Rows 2-4 are **calendar-gated, not
effort-gated** — row 2 alone is 2-4 calendar weeks and cannot be compressed. Start them the
moment outbound is plausibly <=6 weeks away.

**What this cycle has produced is a fixture-proven, UNEXERCISED engine** (ADR-0413, standing
caution). Every provider fixture encodes a guess at a vendor that has not been chosen. The
first real campaign is what tests them, and it is the only thing that can.

**Budget the adversarial passes properly.** Across three phases they have found 96 holes in
code CI called green, and the two surfaces have consistently shared almost nothing — which is
the whole argument for running both rather than one thorough pass. Phase 02 cost 1.0d and
found 29.

**Every attacker prompt carries the running defect list D1-D6** and checks each entry in every
OTHER file: a fix is not applied until it has been attacked somewhere it was never made.

| # | Defect class |
|---|---|
| D1 | a grammar/parse pinned to one form while the producer emits another |
| D2 | an anchored match that mishandles a legitimate variant (subdomain, bare host) |
| D3 | a rule whose threshold cannot fire on the input it ships with |
| D4 | a test asserting on a MESSAGE TEMPLATE rather than an input, so a mutant passes |
| D5 | validate one read, compare another — two derivations of one value that disagree |
| D6 | a guard applied in one branch and omitted in the adjacent one |

**D6 was the whole story of Phase 02.** Reply-stop / already-sent / touch-cap versus
suppression. Single-part `text/html` refused while its multipart twin was not. `--file` and
stdin bounded while `--inbound` was not. Five sibling writes using `wx` and `emit()` not. The
pattern to check is never the file the bug was found in.

**And a seventh class earned its place: D7 — a test named after a case it does not cover.**
The apostrophe test, the e2e assertion reading the wrong spine path, and two new tests whose
assertions could never match. All three were invisible without executing them, which is
precisely why CI is the gate.

**Standing constraint:** no local test runs — CI is the only gate. Batch commits so each push
buys a full CI cycle.
