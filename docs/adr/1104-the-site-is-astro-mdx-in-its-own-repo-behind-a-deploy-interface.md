# ADR 1004 — The site is static Astro + MDX in its own repository, behind a deploy interface

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** the site needs a server runtime (auth, forms, personalization) — then the
static choice is re-argued on that need, not on preference.

## Context

ADR-1103 puts the site in scope, so its stack and its home must be decided now. Constitution
**A2** governs: *"Boring tech before clever tech… any clever choice must name the boring
alternative it beat and why."* The root `CLAUDE.md` lists Next.js/Tailwind/Vercel, but that
section is unfilled template boilerplate (`Name: TODO`, `Goal: TODO`) — arc itself is bash and
zero-dep Node, so those lines are not a standing decision for a new surface.

The site's whole job is: render MDX at `/blog/<slug>`, emit a sitemap, serve a few static files
(`llms.txt`, an IndexNow key), and produce a **per-PR preview URL** — because the review pack is
invalid without one (REQ-03).

`GRO-C` requires providers behind interfaces. Video and email providers are moot — ADR-1103 cut
both REQs — so the interfaces that actually exist this cycle are **deploy** and **search-console
ingest**.

## Options considered

1. **Astro, static output, MDX first-class, own repo.** Purpose-built for content; MDX and
   sitemap are supported integrations rather than hand-rolled; output is plain HTML with no
   runtime.
2. **Next.js App Router.** Con: a server framework rendered static, so it carries a runtime, a
   build cache and a config surface this site never uses; MDX needs more wiring for the same HTML.
3. **Hand-rolled generator, zero deps** — the boring floor. Con: MDX parsing, syntax
   highlighting, sitemap, RSS and preview builds all become arc's maintenance, and none of them is
   the thing this cycle is trying to learn. This is the alternative A2 asks to be named: it loses
   on maintenance surface, not on principle.
4. Site as a subdirectory of the arc repo. Con: the deploy would build from the repo holding
   `.claude/`, the spine tooling and every private plan — one misconfigured output directory
   publishes arc's insides. A publish is irreversible (indexed, cached), so this is the wrong
   default even though it is the convenient one.

## Decision

**Option 1 + own repository.** Static Astro with MDX; `arc-site` as a separate repo the growth
commands operate on through a configured path. Arc's private tooling is never inside the deploy
root — a boundary enforced by repository separation rather than by a build-config field somebody
must keep correct.

**Deploy provider behind an interface** (GRO-C):

| Dep | Interface | Fake | Real | Contract test |
|---|---|---|---|---|
| Deploy host | `deploy preview <dir> → {url}` · `deploy status <id>` — never `promote`; promotion is the human's merge (ADR-1102) | local static server on a temp port, returns a `http://127.0.0.1:PORT` URL | the owner's host account, chosen at Phase 1 | preview returns a URL that actually serves the built `/blog/<slug>`, proven against the fake in CI and against the real host once at Phase 1 |

Every growth test runs offline against the fake. The real host is exercised exactly twice: the
Phase 0 walking skeleton and the Phase 1 cutover.

**Evidence:** `CONSTITUTION.md:37` (A2, and its name-the-boring-alternative clause) · root
`CLAUDE.md` § Tools/Tech (unfilled template) · design source REQ-03 (review pack invalid without a
preview URL) · GRO-C.
**Confidence:** medium — the stack is a judgment call on maintenance surface, not a measurement.
Tracked as Assumption A-03 with the Phase 0 exit as its test: if the skeleton is not serving a
real MDX article on a preview URL inside its line, the stack is wrong and option 3 is the fallback.
**Rejected because:** option 2 carries a runtime the site never uses; option 3 makes arc maintain
a static-site generator instead of a content engine; option 4 puts arc's private tree inside a
public deploy root.

## Consequences

Easier: preview deploys per PR are a first-class feature rather than a thing to build, and the
private/public boundary is physical. Harder: growth's commands now operate across **two** git
repositories, so every path is configured rather than relative, and `content_sha` must be read
from the *site* repo's merged tree — a fixture pins that it is never read from arc's.
