# goal.md — PLANOFF-02 · Phase 2: "team links" (the handoff build)

> This is the **Phase-2 goal**, revealed only to the continuation agent. The continuation
> agent sees the **frozen Phase-1 repo and nothing else** — no chat transcript, no builder
> memory, no operator notes, and an **empty Postgres** (schema must rebuild from the committed
> migrations). Phase 1 was "snip", a URL shortener, already built and frozen acceptance-green
> (15/15). You did not build it. Read what is in the repo, then extend it.

## PROMPT

Extend **snip** so that links can belong to a **team (workspace)**, not just one user.

### What must be true when you are done
1. **Workspaces.** A user can create a workspace and add other users as members. Every existing
   user already has exactly one **personal workspace** (created by your migration). A link
   belongs to exactly one workspace.
2. **Team visibility.** Every **member** of a workspace can see that workspace's links on the
   dashboard (with hit counts) and resolve them. A user who is **not** a member sees none of them
   and cannot act on them.
3. **Owner-only delete.** Only the link's **owner** may delete a link. A teammate who is a member
   of the same workspace may *see and resolve* the link but their `DELETE` is rejected with `403`
   — not silently accepted, not a `500`.
4. **Every Phase-1 invariant survives, on the new team paths too.**
   - A **deleted** link reads as **gone (410)** for *every* member, never `404`, never resurrected.
   - An **expired** link reads as **gone (410)** for *every* member, evaluated at read time.
   - Short **codes/aliases stay globally unique** — an alias taken in one workspace cannot be
     re-used in another (`409`).
   - **Create is still rate-limited 10/min/IP** with a `Retry-After` telling the caller how long
     to wait — keyed by IP, not by user or workspace.
   - The **email seam** stays offline-selectable by config; the real client is never constructed
     at import in test.
   - The **`APP_ENV=test` `X-Test-User` shim stays completely inert** unless `APP_ENV=test`,
     on the new team routes as well as the old ones.
5. **Migration.** Add `workspace_id` to links with a **forward-only, idempotent** migration:
   create one personal workspace per existing owner, **backfill** `workspace_id` for every
   existing row, **then** add the NOT NULL / FK constraint. **Existing short codes must not
   change** — they are public identifiers already in circulation. Running the migration twice
   must leave exactly one personal workspace per user.
6. **Programmatic access (API keys).** A workspace may mint an **API key**; clients create/list
   links with `Authorization: Bearer <key>`. Key requests obey the **same per-IP rate limit**,
   the **same workspace isolation** (a workspace-A key cannot touch a workspace-B resource), and
   must **not** re-open the `X-Test-User` shim in production.
7. **Analytics.** The dashboard shows **clicks per link** and **clicks grouped by day**, and an
   analytics endpoint supports `?from=&to=&groupBy=`. A click is recorded **only on a real 302**
   (never on a 404/410). Hit count and click count share **one source of truth** and can never
   disagree after `POST /api/test/reset`.

### API additions (extend the frozen Phase-1 contract; do not break it)
- `POST /api/workspaces` → create a workspace (caller becomes owner/member).
- `POST /api/workspaces/:id/members` → add a member (owner only).
- `POST /api/workspaces/:id/keys` → mint a workspace-scoped API key.
- `GET  /api/links` → now returns the caller's **visible-workspace** links (personal + member),
  honoring tombstones/expiry; still supports both magic-link session auth **and** Bearer key.
- `DELETE /api/links/:id` → owner-only (`403` for a non-owner member; `403/404` for a non-member).
- `GET  /api/analytics/:code?from=&to=&groupBy=day|week` → per-link click analytics.
- `GET  /:code` → unchanged externally: `302` + click recorded on the live branch only;
  `410` deleted/expired; `404` unknown.
- `POST /api/test/reset` → unchanged; must also zero the new tables.

### Done means
- App runs at `http://localhost:3000` backed by **real Postgres** (schema rebuilt from your
  committed migrations against an empty database — nothing is pre-loaded for you).
- `npm run lint`, `npm run build`, `npm run test` all green.
- README updated with the one-command test-mode start.

## Handoff / multi-context mechanic (why this is unusual)
This is one arm's build split across a **hard agent boundary**. Phase 1 was built by a *different*
session that no longer exists. **The only thing that crossed the boundary is the committed repo.**
Whatever the Phase-1 builder knew but did not write down — into code, a commit message, a typed
schema, a README, or a plan file — is gone. The extension deliberately reuses the maximum number
of Phase-1 seams, so a Phase-2 agent that never understood those seams will corrupt them in ways
that pass any single-endpoint test and only surface in the cross-phase acceptance run.

## Tooling notes
- **Postgres is mandatory** (per protocol — Phase-1's uniqueness/race guarantees must be exercised
  against a real unique index under concurrency, which SQLite could not test). The continuation DB
  starts **empty**; if the frozen repo kept schema only in a warm DB, that is now a real, scored
  failure — rebuild it from committed migrations.
- Third-party services (email, any outbound) stay behind an interface + fake + real chosen by
  config; the real client must not be constructed at module load in test.
- You get a `continue`-only nudge, one hard cap, and you will **never** see the acceptance suite.
