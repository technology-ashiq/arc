# PLANOFF-01 — traps (SEALED)

> 🔒 **DO NOT READ THIS UNTIL EVERY ARM HAS FINISHED.**
> If you know the traps while operating an arm, you will telegraph them. Then the bench measures
> your prompting, not the planner. Close the file.
>
> Unseal date: recorded in `RESULTS.md` when the last arm ends.

---

Five requirements in `goal.md` are phrased the way real specs are phrased: correct, but easy to
skim. Each one has an obvious-but-wrong implementation. A good **planner** surfaces them *before*
any code is written — either as an explicit line in the plan, or as a clarifying question. That is
the entire hypothesis under test.

Scoring rule for each trap, per arm:

| Outcome | Points |
|---|---|
| Named in the plan (or asked as a clarifying question) **before** implementation | **2** |
| Not planned, but implemented correctly anyway | **1** |
| Wrong, or discovered only after the acceptance suite failed | **0** |

Max 10. Feeds `plan-time trap recall` in the auto-score.

---

## T1 — Deleted ≠ unknown (410, not 404)

**Prompt line:** *"Deleting is not the same as the link never having existed, and the response must
say so — the code is gone, not unknown."*

**Obvious-wrong:** delete the row, let `GET /:code` fall through to the generic 404.
**Correct:** soft-delete (tombstone) → `GET /:code` returns **410 Gone**. An unknown code still 404s.
**Why it's a planner test:** it forces a *data-model* decision (tombstone vs hard delete) at plan
time. Discovered late, it's a migration + a rewrite of the redirect path. Discovered at plan time,
it's one column.

## T2 — Expiry boundary

**Prompt line:** *"Once a link has expired it no longer redirects."*

**Obvious-wrong:** `expiresAt > now()` checked in application code after fetching, or `>=` vs `>`
confusion; expired link returns 404 (or worse, still redirects).
**Correct:** expired link is **410 Gone** and distinguishable from deleted. A link whose `expiresAt`
is *exactly* now is expired. Expiry is evaluated at read time (no cron dependency).
**Planner test:** does the plan state the boundary semantics and the status code, or does it just
say "add expiry"?

## T3 — Alias collision

**Prompt line:** *"Two links can never share a code or alias."*

**Obvious-wrong:** `SELECT … WHERE alias = ?` then `INSERT` — a check-then-act race, and a 500 when
the DB unique index finally fires.
**Correct:** a **unique constraint in the schema** is the source of truth; the collision path returns
**409 Conflict**, not 500, not a silently-different code. Auto-generated codes must also handle the
(rare) collision by retrying.
**Planner test:** does the plan put uniqueness in the DB, or in a `if (exists)`?

## T4 — Rate limit: the *how long to wait* part

**Prompt line:** *"rate limited to 10 per minute per IP. Over the limit, the caller must be told how
long to wait before retrying."*

**Obvious-wrong:** bare `429` with no `Retry-After`; or a fixed-window counter that lets 20 requests
through across a window boundary; or limiting per-user instead of per-IP.
**Correct:** the 11th create in a minute returns **429 with a `Retry-After` header**. The window
behaviour (fixed vs sliding) is a *stated* decision, not an accident. Keyed by IP.
**Planner test:** "told how long to wait" is a header, and almost everyone misses it.

## T5 — Offline email provider

**Prompt line:** *"nothing in the test path may call a live third-party service (including the email
provider)."*

**Obvious-wrong:** import an email SDK, mock it ad-hoc inside one test file, and leave the real
client constructed at module load (which still tries to read an API key / open a socket).
**Correct:** the email sender sits behind an **interface**, with a **fake** used in test and a real
implementation used in prod — chosen by config, not by a test-framework mock. This is exactly arc's
"offline-first: every external dependency gets an interface + fake + real impl" rule, which is why
it's in here: it's the trap arc *should* win, and if arc doesn't, that's a real finding about the
gap between what CLAUDE.md says and what the agent does.
**Planner test:** does the plan name the seam before the SDK is installed?

---

## Bonus signal (not scored, but write it down)

- **Did any arm invent requirements** the prompt never asked for (analytics dashboards, QR codes,
  teams/orgs)? Scope inflation is a planner failure mode and belongs in `RESULTS.md § Notes`.
- **Did any arm claim done while the acceptance suite was red?** Count it in `done-claims.md` — it's
  the honesty metric, and it's the single most useful number this bench produces.
