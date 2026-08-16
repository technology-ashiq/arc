# ADR 1108 — The weekly ingest reads a range-matched CSV of Pacific-time days, and refuses everything it cannot prove

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** published-URL count passes ~800, or a window is ever found to have been
attributed to the wrong week — either one moves the ingest to the Search Console API
(`searchanalytics.query`), whose `dataState` metadata and 25,000-row pages remove the two limits
this design works around.

## Context

GRO-F fixes the ingest at "GSC CSV · ISO weeks · ≥3-day lag rule · `source_id` = `gsc-<iso-week>`".
Research against Google's own documentation on 2026-08-12 contradicted or sharpened four parts of
that, and every one of them can silently corrupt a metric feed rather than fail loudly:

1. **Search Console days are Pacific Time** (`America/Los_Angeles`), confirmed on Google's own
   report pages. Arc's spine stamps are IST. An "ISO week" is therefore a span of seven **PT**
   calendar dates, not seven IST days.
2. **A CSV export is not page × date.** It is one row per dimension value, with metrics
   **totalled over whatever date range is currently set in the UI**, and Google confirms the export
   carries "the data currently shown in the report, with any filters applied". So "bucket per-URL
   daily rows into ISO weeks" — the design source's wording — is **not achievable from a manual
   export at all**. The real mechanic is: set the range to the target week, then export Pages.
   That makes a human's date-range setting a *correctness* dependency, which nothing in the design
   source guarded.
3. **The CSV carries no "still preliminary" signal.** That metadata (`dataState`,
   `first_incomplete_date`) exists only in the API. Google documents data as "typically available
   after 2–3 days", and separately documents a settling period where fresh numbers still move —
   and multi-week freeze incidents are on the public record.
4. **The export truncates to 1,000 rows**, and low-volume query rows are anonymized out, so
   summing rows does not reproduce site totals.

## Options considered

1. **Range-matched CSV ingest with refusals, plus a documented weekly ritual.**
2. Build the API fetcher now. Con: the design source's no-go list rules out analytics-API fetchers
   for v1, and it trades a 0.5d ritual for OAuth/service-account setup this cycle has no room for.
3. Trust the operator to set the range correctly. Con: the one manual step in the whole feed
   becomes the one unverified step, and a mis-set range does not fail — it attributes real numbers
   to the wrong week, which is worse than a gap because a gap is visible.

## Decision

**Option 1.** `arc growth ingest <gsc-csv> --week <ISO-week>` and it **refuses** rather than
guesses:

- **Range match (the new guard).** The export's own date-range metadata is read and compared to
  the seven PT dates of `--week`. Mismatch → **REFUSED**, naming both ranges. This is the guard
  that item 2 above showed was missing, and it is a fixture.
- **Window encoding.** `window_start` / `window_end` are **the seven Pacific-time days the
  range-match guard just verified, converted to their IST instants** — half-open `[start, end)`,
  spelled `YYYY-MM-DDTHH:MM:SS+05:30` as `assertTs` demands, with distinct bounds because the live
  validator refuses `start >= end`.

  An adversarial pass killed the first version of this rule, which took the ISO week's Monday
  `00:00:00+05:30` as the bound. PT and IST are ~12.5h apart, so an independently-defined
  Monday-IST boundary covers a different span of instants than the PT week the CSV actually
  reports — and stamping a PT-verified export with an unrelated IST boundary is the *silent*
  failure: it does not error, it attributes real clicks to the wrong week. Deriving the bound from
  the verified PT days makes the receipt describe exactly the data that produced it.
- **Lag: ≥3 days is a floor, not a completeness guarantee.** An ingest of a week whose last PT day
  is under 3 days old is refused (fixture). Because the CSV cannot say "preliminary", a re-ingest
  that yields different numbers is **expected**, and lands as a new receipt with `supersedes` —
  never an overwrite. The correction path is load-bearing, not defensive decoration.
- **`source_id` = `gsc-<ISO-week>`** (e.g. `gsc-2026-W36`), which satisfies the live
  `SOURCE_ID_RE` first alternative. No URL and no PII ever enters it.
- **Parse by header content, never by filename.** The exact filenames inside the export ZIP could
  not be verified from any primary source, and whether headers localize to the account's UI
  language could not be verified either — so the parser identifies columns by matching header
  content defensively and **refuses on an unrecognized header set** rather than positionally
  guessing.
- **Never derive a total by summing rows.** Anonymized rows make per-row sums under-report; only
  per-URL figures are emitted, and no site-total metric is claimed.
- **Window COMPLETE only after strict idempotent emission succeeds.** Failed, pending or spooled
  leaves it **MISSING**, never zero — and `arc brief` prints feed age and complete/missing counts
  as text.

**Evidence:** [Performance report / Discover — timezone `America/Los_Angeles`](https://support.google.com/webmasters/answer/9216516?hl=en)
· [Export data directly from a report](https://support.google.com/webmasters/answer/12919797?hl=en)
(exports the current view + filters; truncated to 1,000 rows) ·
[Getting your performance data](https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data)
("data is typically available after 2-3 days") ·
[Performance data filtering and limits](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
(anonymized queries) · [searchanalytics.query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
(25,000-row pages, `dataState`) · npm packages verified to exist for the deferred API path:
[`@googleapis/searchconsole`](https://www.npmjs.com/package/@googleapis/searchconsole) and
[`googleapis`](https://www.npmjs.com/package/googleapis), both maintained by Google's Node client
team · live regexes at `validate-leads.mjs:30, 74, 85`.
**Confidence:** high on the timezone, the export semantics, the row cap and the lag baseline — all
from Google's own pages. Medium on the export's internal filenames and header localization, which
is exactly why the parser refuses instead of assuming.
**Rejected because:** option 2 breaks a stated v1 no-go for a limit that does not bind at ten URLs;
option 3 leaves the only manual step unverified, and its failure mode is silent misattribution.

## Consequences

Easier: every way this feed can lie — wrong week, early read, unreadable export, partial emission
— now has a refusal with a name, and the deferred API upgrade has a numeric trigger rather than a
vague "later". Harder: the weekly ritual has a mandatory operator step (set the range to the exact
PT week) that the tool can only *check*, not perform, so the runbook line matters as much as the
code.
