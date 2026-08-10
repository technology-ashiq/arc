# PROGRESS.md — Cycle 8 · arc-leads "The Outbound Engine"

status: LIVE
cycle: arc-leads (Cycle 8, opened 2026-08-04)
phase: 03
appetite: 11d
burn: 7.5d
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
| 03 | **Rehearsal campaign** (ADR-0416) — real provider bound to Resend, rehearsal mode allowlist-locked + receipt-marked, full pipeline run once end to end on 5 allowlisted addresses, crash-and-reconcile on a real idempotency key | 4.5d | ⏳ **in progress** — 11 slices, 01–05 proven, 06 repaired on PR #150 across nine adversarial rounds. Appetite raised 1.0d → 4.5d by the owner on 2026-08-10 |
| 04 | arc's own mail — ADR-0415 mailer interface + fake + Resend impl, owner allowlist + caps in code, three triggers wired, inbox placement proved on two mailbox classes | 1.0d | ✅ closed 2026-08-08 — 9 live sends, 9 delivered, 74 tests. Closed with ONE row open by the owner's explicit decision: DMARC does not exist, so the Gmail-class header read is deferred behind publishing it |
| 05 | Real campaign — dedicated cold domain, cold-outbound vendor, ≥25 sends to real ICP leads | 1.0d | 🚫 **BLOCKED** → **PARKED to the next cycle** 2026-08-08, taking its 1.0d with it |

**Appetite burn: 7.5 of 11 days used (68%). 10.0d allocated (91%) — absorber 1.0d.**

**`burn:` changed meaning on 2026-08-10 and that is the point.** It used to move only at a phase
close, so on the morning of 2026-08-10 it read 5.5d / 79% while Phase 03 had already spent ≈2.0d
against a 1.0d budget across six slices. A burn number that can only be right between phases is
a burn number that is wrong for the whole time a phase is running — which is the whole time
anyone reads it. It now includes in-flight effort on the open phase, so it is an estimate
between closes rather than a lag.

**Kill checkpoint:** REQ-03's cap/suppression fixtures are green (Phase 01, closed 2026-08-04),
so the 50% criterion does not trip. The **100% line was reached on 2026-08-10** and resolved by
the owner as an explicit extension, 7d → 11d, recorded in `PLAN.md` § Appetite. Extending is
what the rule permits; *silently* is what it forbids.
The absorber exists because of the arc-portfolio lesson (Cycle 4 allocated 100%,
`appetite-sum` warned every run, Phase 02 overran with nothing to absorb it, closed ~112%).

**Re-shaped 2026-08-08.** The owner supplied 5 addresses he controls or knows, which splits the
old Phase 03 in two: the **machine** is proved now as a rehearsal (Phase 03, REQ-07), and the
**business result** — reply rate, bounces, cold-domain reputation, whether the offer lands —
travels to a parked Phase 05 with REQ-05 and its 1.0d. Phase 04 (REQ-08) builds the Resend
transport and the allowlist guard that Phase 03 then reuses, which is why **04 runs before 03**.

**Risk, once and plainly: 1.0d of absorber against five unbuilt slices**, in a lane where every
phase so far cost an adversarial pass that found 19–29 real holes — and where Phase 03's sixth
pass returned three CRITICALs against a commit that had already merged. The old version of this
paragraph predicted "one overrun hits the 100% cut line"; it did, on 2026-08-10, and the line
was paid rather than dodged. 4.5d for Phase 03 is a forecast from the same process that
forecast 1.0d, so the absorber covers about one more slice going wrong.
Mitigation is the ordering — slices 06–08 prove the machine, 09–11 harden it, so if the
absorber goes the cut is 09–11 to the next cycle rather than half a proved rehearsal.

**Kill checkpoint: at 3.5 days burned (50%), are REQ-03's cap/suppression fixtures green?**
If not: stop. Nothing sends, ever, without the guard. Bank the ADR-0400 vocabulary and the
ADR-0404 lint as documentation, retro.

## Phase 05 (the REAL campaign) is BLOCKED — the four things code cannot supply

**Phase 03 is not on this list any more.** The rehearsal needs none of these rows: 5 known
recipients on an allowlist, from the product domain in ADR-0416 rehearsal mode, need no offer,
no ICP, no warmed cold domain and no cold-outbound vendor. What follows blocks the **real**
campaign only.


Pre-mortem row 4 requires every one of rows 1–4 to carry an owner and a **date started**, or to
be explicitly marked **not this quarter**, and forbids recording the cycle CLOSED in
`docs/HISTORY.md` while any row is undated and unmarked. That column is filled below, which is
the only thing that turns the row from a document into a trigger.

| # | Gate row | Who unblocks | Cost | Date started / state (2026-08-08) |
|---|---|---|---|---|
| 1 | A real offer, named | owner | blocked on LexOS billing (P5, Sep '26) | **NOT THIS QUARTER** — owner confirmed 2026-08-08 he cannot yet name the 25 recipients, which is direct evidence the offer is undefined rather than late |
| 2 | **Dedicated domain warmed ≥14d + DMARC green** | owner | **2–4 calendar weeks — the long pole** | **NOT THIS QUARTER** — deliberately not started. Warming a domain against an offer that does not exist starts a clock nobody can use, and `automemory.ai` is the product domain and can never serve this row (ADR-0402) |
| 3 | ICP v0 file | owner | ~1 hour | **NOT THIS QUARTER** — derives from row 1; writing it first would be inventing an audience for an unnamed offer |
| 4 | Calendar link live | owner | ~15 min | **NOT THIS QUARTER** — cheap, but pointless before rows 1–3 |
| 5 | Capability report → provider + verifier | `/arc-capability` | ~1 session | not run — deferred with the phase |
| 6 | LEA-I / EVO-H0 ruling | ✔ resolved — ADR-0408 | done | done |

Rows 2–4 are **calendar-gated, not effort-gated** — start them the moment outbound is
plausibly ≤6 weeks away. Row 2 is the critical path and cannot be compressed. **The trigger to
re-date all four rows is row 1 landing: the day an offer is named, this table is re-opened and
row 2 starts the same week**, because from that day the warm-up is the longest thing between
here and a first send.

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
- **2026-08-08 — cycle re-shaped** via `/arc-change`, in two moves the same day. First, owner
  decision: vendor-first, do not build what vendors already sell, learn from real usage before
  automating — with his own question, "who are the 25 people?", as the forcing evidence that the
  offer is undefined rather than late. Then he refused the park: **5 addresses instead of 25**,
  and finish the lane. That is the better call, because it separates two things the old Phase 03
  had welded together — proving the machine, which 5 known recipients can do, and proving the
  business result, which only strangers can.
  **Result:** Phase 03 becomes the **rehearsal** (REQ-07 expanded, full pipeline once against a
  real server); Phase 04 is **arc's own mail** (REQ-08) and runs FIRST because it builds the
  transport and the allowlist guard Phase 03 reuses; Phase 05 is the **real campaign** (REQ-05
  re-mapped), parked with its 1.0d and its four gate rows marked NOT THIS QUARTER with a written
  re-open trigger — pre-mortem row 4 satisfied.
  **New ADRs:** **0415** — owner-directed mail on a transactional API, allowlist enforced in
  code, and explicitly **no new spine event kind** (a notification is the postman, not the news;
  the fact it carries already has a receipt). **0416** — the outreach path may bind the product
  domain only in rehearsal mode: allowlist-locked, receipt-marked, so real / simulated /
  rehearsal are three classes that never mix in a count. Resend's idempotency keys satisfy
  ADR-0402's hard filter; their **24-hour retention** is recorded as a constraint on ADR-0411's
  reconcile, which must treat an expired key as unresolvable rather than as "never sent".
  **Appetite: 6.5 of 7 allocated (93%), absorber down to 0.5d** — the tightest this cycle has
  been, mitigated by ordering so Phase 04 is a clean stopping line. No assumption trigger FIRED;
  the ledger now records which rows the rehearsal partly answers and which stay open.
- **2026-08-08 — Phase 04 CLOSED.** arc sends its own mail. `mailer()` on `lib/deps.mjs`,
  policy in `lib/mail.mjs`, `.env.local` readable from Node for the first time, and one
  delivery path shared by `arc-leads mail` and `arc-leads notify (canary|approvals|brief)`.
  Merged `074927d` (PR #131), `dd08c16` (PR #133), `#134`. **Appetite 1.0d, actual ~1.0d.
  amendments: 0 · reopened: n.** Tests **47 → 74**; CI 19/19 on the branch and on merged main.
  **Nine live sends through the real vendor — notify 2, canary 3, brief 2, approvals 2 — nine
  delivered, zero bounces, zero complaints**, each in the delivery log and counted against the
  daily cap. Placement confirmed by the owner: **inbox, not spam**. Headers read from the
  delivered mail: `dkim=pass` signed `d=automemory.ai` (aligned to the From domain) and
  `spf=pass` on the envelope domain.
  **Defects, and where they came from — the transferable part.** Two adversarial surfaces
  returned **27 findings overlapping on THREE** (fourth time in this lane that two surfaces
  shared almost nothing). CI found two classes neither saw: a real address in tracked files, and
  eight tests green on Linux and macOS while red on Windows for handing bats temp paths to node.
  Three further reds each taught something — four tests had gone stale in a refactor, **one of
  them passing against a DIFFERENT guard than its name claimed**, which is a green test
  measuring nothing. A local probe caught two before CI, including an `ENOENT`-vs-`ENOTDIR`
  split that made a fail-closed guard fail open on exactly one of three legs. The close ceremony
  found three more: two ADRs still `proposed`, a PLAN naming a module that does not exist, and
  the `approvals` trigger with zero live coverage (proved against a throwaway spine).
  **Closed with one row open, by the owner's explicit decision.** `_dmarc.automemory.ai` is
  NXDOMAIN — no DMARC record exists, so no receiver can report one. `lib/preflight.mjs:82-83`
  refuses on both a missing record and `p=none`, which makes this **Phase 03's entry gate**, and
  the Gmail-class header read is deliberately deferred behind publishing it rather than spent
  measuring a configuration already known to be incomplete.
  Evidence: `initiatives/leads/evidence/phase-04/` (bundle verified).
- **2026-08-09 — Phase 03 slice 05 adversarial pass: 18 findings across two surfaces, zero
  overlap** (sixth time in this lane). The slice shipped `arc-leads report`, whose whole job is
  to refuse rather than answer zero when it cannot look — and **five separate ways to get a
  confident zero out of it survived its own eleven tests**: a quarantined receipt (the emitter
  accepts the send and exits 0), a day file renamed `.jsonl.orig` by a merge, an `events/` that
  exists and holds nothing, `ARC_SPINE_ROOT=""` reading a different spine entirely, and a real
  send stamped in UTC falling outside the IST window that contains it.
  **The test surface was the worse half.** All four refusal tests asserted only `status -eq 2`
  and an empty stdout — the absence-assertion the file's own header condemns — so replacing every
  refusal branch with a crash killed **0 of 11**, because two refusals reach exit 2 only through
  the catch-all `die(2, e.message)` that any exception takes. The flag parser had **zero**
  coverage: neutralising all five of its refusals killed 0 tests, and `--campaign a --campaign b`
  silently last-won. Tests 11 → **29**, every refusal now pinning a substring of its own message,
  and **21 mutants applied to the real tree, 21 killed**.
  **The transferable one:** `sendCounts` validated its window bounds with `assertTs` and tested
  the payload stamps it compares them against with an 11-character prefix. Two grammars judging
  one comparison — D5 wearing a prefix test as a disguise, in the one number ADR-0416 exists to
  produce.

## Now

**Current position, 2026-08-10: Phase 03 is RUNNING. Slices 01–05 proven; slice 06 built, merged
as `bbfcede` (PR #145) carrying an explicit DO-NOT-MERGE, and repaired on
`feat/arc-leads-slice-06-fixes` → PR #150.** Everything below this block is the entry-gate
history that got the phase started and is kept because two of its three rows are the reason the
gate reads the way it does.

**Nine adversarial rounds against slice 06: 3, 9, 10, 8, 2, 3, 2, 1 and 1 CRITICALs.** Two surfaces per round,
near-zero overlap between them every time. Several findings in rounds 2–4 were defects
introduced *by the fix for* a previous round — twice inside the comment explaining that fix, and
once as a flag plus its test shipped without the branch that reads the flag. The headline
repairs: the meeting approval crashed every interested reply, two live approvals for one send
were reachable from a store restore, `.env.local` could move the entire spine, `preflight` could
print `PASS` out of `tests/fixtures`, and the forbidden-name **denylist became an allowlist**
because five rounds each found a different name missing from it.

**Three owner decisions taken today, all recorded rather than assumed:**

1. **Appetite extended 7d → 11d**, Phase 03 1.0d → 4.5d, at the 100% line — `PLAN.md` § Appetite.
2. **From round 5, only a CRITICAL blocks this slice**; HIGH and lesser are carried in
   `phases/phase-03-known-holes.md` and re-open at phase close.
3. **`weigh-tests.yml` dispatched** — 47 of 107 bats files had no measured shard weight (44 of them measured in that run; the other 3 arrived with the merge afterwards and are counted in _known_gap).

**Slice 07 is unblocked:** the owner has someone who will reply by hand, so the real-reply
ingestion follows slice 06 with no wait.

---

**Entry-gate history (kept — Phase 04 CLOSED 2026-08-08, and its gate was THREE rows, not one).** Phases 00, 01, 02 and 04 are closed with both adversarial
surfaces run on each: **123 holes total**, every one found while CI was green. Phase 01 merged
as `52a7a63` (PR #111); Phase 02 as `427d533` (PR #113); Phase 04 as `074927d` (PR #131) and
`dd08c16` (PR #133).

**Corrected 2026-08-09 via `/arc-change`, from findings raised at `/arc-resume`.** This section
used to say *"the one thing standing between here and Phase 03 is a TXT record"*. That sentence
was wrong in both halves — the record now exists, and it was never the only thing. It was
written by reading the gate off the **one refusal line that had just fired** instead of off the
whole gate function from its first check to its last, which is how a three-row gate gets
reported as a one-row gate. A blocker list derived from the last failure is not a blocker list.

| # | Entry gate row | State on 2026-08-09 | Who clears it |
|---|---|---|---|
| 1 | `_dmarc.automemory.ai` resolves **and** enforces | **CLEARED.** Live lookup against 8.8.8.8 returns a `v=DMARC1` record with **`p=quarantine`** and two `rua=` reporting mailboxes (addresses redacted — ADR-0410 applies to every address in a tracked file, not only to lead addresses; the policy tag is the fact that matters here, the reporting inbox is not). Published by the owner after the 2026-08-08 header read | owner — done |
| 2 | `sending_domain` in `.claude/config/leads.json` is non-empty | **OPEN.** It is `""`. `preflight()` looks up SPF for that domain **before** it looks up DMARC, so it refuses at the SPF row and the DMARC row never executes. **This, not the DNS record, is what actually stops the rehearsal today** — and it would have stopped it on 2026-08-08 too, with the same DMARC text on screen | Phase 03 build |
| 3 | `product_domains` names `automemory.ai` | **OPEN.** The list is `["lexos.app"]` only, so ADR-0402's `dedicated-domain` refusal **cannot fire** for `automemory.ai` — bind it and `preflight()` reports it as a perfectly good dedicated domain. ADR-0416 narrowed ADR-0402 to *product domain only in rehearsal mode*, and today **no code enforces that narrowing**; `preflight.mjs` contains the string `rehearsal` zero times | Phase 03 build |

**Rows 2 and 3 are coupled and must land in the same slice.** Adding `automemory.ai` to
`product_domains` on its own makes `preflight()` refuse the rehearsal outright; making
`preflight()` rehearsal-aware on its own leaves the ADR-0402 guard decorative for the one
domain it now most needs to cover. Phase 03's exit criteria carry both, together.

**Both landed 2026-08-09 (PR #136, `5b7deb3`), and the first version of them was wrong in a
way its own 13 tests could not see.** Two adversarial surfaces returned **19 findings with
ZERO overlap** — the fifth time in this lane that two attackers have shared almost nothing.
The headline is worth keeping in front of the next phase:

> **The guard did not guard the send path.** All three rehearsal signals were checked inside
> `preflight()`, and `cmdDaily` — the code that actually sends — never calls `preflight()`. Its
> only domain check was `unsubscribeHeader()`. So `ARC_LEADS_REHEARSAL=1` alone bound the
> product domain into every List-Unsubscribe and entered the send loop, while the gate refused
> correctly in a subcommand nobody had run. **A guard belongs in the shared resolver, not in
> one of its callers.** Defect class D6, at the largest scale this lane has hit it.

Second critical: `LEADS_CONFIG` replaces the config file, so `product_domains` — the
*definition* of "product domain" — was itself overridable, and `"product_domains": []` passed
`lexos.app` through ADR-0402 with a full green. `caps.mjs` had solved this exact class already
(ceilings in code, config may only lower — ADR-0403) and the pattern had not been carried
across. The list is now frozen in code; config may add, never remove.

Tests went 26 → 39 across the two files, one regression test per finding.

### Carried forward from those passes — NOT fixed in PR #136, and each needs a home

| # | Finding | Why it was not fixed there | Where it goes |
|---|---|---|---|
| 1 | `.github/workflows/ci.yml` `_declared` misses bats' `f() { # @test` comment form, so declared can come out LOWER than executed and the step prints `::error::-1 declared test(s) never executed` — a message describing the opposite of what happened | `ci.yml` is a **shared, cross-lane** file (`.claude/rules/lanes.md`); editing it mid-cycle is a known collision cost, and `policy` is LIVE | cross-lane call — needs the other live lane's session, not a unilateral edit |
| 2 | The suite-size floor at `ci.yml:267` is `>= 911` against **1916** real tests: 1005 tests could be deleted before it reddens. Defect class D3 — a threshold that cannot fire on the input it ships with | same shared-file reason | same |
| 3 | `normDomain` folds case and one trailing dot but not zero-width/bidi controls or punycode, so `automemory.ai` + U+200B passes the `dedicated-domain` row | **Contained today** — both product domains are pure ASCII, and the run still refuses at the DNS rows. Latent, not live | Phase 03 spec, a slice of its own |
| 4 | Findings carry no machine-stable reason code, so the tests assert on prose: a pure copy-edit failed three of them, and a behaviour-changing mutant that kept the wording survived | Needs a shape change to every finding in `preflight.mjs`; doing it inside the adversarial-fix commit would have mixed a refactor into a security fix | Phase 03 spec, a slice of its own |
| 5 | Per-recipient allowlist refusal before any network call. The gate proves a lock EXISTS; nothing enforces membership at send time. Note `mail.mjs` already exports `loadAllowlist(env, varName)` and `assertAllowed(to, list)`, and that `varName` parameter exists precisely so a second allowlist can reuse it | Already **slice 04's** stated exit criterion — it was never in this slice's scope | already homed; do not re-file |
| 6 | `tests/leads-rehearsal-guard.bats` has no `tests/shard-timings.json` entry, so it rides `_default_weight` 16 against ~34s measured. Adding the file also reshuffled **33 of 95** files across shards, so any test that passed only by shard luck surfaces on the next unrelated run | That file forbids hand-written numbers — the measured value comes from `weigh-tests.yml`, a 60-job Windows run | owner's call: run the weigh workflow, or accept the imbalance |
| 7 | `journal.mjs` reconcile step 1+2 matches an existing receipt on `{campaign, lead_id, touch_n}` and **not on the mark**, so a rehearsal receipt satisfies the spine check for a real intent and the reverse. Contained today because the vendor idem is mode-free, so one touch to one person is one send whichever mode wrote it | It is the same question as row 10 below — whether a touch may exist twice under two modes is a Phase-05 decision, and answering it inside a fix commit would settle it by accident | Phase 05, with the real-cold-send decision |
| 8 | ~~`arc-leads state --json` folds `outreach.sent` TWICE over one event list — once by hand for `campaigns[k].submitted`, once through `sendCounts` — so two numbers about the same set are free to disagree (D5). They agree today~~ | ~~A shape change to `cmdState`~~ | **CLOSED in slice 05's adversarial fixes.** They stopped agreeing the moment a receipt carried no string campaign: `campaigns.undefined` with `submitted: 1` beside its own `sends.total: 0`. `submitted` is now the fold's own total and the map is keyed off the same string-filtered set the report resolves `--campaign` against |
| 9 | `tests/leads-rehearsal-send.bats` has no `tests/shard-timings.json` entry either, and slice 04 grew it 22 → 28 tests. Same `_default_weight` 16 problem as row 6, and the same reshuffle risk on the next unrelated run | Same reason as row 6: the file forbids hand-written numbers | owner's call, together with row 6 |
| 10 | `idemKeyFor` is deliberately mode-free (journal.mjs documents why: the vendor key must stay a pure function of campaign/lead/touch or the 24-hour dedup stops recognising a resend). The residual is that **one touch to one person can therefore only ever be one send**, rehearsal or real — which is correct for Phase 03 and is an open question the moment real cold outbound starts | Changing it would break the vendor dedup that is the last thing standing between a crash and a duplicate to a real human | Phase 05, with REQ-05 |
| 11 | `.github/workflows/ci.yml`'s `_declared()` AND its test-count floor both grep `^@test `, a grammar blind to bats' `f() { # @test` comment form — the same blindness `tests/leads-mixing-report.bats` argues against at length in the comment above its own self-count test, which is the only counter in the tree that handles both forms | `ci.yml` is shared cross-lane; row 1 above already owns the collision cost, and this is the same file and the same line-shape | with rows 1 and 2 — one cross-lane edit, not three |
| 12 | `tests/leads-mixing-report.bats` has no `tests/shard-timings.json` entry, and slice 05's adversarial fixes grew it 11 → 29 tests. Same `_default_weight` 16 problem as rows 6 and 9, and the same reshuffle risk. **`shard-tests.mjs` should PRINT the count of files riding the default**, so an unmeasured entry is a visible number rather than a silent default (six files came out of the 2026-08-03 merge with no entry at all, riding 16s against real costs up to 123s) | The file forbids hand-written numbers; the measured value comes from `weigh-tests.yml`, a 60-job Windows run | owner's call, together with rows 6 and 9 |
| 13 | `assertTs` rejects years `0001`-`0099` — `PAYLOAD_TS_RE` takes `\d{4}` and the calendar probe uses `Date.UTC(y, …)`, which maps a two-digit year into 1900+y, so `0026-…` fails the round-trip and refuses. Unreachable in the field (every stamp this system mints is this century) | A change to the house timestamp grammar touches every leads receipt and every idem preimage; it is not a fix to make inside a report commit | latent — file it if a fixture ever needs a pre-1900 stamp |
| 14 | The self-count test's `BATS_TEST_NUMBER` cross-check assumes the whole file runs: `bats --filter` counts tests RUN, not file position, so filtering reddens a healthy suite. Latent — CI runs whole files | Noted in the test's own comment rather than removed, because the cross-check is what catches a declared test that never ran | latent; the comment is the fix |

**What changed.** The real campaign was blocked on business inputs that do not exist — the
owner cannot name 25 ICP recipients, which is what an undefined offer looks like from the
inside. He supplied **5 addresses he controls or knows** instead. That does not create an offer,
but it does make the *machine* testable, so the old Phase 03 split: the rehearsal stays here
(Phase 03, REQ-07), the business result parks to Phase 05 with REQ-05 and its 1.0d.

**Phase 04 is BUILT, MERGED and EXERCISED AGAINST THE REAL VENDOR — and it is not closed.**
Merged as `074927d` (PR #131) and `dd08c16` (PR #133), main verified green by dispatch after
each. Owner-directed notification from `automemory.ai` through Resend's HTTP API (ADR-0415).
It also built the two things Phase 03 needs — the Resend transport and the env-declared
allowlist guard — and proved them on mail addressed to the owner, where a mistake costs nothing.

**What is proved, by running it rather than by asserting it.** Seven live messages on
2026-08-08: `notify` 2, `canary` 3, `brief` 2. The vendor reports all seven **delivered**, no
bounce and no complaint. Each is in the delivery log with its vendor id, and the daily quota
counted every one. All three triggers fired end to end, `notify brief` mailing the brief the
renderer produced rather than a second rendering that could disagree with it.

**Two adversarial surfaces returned 27 findings and overlapped on THREE**, the fourth time in
this lane that two surfaces have shared almost nothing. CI then found two classes neither saw —
a real address in tracked files, and eight tests that passed on Linux and macOS while failing on
Windows because they handed bats temp paths to node. Tests went 47 → 74.

**Placement is confirmed: the mail is in the INBOX, not in spam** (owner, 2026-08-08). That is
the half that decides whether this capability works at all, and it is the half a brand-new
sending domain most often fails — a notification path that lands in spam is a notification path
that does not exist. `delivered` from the sending vendor was never that answer: it is the
sender's account of its own work, and the receiver's verdict is a different fact.

**The received headers were read on 2026-08-08, and they found the thing this ceremony existed
to find.** From the Zoho mailbox, on the `approvals` message:

```
Authentication-Results: mx.zohomail.in; dkim=pass; spf=pass
X-ZohoMail-DKIM: pass (identity @automemory.ai)
DKIM-Signature: s=resend; d=automemory.ai
Return-Path: <bounce-id on the send.automemory.ai envelope domain>
```

SPF passes on the envelope domain and DKIM passes signed as `d=automemory.ai` — **aligned to
the From domain**, which is the strong half. **There is no DMARC line, and the reason is not
that Zoho omitted it: `_dmarc.automemory.ai` does not resolve at all** (NXDOMAIN, live lookup
against 8.8.8.8). Nothing was published, so nothing could be evaluated.

**That is a Phase 03 blocker, discovered here rather than at Phase 03's entry.**
`preflight.mjs` refuses when no `v=DMARC1` record resolves, and again when the policy is
`p=none`. REQ-00 is written that way on purpose. So the rehearsal cannot start until a DMARC
record exists **and** enforces — one DNS TXT record at `_dmarc.automemory.ai`, which is the
owner's registrar to add and nobody else's.

**Cleared 2026-08-09.** The owner published it, and a live lookup against 8.8.8.8 now returns
`v=DMARC1; p=quarantine; rua=…`. `p=quarantine` is an enforcing policy, so it clears the
`p=none` refusal as well as the missing-record one. Entry gate row 1 above is closed.

Reading the Gmail-class mailbox's headers was deliberately deferred until after that record
existed: before it, the read would have measured a configuration already known to be
incomplete, and the answer would have had to be thrown away. The sequence was publish DMARC →
re-read on the stricter mailbox. **The first half is now done, so the deferral has expired** —
this is the single row Phase 04 was closed with open, by the owner's explicit decision, and
its stated precondition is met. It is a Phase 03 item now (REQ-07's seed-inbox smoke already
requires ≥2 mailbox classes read from delivered headers, which is the same read).

**Next: Phase 03 — the rehearsal**, on the 5 addresses. The outreach engine has still never
touched a real mail server (ADR-0413).

**Then Phase 03 — the rehearsal.** ADR-0416 lets the outreach path bind the product domain in
rehearsal mode only: allowlist-locked, and every send receipt-marked so those five can never be
counted as real first touches by any report. The five run the complete journey — research →
dossier → draft → lint → L1 approval → send → receipt → real reply ingested → triage →
auto-stop — with the real `lib/provider.mjs` bound to Resend rather than the fake.

**Owner's side, done 2026-08-08:** the `arc@` mailbox created on Zoho, `automemory.ai` verified
in Resend, and `RESEND_API_KEY`, `ARC_LEADS_MAIL_FROM`, `ARC_LEADS_MAIL_ALLOWLIST` and
`ARC_LEADS_REHEARSAL_ALLOWLIST` placed in `.env.local` — arc's one credential home, gitignored,
never in a chat transcript. **Outstanding from him:** the 5 addresses, and at least one recipient
willing to reply by hand — reply ingestion against real mail is the half a send cannot exercise.

**Two naming drifts, tracked rather than patched in passing.** The PLAN names the outreach
provider `lib/provider.mjs`; the built code puts `provider()` on `lib/deps.mjs` beside every
other external edge, and the outreach POLICY lives in `sequencer.mjs`/`guard.mjs`/`journal.mjs`.
And `research-lint.mjs`'s `normKey` does NFC+trim+lowercase WITHOUT the zero-width strip that
`store.mjs normalizeEmail` applies, so two normalizers disagree on invisible characters. Both
predate Phase 04, both need `/arc-change`, and neither is edited from inside this phase.

**ADR-0413's caution survives all of this, narrowed rather than retired.** Phase 03 validates
the Phase 00–02 fixtures **against Resend and against nothing else**. The cold-outbound vendor
is a different market with different terms — transactional providers forbid unsolicited mail —
so Phase 05 re-validates every fixture against whatever it binds. "The send path is exercised"
will be true of the rehearsal vendor only, and any wider reading of it is wrong.

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
