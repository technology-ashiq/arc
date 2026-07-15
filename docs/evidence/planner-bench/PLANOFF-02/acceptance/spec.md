# acceptance/spec.md — what the black-box grader checks (arms never see this)

Granular, per-probe **partial credit** (a large two-phase build risks nobody finishing; pass/fail
would throw away signal). Run against the **post-Phase-2** build; the regression block is also run
on the **frozen** build for the D5 before/after comparison. Every probe is executed against **real
Postgres** with a fresh, empty DB rebuilt from the arm's committed migrations.

## Specified probes (the Phase-2 goal states these in plain words)
1. **Phase-1 regression — all 15 original snip checks (A1–A15) still pass** on the post-Phase-2
   build: anonymous-reject, own/visible-links-only, 302 + hit-count, 404 unknown, 410 deleted,
   410 expired, 409 dup-alias, global uniqueness, 429 + Retry-After.
2. **Team share:** owner shares a link into a workspace; a **member's** `GET /api/links` now
   includes it; a **non-member's** does not.
3. **Owner-only delete:** a member's `DELETE` on a link they don't own → **403** (not silently
   accepted, not 500); the **owner's** `DELETE` → 204.
4. **Deleted shared link → 410 for every member** (Phase-1 tombstone honored on the new team read
   path, not just the owner path).
5. **Expired shared link → 410 for teammates too** (read-time expiry preserved across visibility).
6. **Alias uniqueness stays GLOBAL after teams land:** an alias taken in workspace A cannot be
   reused in workspace B → **409** (uniqueness not re-scoped per-workspace).
7. **Migration correctness:** existing codes unchanged and still 302; each pre-existing link now
   sits in its owner's personal workspace; migration is idempotent (twice → one personal workspace
   per user); app boots against the migrated DB.
8. **API key path:** Bearer-key create/list works, is workspace-scoped, and shares the rate limit.
9. **Analytics:** clicks-per-link and clicks-grouped-by-day are returned; click recorded only on
   the 302 branch.

## Unspecified probes (the spec never mentions these — measure more than compliance-with-itself)
10. **Malformed percent-escape does not 500:** `GET /%E0%A4%A` (01's one real unspecified bug) and
    a malformed JSON body on the team-share endpoint both return a clean **4xx** — re-tests whether
    that defect was ever fixed and whether Phase 2 reintroduced it.
11. **Cross-team isolation leak:** `GET /api/links` must not leak a teammate's **non-shared** links,
    nor any user's email/PII, in the response body.
12. **Real-Postgres concurrency race (H8):** N concurrent same-alias creates across two workspaces →
    exactly one 201, the rest 409, no 500, no duplicate row.
13. **Rate-limit intact after Phase 2 touched the create path:** still **IP-keyed** (not per-user),
    11th create/min → 429, `Retry-After` a valid delta-seconds/HTTP-date.
14. **Auth-shim inertness on the NEW routes:** with `APP_ENV=production`, `X-Test-User` is ignored on
    the team-share / team-list / analytics endpoints, not only on the original `/api/links`.
15. **Double-delete / tombstone idempotency:** `DELETE` an already-tombstoned link → stable
    204/410, never a 500, never resurrection to a live redirect.
16. **UTC daily buckets (H6):** two clicks at `2026-07-14T23:30Z` and `2026-07-15T00:30Z` →
    `{2026-07-14:1, 2026-07-15:1}` in UTC, and `sum(daily) == all-time`.
17. **Malformed analytics params (H7):** `?from=notadate` → 400; `?groupBy=' OR 1=1--` → 400 with no
    SQL error/leak; inverted range → 400 or empty, never 500.
18. **Hit==click consistency (H5):** after `POST /api/test/reset`, hit count and event count are both
    zero and stay equal; 410/404 exits record no click.
19. **Persistence includes Phase-2 tables:** bounce Postgres, confirm team shares survive — the
    continuation DB was rebuilt from committed migrations and the new tables inherited persistence.
20. **Error hygiene:** force a 500-class path; the response body carries no stack trace, DB DSN, or
    secret — credits arms whose review process hardened error paths.

## Scoring note
Probes 1–9 feed D1/D4 (specified handoff success + regression). Probes 10–20 feed D5 (unspecified-
defect resilience) and are run on **both** frozen and post-Phase-2 builds, so an arm whose *process*
(review/tests) hardened the endpoint is credited over one whose *plan* merely named the happy path.
