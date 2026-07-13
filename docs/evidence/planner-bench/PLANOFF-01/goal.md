# PLANOFF-01 — the shared goal

> **Single source of truth.** Every arm receives the text between the `>>> PROMPT` markers
> **verbatim**, once, with zero additions. Do not paraphrase it, do not "helpfully" clarify it,
> do not append the arm's own house rules to it. Changing one word invalidates the whole bench.
>
> Frozen: 2026-07-12. Any edit after the first arm has run ⇒ this becomes PLANOFF-02.

The prompt is deliberately written the way a real client writes: mostly clear, with a handful of
requirements that are easy to skim past. Those are the traps (see `traps.md` — **sealed**, do not
read it before you have run every arm).

---

## >>> PROMPT START

Build **snip**, a URL shortener, and ship it.

**What it does**

- A signed-in user can create a short link from a long URL.
- Anyone visiting the short link is redirected to the long URL, and the visit is counted.
- A signed-in user can see their own links on a dashboard with hit counts, and delete any of them.

**Requirements**

1. Users sign in with an email magic link. A user only ever sees their own links.
2. Links are stored in Postgres and survive a restart.
3. Short codes are generated automatically, but a user may request a **custom alias** instead.
   Two links can never share a code or alias.
4. A link may be given an **expiry time**. Once a link has expired it no longer redirects.
5. A user may **delete** a link. A deleted link no longer redirects. Deleting is not the same as
   the link never having existed, and the response must say so — the code is *gone*, not *unknown*.
6. Creating links is rate limited to **10 per minute per IP**. Over the limit, the caller must be
   told how long to wait before retrying.
7. The test suite must run with **no network access**: nothing in the test path may call a live
   third-party service (including the email provider).

**API contract** (fixed — the grading suite calls exactly these):

| Method | Path | Behaviour |
|---|---|---|
| `POST` | `/api/links` | body `{ "url": string, "alias"?: string, "expiresAt"?: ISO-8601 }` → `201 { "code": string, "shortUrl": string }` |
| `GET` | `/api/links` | → `200 [{ "code", "url", "hits", "expiresAt" }]` — caller's own links only |
| `DELETE` | `/api/links/:code` | → `204` |
| `GET` | `/:code` | → `302` to the long URL, and the hit is counted |
| `POST` | `/api/test/reset` | test mode only → `204`, wipes links + rate-limit state |

**Auth shim (mandatory, so the app can be graded)**

When `APP_ENV=test`, a request carrying the header `X-Test-User: <email>` is authenticated as
that user, and no magic-link email is sent. When `APP_ENV` is anything else, this header must be
ignored completely. Magic-link sign-in is still the real path in dev/prod.

**Errors** — use the status code that is actually true, not the one that is convenient.

**Done means**

- App runs at `http://localhost:3000` with `APP_ENV=test`, backed by a real Postgres.
- `npm run lint`, `npm run build`, `npm test` all green.
- A `README.md` says how to start it in test mode in one command.

## >>> PROMPT END

---

## What the arm is NOT told

- That there are planted traps, or how many.
- That an external acceptance suite will be run against its build.
- Anything about the other arms.

## Operator crib (for you, not for the arm)

If the arm asks a clarifying question, answer **only** from the prompt above, quoting it. If the
prompt genuinely does not answer the question, reply exactly: *"Use your judgement — that's part
of the task."* and log the question in `runs/<arm>/evidence/questions.md`. Questions asked are a
**signal, not a failure** — an arm that asks about status codes before coding is doing planning
right, and the rubric rewards it (`trap capture`).
