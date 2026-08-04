# PROGRESS.md — Cycle 8 · arc-leads "The Outbound Engine"

status: LIVE
cycle: arc-leads (Cycle 8, opened 2026-08-04)
phase: 02
appetite: 7d
burn: 3.5d
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
| 02 | Replies — ingestion, parser, triage, calendar drafts, auto-stop | 1.0d | not started |
| 03 | Real campaign | 1.0d | 🚫 **BLOCKED** |

**Appetite burn: 3.5 of 7 days used (50%).** 5.5d allocated across the four phases; **1.5d
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

## Now

**Current position: Phase 01 CLOSED (2026-08-04).** Phases 00 and 01 are both closed with
both adversarial surfaces run: **67 holes total**, every one found while CI was green.

**Next step: Phase 02 — Replies.** Ingestion (`--file`/stdin, repo paths refused), the parser
(parser-class, so it carries its own adversarial passes), triage classes to receipts, the
calendar draft produced in the same run as its ingestion, and auto-stop wired to the Phase-01
pre-send check.

**Budget the adversarial passes properly.** Across two phases they have found 67 holes in code
that CI called green, and the two surfaces have consistently shared almost nothing — which is
the whole argument for running both rather than one thorough pass.

**Every Phase 01 attacker prompt must carry the running defect list D1–D6** and check each
entry in every OTHER file: a fix is not applied until it has been attacked somewhere it was
never made.

| # | Defect class, found in Phase 00 |
|---|---|
| D1 | a grammar/parse pinned to one form while the producer emits another |
| D2 | an anchored match that mishandles a legitimate variant (subdomain, bare host) |
| D3 | a rule whose threshold cannot fire on the input it ships with |
| D4 | a test asserting on a MESSAGE TEMPLATE rather than an input, so a mutant passes |
| D5 | validate one read, compare another — two derivations of one value that disagree |
| D6 | a guard applied in one branch and omitted in the adjacent one |

**D5 and D6 are the recurring pair** — between them roughly half of Phase 01's 28 holes.
Check every value that is derived twice, and every guard that appears in one branch.

**Standing constraint:** no local test runs — CI is the only gate. Batch commits so each push
buys a full CI cycle.

**Standing caution (ADR-0413):** this cycle produces a **fixture-proven, unexercised** engine.
It does not make outbound ready. Every provider fixture encodes a guess at a vendor that has
not been chosen; the first real campaign is what tests them.
