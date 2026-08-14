# Phase 05 — exit criteria, checked against the spec

**Everything here is FIXTURE-PROVEN, not live-validated**, and the tracker records it that way.
There is no Search Console property, so no real CSV exists to ingest and no real `metric.observed`
receipt can be emitted. The machine is ready; the clock has not started (ADR-1115).

## (a) The spec-verify, as a gate rather than a claim

| # | Criterion | Verdict |
|---|---|---|
| 1 | The live ADR-0408 validator is diffed against the frozen spec **by a script, not by reading** | **MET** |
| 2 | Expected output is **exactly** ADR-1109's findings; a new one or a missing one **blocks** | **MET** — returns `D1,D2,D3,D4` |
| 3 | The sanctioned `lead_hmac_v1_` widening is **not** re-flagged | **MET** — probed anyway, so its removal would surface as a new finding rather than as silence |

It **probes behaviour, never source text.** Scraping regexes out of `validate-leads.mjs` would
re-break the moment that file is reformatted and would report a deviation that no longer exists —
a gate whose subject is the source's LAYOUT rather than its BEHAVIOUR.

**Both directions block.** A permissive stub makes all four findings vanish and the gate reports
BLOCKED, because a missing deviation means the shared organ moved and growth's conformance
decision must be re-read.

**Its positive control fired on its own author.** The first conforming payload was missing
`unit_count`, so the gate refused to report AT ALL rather than emit four findings that would each
have been "refused" for the wrong reason.

## (b) The ingest

| # | Criterion | Verdict | Note |
|---|---|---|---|
| 4a | **Range match** — export's own range vs the seven PT days; mismatch REFUSED naming both | **MET** | a missing range is `NO_EXPORT_RANGE`, never an assumption |
| 4b | **Lag floor** — under 3 days old refused | **MET** | the clock is injected; an implicit one cannot be tested |
| 4c | **Headers by content, never by filename** | **MET** | unrecognised set refused rather than guessed positionally |
| 4d | **Never sum rows into a site total** | **MET** | anonymised rows make a per-row sum under-report |
| 5 | slug↔URL join takes the **supersedes-chain head**; a URL with no receipt is reported | **MET** | the stale preview receipt does not join, and the unjoined row is printed rather than dropped |
| 6 | Windows are the verified **PT days converted to IST**, never an independent Monday-IST boundary | **MET** | see below |
| 7 | COMPLETE only after strict idempotent emission; failed/pending is **MISSING, never zero** | **MET** | partial, failed and nothing-attempted all render MISSING |
| 8 | Re-ingest idempotent; corrections land via `supersedes` | **MET via ADR-1117** | see below — this one did not work and had to be fixed |

### The timezone arithmetic, which is what decides whether the feed lies

`2026-W36` → `2026-08-31T12:30:00+05:30 .. 2026-09-07T12:30:00+05:30`. **Not** `00:00+05:30`,
which is what an independently-defined Monday-IST boundary produces — ~12.5h away, covering a
different span of instants than the CSV actually reports. That failure does not error; it
attributes real clicks to the wrong week.

The offset comes from a real IANA zone, not a hardcoded ±7/8. **The DST week `2026-W44` spans 169
hours** and its end bound shifts to `13:30+05:30`. A fixed offset would have silently mis-stamped
every week on one side of the transition.

The derived window is **accepted by the live validator** — asserting the string shape alone would
be asserting that this suite agrees with itself.

### Criterion 8 did not work, and the fix is ADR-1117

Found at this close by probing the live code rather than reading it:

```
leadsIdem(metric.observed, {...week, value: 12})  ->  b9ccf00dbc5493ec…
leadsIdem(metric.observed, {...week, value: 19})  ->  b9ccf00dbc5493ec…   IDENTICAL
```

The preimage excludes `value` — correctly; it identifies *which* measurement this is, not what it
said. The defect is one line up in the emitter: `arc-event.mjs:183` derives the leads key without
`supersedes`, while `:189` passes `supersedes` for the experiment family. So an experiment
correction lands and **a metric correction collides on `DUP_IDEM` and vanishes.** The asymmetry is
invisible from either file alone.

**A fifth deviation, in a surface ADR-1109 never examined** — that ADR diffed the payload grammar;
this is key derivation.

Worked around by a revisioned `source_id` (`gsc-<week>-r<N>`), which is in the preimage and so
gives the correction a distinct key **with no change to a file growth does not own**. Re-ingesting
the same export at the same revision stays idempotent. Changing `arc-event.mjs` was rejected: it
re-keys leads' seven other kinds and 27 fixtures, mid-cycle, from a growth branch.

**Flagged back, not absorbed.** The spec-verify now probes the emitter surface, and the bats test
pins the collision as a **negative control** — if leads fixes that call site the test goes red on
purpose and ADR-1117's revisit trigger fires instead of the workaround rotting.

## (c) The brief line

| # | Criterion | Verdict |
|---|---|---|
| 9 | `arc brief` prints feed age and complete/missing counts as **text** | **MET**, re-derived from the spine on every read, never cached |

**Corrected during this phase.** The line first rendered unconditionally, which put a permanent
two-line block about a lane whose clock has not started into every brief, every day, for every
other lane — inside a renderer with a deliberate 40-line one-screen budget. `spine-brief.bats`,
another lane's suite asserting the exact bytes, broke over it **and was right to**. The empty state
is now opt-in; the company brief is byte-identical when growth passes nothing.

## Your-setup, unchanged

The weekly export is an owner action: set the Search Console range to the exact target week **in
Pacific time**, then export the Pages view. The tool can CHECK that range and refuses on a
mismatch; it cannot SET it. Written up in `initiatives/growth/RUNBOOK.md`.
