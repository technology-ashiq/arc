# Phase 05 — The EVO-H0 feed

**Goal (one line):** the feed that wakes evolve — to spec, and loudly honest about every gap.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01, phase-04

Serves **REQ-05**. This is the half of EVO-H0 that leads did not ship: leads took the vocabulary,
its campaign is parked, and **zero `metric.observed` receipts exist on the spine today**.

## Exit criteria (Definition of Done)

**(a) The spec-verify, as an executable gate**
1. The live ADR-0408 validator is diffed against `PLAN-evolve` REQ-00's frozen spec **by a script,
   not by reading** — payload keys, idem preimage, `-` absents, `source_id` grammar, window field
   types.
2. Its **expected output is exactly ADR-1109's enumerated findings**: three deviations — ISO-week
   strings vs `assertTs` timestamps · a one-week window's equal bounds vs `window_start <
   window_end` · the dotted surface `growth.title-template` vs `DIMENSION_RE` — plus the fourth
   trap, that absent optionals are a literal `-` **in the idem preimage only** and a payload writing
   `"variant": "-"` is refused by `DIMENSION_RE`, which rejects a leading `-`. **A new finding
   appearing, or a known one disappearing, blocks the phase.** A verify run once by hand is a claim;
   this one is a gate.
3. The already-sanctioned `lead_hmac_v1_` widening is **not** re-flagged — it is on the record as
   deliberate, and a diff that flags it is over-reporting.

**(b) The ingest**
4. `arc growth ingest CSV --week ISO-WEEK` with, each as its own refusal:
   - **Range match** — the export's own date range vs the seven **Pacific-time** days of `--week`;
     mismatch is REFUSED, naming both ranges. This is the guard against the failure that does not
     error: a mis-set UI range produces plausible numbers attributed to the wrong week.
   - **Lag floor** — a week whose last PT day is under 3 days old is refused.
   - **Header parsing by content, never by filename** — the export ZIP's internal filenames and
     whether headers localize could not be verified from any primary source, so an unrecognized
     header set is refused rather than positionally guessed.
   - **Never sum rows into a site total** — anonymized rows make row sums under-report.
5. slug↔URL join taken from `content.published`, **resolved to the receipt that no other receipt's
   `supersedes` names** — the Phase 1 domain cutover leaves two receipts per pre-cutover slug, and a
   join on slug alone picks the stale preview one. A URL with no matching receipt is reported, never
   silently dropped.
6. Windows are **the seven Pacific-time days the range-match guard just verified, converted to their
   IST instants** — never an independently-defined Monday-IST boundary, which lands ~12.5h into a
   different calendar day than the week the CSV actually covers and would misattribute clicks
   silently. `source_id` = `gsc-ISO-WEEK`. Surface: `module: growth`, `surface: title-template`.
7. **A window is COMPLETE only after strict idempotent emission succeeds.** Failed, pending or
   spooled leaves it **MISSING** — never zero.
8. Re-ingest is idempotent; corrections land via `supersedes`.
9. `arc brief` prints feed age and complete/missing counts as **text** — no pixels.

## Verification plan

**Refined 2026-08-14** from the coarse kickoff one-liner. Suite: `tests/growth-feed.bats`.

| # | What is proven | Expected |
|---|---|---|
| V1 | Green **on CI**, per-JOB, at the branch HEAD | every job `success`, three OS legs |
| V2 | The spec-diff returns **exactly** ADR-1109's findings, against the LIVE validator | `D1,D2,D3,D4` — and it PROBES BEHAVIOUR, never scrapes source text, so a reformat of the other lane's file cannot fake a deviation |
| V3 | The gate blocks in BOTH directions | a permissive stub makes all four vanish → BLOCKED. A missing finding means the shared organ moved and growth's conformance decision must be re-read |
| V4 | The spec-verify's own control | a validator that refuses the conforming payload makes the gate refuse to REPORT AT ALL, rather than emit four findings that each mean nothing. It fired on its author (a missing `unit_count`) |
| V5 | Windows are the verified PT days converted to IST | `2026-W36` → `2026-08-31T12:30:00+05:30 .. 2026-09-07T12:30:00+05:30`. NOT `00:00+05:30`, which is what an independently-defined Monday-IST boundary produces ~12.5h away |
| V6 | The offset comes from a real IANA zone, not a hardcoded ±7/8 | the DST week `2026-W44` spans **169 h** and its end bound shifts to `13:30+05:30` |
| V7 | The derived window is accepted by the **live** validator | asserting the string shape alone would be asserting this suite agrees with itself |
| V8 | Range mismatch REFUSED, **naming both ranges** | `RANGE_MISMATCH`; a missing export range is `NO_EXPORT_RANGE`, never an assumption |
| V9 | Pre-lag week refused | `TOO_EARLY`; the clock is injected, because an implicit one cannot be tested |
| V10 | Headers parsed by CONTENT, unknown set refused | `UNRECOGNISED_HEADERS` — never a positional guess |
| V11 | The join takes the **supersedes-chain head** | the live URL joins; the superseded preview URL does NOT, and is reported unjoined rather than dropped |
| V12 | **MISSING is never zero** | partial, failed and nothing-attempted all render MISSING; only fully-confirmed renders COMPLETE |
| V13 | No site total is ever printed | anonymised rows make a per-row sum under-report |
| V14 | The brief line is re-derived every read and reports the empty case | with no receipts it says *the clock has not started*, never `0` |
| V15 | The shared organ is unchanged when growth passes nothing | `arc-brief`'s baseline output is byte-identical, because ten suites from four other lanes assert on that renderer |

**What this phase CANNOT prove, stated rather than smoothed.** Every row above is
**fixture-proven, not live-validated**. There is no Search Console property, so no real CSV exists
to ingest and no real `metric.observed` receipt can be emitted. The tracker records which one each
REQ closed as, and this one closes as fixture-proven. The clock starts when the owner adds the
property (Phase 01, parked — ADR-1115).

**The vacuous-pass guard for this phase:** the MISSING-never-zero fixture must be shown to fail when
the completeness check is disabled. A window state that is only ever printed and never compared
against is the memory lane's `TIE_BREAK` finding wearing different clothes.

## Rabbit holes in this phase

Building the Search Console API fetcher because the CSV ritual is manual — ADR-1108 sets that trigger
at ~800 URLs, not at irritation · any `experiment.*` emission · any verdict math · backfilling
windows from before the property existed (it cannot be done) · perfecting the metric taxonomy when
clicks and impressions are enough · editing `validate-leads.mjs` to make the plans' payload examples
valid.

## Out of scope for this phase

Everything evolve owns: experiments, assignment, verdicts, promotion, rollback.

## Your-setup / pending

The weekly export is an owner action: set the Search Console date range to the exact target week in
Pacific time, then export the Pages view. The tool can **check** that range but cannot set it — the
runbook line matters as much as the code here.

## Non-negotiables (verbatim from PLAN)

- **E2 · Human Sovereignty (Tier E, unamendable):** the machine writes branches and drafts; a human merges every publish, every asset swap, every template change. E2 names *"publishing under Ashiq's name"* itself. Enforced in the command by a module-graph parse plus a running mutant — never by convention (ADR-1102).
- **E3 · The Truth Law:** no fabricated numbers, benchmarks, case studies or testimonials; a source link on every claim-of-fact; arc's own results cited only where a receipt exists; simulated always labelled simulated (ADR-1111).
- **A9 · Appetite over estimate:** 10 days is a cap. Blown means cut or kill.
- **A2 · Boring tech before clever tech** — the site choice names the boring alternative it beat (ADR-1104).
- **A5 · One source of truth** — metrics live on the spine as receipts; no metrics database.
- Exactly **two recurring human gates** (ADR-1112). Lints are **negative-only** (ADR-1110).
- Total-preimage idems everywhere · **MISSING ≠ zero** · corrections `supersedes`, never overwrite · no raw URLs or PII on the spine · reader-only spine access · every emit verified in both `events/` and `events/_quarantine/`.
- Official APIs only · **no cold email anywhere in this module** (that is leads', with its own caps and PII law) · no paid ads.
- **Fixture-proven ≠ live-validated** — the tracker records which one each REQ closed as.
- **Shared-organ edits are conflict-checked, never assumed clear:** before any commit touching `KINDS` in `validate.mjs` or `hq.policy.yaml`, run `git log origin/main --oneline -5 -- PATH` — bench, engine and leads are three other LIVE lanes editing these same company organs this week, and `.claude/rules/lanes.md` records two real collisions already. At the merge take the STRONGER version, never the earlier one, and re-derive any measured value (`KINDS.length`) on the merged tree rather than trusting either branch's count.
