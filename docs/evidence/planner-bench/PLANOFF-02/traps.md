# traps.md — SEALED · do not open until every arm has finished

> Sealed hash committed before any frozen repo was opened (pre-registration, F9). Opening this
> file, or scoring the trap dimension, before the last arm's second continuation completes
> **invalidates the run**. Each trap: **2** = named in a durable artifact or asked as a clarifying
> question *before* coding the relevant path; **1** = implemented correctly but never surfaced;
> **0** = wrong, or found only after acceptance failed. These feed the unspecified-defect and
> ledger dimensions — they are **not** a standalone weighted score, to avoid paying for the
> artifact qua artifact.

Balance: **4 catchable-at-plan-time (H1–H4)** and **4 review/test-cheapest (H5–H8)** — ~1:1, so
the suite does not pre-tilt toward the planning mechanic (F5). H5 is the deliberate hybrid:
catchable in a plan *or* by a written invariant test.

---

## H1 — Isolation predicate must flip at EVERY seam (catchable)
Phase 1 enforced "a user sees only their own links" via a `user_id` filter that recurs at ≥4
seams: `GET /api/links`, the dashboard hit-count query, the `DELETE` authorization check, and the
new analytics read. **Correct:** the read seams (list, hit-count, analytics) become
**workspace-membership**; `DELETE` becomes an **owner-within-workspace** role check. All move as
one coherent edit. **Obvious-wrong:** flip only the visible `GET` filter, pass the happy-path share
test, and leave the stats/analytics query on `user_id` (teammate sees the link but zero hits), or
drop `DELETE` to a bare workspace filter with no role check (any member deletes — violates
owner-only), or leave one seam on `user_id` that blocks a teammate / leaks cross-workspace.
**Why raw's stranger misses it:** greps the first `user_id`, rewrites it, sees the share happy-path
go green, ships; nothing in the running app announces the rule is duplicated.
**Grader:** users A,B in workspace W, C outside. (1) A creates → B's `GET` includes it, B resolves
it; (2) B's `DELETE` → **403** (owner-only), A's `DELETE` → **204**; (3) after A deletes, no member
lists it and `GET /:code` → 410; (4) C's `GET` omits it and C's `DELETE`/analytics → 403/404.

## H2 — Backfill before you constrain; never reissue a public code (catchable)
Adding `workspace_id` changes the schema. **Correct:** forward-only idempotent migration —
create one personal workspace per owner, backfill every row, **then** add NOT NULL/FK, leaving
every existing short code **byte-for-byte unchanged** (codes are public, immutable). **Obvious-
wrong:** `ADD COLUMN workspace_id NOT NULL` with no backfill (existing rows violate it, app won't
boot), a "clean rebuild" that regenerates codes (every live short URL now 404s), or a non-
idempotent migration that double-creates personal workspaces on re-run.
**Grader:** snapshot a Phase-1 code; migrate the inherited DB. (1) app boots; (2) `GET /:oldcode`
still 302s to the same URL; (3) the row now has a `workspace_id` under its owner's personal
workspace; (4) running the migration twice → exactly one personal workspace per user.

## H3 — Soft-delete tombstones must survive migration AND every new read (catchable)
Phase-1 tombstone rule: deleted links stay in the table with `deleted_at` set, resolve to 410,
hidden from the dashboard. Phase 2 adds new reads (workspace list, analytics, CSV export).
**Correct:** every new read carries `deleted_at IS NULL`; every deleted code still 410s after
migration. **Obvious-wrong:** the new `WHERE workspace_id = ?` (and export, and analytics
aggregate) omits the tombstone filter, silently resurrecting deleted links into the team view /
export / click totals.
**Grader:** create, hit once, delete, migrate, open team features. (1) team list omits it; (2)
export omits it; (3) analytics excludes its pre-deletion hit (or marks it gone); (4) `GET /:code`
still **410**, not 404, not resurrected.

## H4 — Third auth path (API keys) inherits rate-limit, isolation, and shim-inertness (catchable)
Bearer API keys are a third identity path beside magic-link and the `X-Test-User` shim.
**Correct:** key requests obey the **same per-IP rate limit**, the **now-per-workspace isolation**,
are scoped to one workspace, and adding the resolver does **not** re-read `X-Test-User` outside
`APP_ENV=test`. **Obvious-wrong:** mount key auth as parallel middleware that skips the limiter,
ignores workspace scope (a W key touches V), or resurrects the prod security shim.
**Grader:** issue a W key. (1) 11 creates/min via Bearer → 11th is **429 + Retry-After**; (2) W key
on a V resource → 403/404; (3) `APP_ENV=production`, request with *both* a valid key and
`X-Test-User: someone@else` → identity is the key's, header ignored; (4) `APP_ENV=production` with
only `X-Test-User` → 401.

## H5 — Hits == clicks, one source of truth; record only on a real 302 (hybrid: plan OR test)
The redirect handler has three exits — 302 (live), 410 (expired/deleted), 404 (unknown).
**Correct:** a click event is inserted **only on the 302 branch**, and hit count + click count
share **one** source of truth so the dashboard number and the event count cannot drift after
`POST /api/test/reset`. **Obvious-wrong:** instrument the top of the handler so 410s/404s log as
clicks; or keep Phase-1's `hits++` *and* add `COUNT(events)` so the two diverge after reset.
This is the **F5 hybrid**: cheapest catch is either a plan line *or* a written reset-then-recount
invariant test — credits TDD/review arms symmetrically with planners.
**Grader:** (1) hit a live code 3× → exactly 3 events, `hits==3`; (2) expire it, hit 3× (all 410) →
0 new events, total unchanged; (3) unknown code (404) → 0 events; (4) `reset` then re-hit → hits
and event-count both zero and stay equal.

## H6 — Daily buckets must be UTC — planning buys nothing (review/probe only)
Latent defect: grouping by server-local timezone (`date_trunc('day', ts)` without UTC,
`new Date(ts).toDateString()`, `date(ts,'localtime')`), so a click at 23:30Z and one at 00:30Z the
next day fall in the wrong/same bucket off UTC, and per-day totals stop summing to the all-time
total across the boundary/DST. This is the Phase-2 heir of 01's percent-escape 500 — "group by day"
reads as done in any plan; **only a straddle-midnight probe or a reviewer catches it.**
**Grader:** insert two clicks at `2026-07-14T23:30:00Z` and `2026-07-15T00:30:00Z`, read daily
analytics. Assert buckets `== {2026-07-14:1, 2026-07-15:1}` in UTC and `sum(daily) == all-time`.

## H7 — Malformed analytics params → 400, not 500 or injection (review/test only)
`?from=notadate` throwing deep in the query builder → 500; `groupBy` string-interpolated into SQL
→ injection/500; inverted/enormous range → 500 or pathological scan. **Correct:** whitelist
`groupBy ∈ {day,week}`, parse ISO `from/to`, require `from ≤ to`, return **400** on bad input,
parameterized throughout. Direct heir of 01's `GET /%E0%A4%A` probe. **Re-tests 01's promotion
candidate** ("only post-build review catches unspecified defects") in a second bench — and is
anti-arc-flattering by design.
**Grader:** (1) `?from=notadate` → 400 not 500; (2) `?groupBy=' OR 1=1--` → 400, no SQL error/leak;
(3) `?from=2026-07-20&to=2026-07-01` → 400 or empty, never 500. Any 500 or altered query fails.

## H8 — Global-uniqueness race under REAL Postgres concurrency (review/probe only)
A plan can *name* "DB unique constraint as source of truth", but the actual check-then-act race
only surfaces under concurrent load against a real unique index — which 01A's single-process
`node:sqlite` structurally could not exercise. **Correct:** a DB `UNIQUE` constraint is the arbiter;
concurrent duplicate-alias creates → exactly one wins, the rest **409**, no 500, no duplicate row;
auto-codes retry on collision. **Obvious-wrong:** `SELECT`-then-`INSERT` that 500s or double-inserts
under a race. Cheapest catch is a **concurrent-probe test**, not a plan line.
**Grader:** fire N concurrent creates with the same alias across two workspaces → exactly one 201,
the rest 409, zero 500, one row.

---

### Bonus unscored signals (recorded alongside)
- Scope inflation (inventing teams-of-teams, SSO, billing, QR codes).
- False-done claims (asserting done while acceptance is red, or while Phase-1 regressed).

### Validity check (run before sealing, as in 01)
A deliberately-lazy reference Phase-2 (flip only the GET filter, one-line NOT NULL alter, top-of-
handler click logging, local-tz buckets, unvalidated params, SELECT-then-INSERT) must fail
**exactly** H1–H8 and pass the rest — proving the traps are real and Opus 4.8 simply doesn't fall
into them, planned or not.
