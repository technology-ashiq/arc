# Phase 01 — exit criteria, checked against the spec

**Phase 01 UN-PARKED 2026-08-16** when ADR-1115's sharpened trigger came true. The criteria below
are verbatim from `phases/phase-01-spec.md`; nothing was reworded to fit what got built.

**UPDATED 2026-08-18.** Criterion 3 is now **MET** — the console was opened and the verified-owner
state captured into this bundle (`gsc-ownership-verified.jpg`). Criterion 5 remains **NOT
APPLICABLE**: there is no pre-cutover receipt to correct and, by the decision recorded below, there
will not be. Every other criterion was already MET. **The phase closes with six MET and one that
never arose, and nothing argued into MET.**

**THE CONSOLE ALSO CONTRADICTED THE PHASE'S CENTRAL ASSUMPTION, AND THAT IS THE MOST IMPORTANT LINE
IN THIS FILE.** This phase exists because Search Console does not backfill, so the clock starts when
the property exists and the site is indexable. Both were true on 2026-08-16. **They were not
sufficient.** Opened on 2026-08-18, the console reported `Indexed: 0`, `Not indexed: 3` with the
single reason **Not found (404)** — three root-domain URLs that have nothing to do with this site —
and a last update of **14/08/2026**, two days before the flip. URL inspection on
`https://arc.automemory.ai/` returned **"URL is unknown to Google"**, `Last crawl: N/A`, **"No
referring sitemaps detected"**.

So Googlebot had never fetched a single page of this site, and the seven days from 2026-08-16 were
accruing nothing. **A read on 2026-08-23 would have returned zero rows and been misread as a real
zero.** The cause was mechanical and had been invisible because nobody had opened the console since
the property was added: **the sitemap was never submitted** (`Submitted sitemaps: 0 of 0`), and with
the site un-indexable until 08-16 there was no other discovery path into it.

Fixed in the same session rather than recorded as a finding: `https://arc.automemory.ai/sitemap-index.xml`
submitted (`gsc-sitemap-submitted.jpg`), and indexing requested for all four live URLs — the
homepage and the three articles (`gsc-indexing-requested.jpg`). The effect was immediate and
visible: `receipts-driven-os` moved from *"URL is unknown to Google"* to **"Discovered – currently
not indexed"**, with `Sitemaps: https://arc.automemory.ai/sitemap-index.xml` now named as its
discovery source.

**The lesson generalises past this phase.** Every criterion here was about what *we* published, and
all of them passed. Not one of them asked whether the other side had *received* it, so the phase
could be entirely green while the only thing it exists to start had not started. `INDEXABLE = true`
is a fact about our server; being crawled is a fact about Google, and the second does not follow
from the first. `gsc-page-indexing-before.jpg` is kept as the record of that state.

## The criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Domain named, **its own one-way ADR written**, options + consequences + a real revisit trigger | **MET** | `docs/adr/1118-*.md`. Names the option it REJECTED: `automemory.ai/arc` was the stronger long-run SEO position and lost to repo independence (ADR-1104), knowingly, while both addresses were at zero authority |
| 2 | DNS + TLS green; the site serves over HTTPS at the chosen host | **MET** | `https://arc.automemory.ai/blog/receipts-driven-os` → 200. Nameservers `meera`/`noel.ns.cloudflare.com` |
| 3 | Search Console **Domain** property added and verified | **MET 2026-08-18** | `gsc-ownership-verified.jpg` in this bundle: **"You are a verified owner"**, verification method **Domain name provider — Successfully verified**, property `sc-domain:automemory.ai`, so root plus every subdomain on one property and one clock. Captured from the console itself, not inferred from DNS. The earlier PARTIAL was correct at the time: the TXT resolving from `8.8.8.8` and `1.1.1.1` proves the token is published, never that Google accepted it — only the console can say that |
| 4 | `content.published.site` re-pinned to the permanent host **in configuration** | **MET** | `initiatives/growth/site.json` + `loadSiteConfig`. There was no configuration surface at all before this — `publish` never touches `site` and the steel thread passed the host on the command line |
| 5 | Every pre-cutover receipt corrected **by `supersedes`, never edited** | **NOT APPLICABLE** | The path is built, adversarially attacked and proven end-to-end through the real emitter. There is no pre-cutover receipt to correct and, per the decision below, there will not be: the steel-thread receipt carries the permanent host because the domain landed before the first publication. Not a vacuous pass and not a gap — an occasion that never arose |
| 6 | `sitemap.xml` reachable at the permanent host | **MET** | Was **404** — Astro emits `sitemap-index.xml`. Fixed by SERVING the conventional path (`vercel.json` 308), not by rewording the criterion to match whatever the build emits. Verified through the preview: 200, `application/xml` |
| 7 | `llms.txt` generated and well-formed — existence only, **never a lever** (ADR-1113) | **MET** | And it had already drifted: a static `public/` file listing one article while the site served two. Now generated from the same content glob as the homepage and the sitemap |

## Criterion 5 will most likely never be satisfiable, and that is the RIGHT outcome

Worth settling here rather than at the merge, because the tempting move is the wrong one.

Phase 00 criterion 10 says the steel-thread receipt carries **the preview host**, and that Phase 01
corrects it by `supersedes` — "the specified path, not a workaround". That was written when **no
domain existed**. It does now: the article will be served at `arc.automemory.ai` the moment PR #2
merges.

So emitting the receipt with the preview host would mean **writing down something untrue** — a
receipt asserting an article lives at an address it does not — purely so that criterion 5 has
something to correct. That is a fabricated fact created to tick a box, and **E3 forbids it** in
plainer terms than any convenience argument can answer.

**Decision: the steel-thread receipt is emitted with the permanent host**, and criterion 5 closes
as *not applicable* rather than met. The cutover machinery is built, adversarially attacked and
proven end-to-end against the real emitter — it simply never has to run, because the domain landed
before the first publication did. Capability without an occasion to use it is a good outcome; a
false receipt manufactured to give it one is not.

The machinery is not wasted either way: `resolveSlugUrl`, `planCutover` and the ULID chain are what
every FUTURE correction rides on, and the two defects found building them were live defects in
shipped code regardless of whether a cutover ever happens.

## What the criterion-5 machinery actually proved

The mechanism is real even though the criterion never comes due, and the distinction matters:

```
first emit  exit=0   id=01M05AC3GBJQ6B1TM1KMWAGA8Q
second emit exit=0   --supersedes <that ULID>
report: link-intact=true  idems-differ=true  bytes-identical=true  site=arc.automemory.ai
quarantined=0
```

Two receipts, linked by ULID, **different idems from identical bytes** — which is the whole point:
`site` is in the preimage, so the re-pin is a new fact rather than a duplicate. Verified in
`events/` and absent from `_quarantine/`, because exit 0 is not evidence.

## Two silent defects found while building it (ADR-1119)

Neither was caught by the phase that shipped them, and both fail without an error:

1. **`resolveSlugUrl` resolved the chain from `payload.supersedes`** — a key the closed payload
   shape can NEVER carry (`assertContent` refuses it outright). The superseded set was always
   empty, every receipt looked like a head, and the URL map resolved last-wins by array order.
2. **It compared that value against `content_sha`** — which a re-pin leaves unchanged, so both
   receipts were filtered out and a real week of clicks fell out of the join. Reproduced before
   fixing: `joined: 0, unjoined: 1`.

The covering test used two *different* `content_sha` values — the single shape in which a
sha-keyed chain works — and put `supersedes` in a payload that cannot carry it. A fixture that
cannot exist cannot observe the failure it is named for.

## The mandatory two-surface adversarial pass

Two fresh attackers, decision logic and encoding/OS boundary. **23 real findings, overlap of 2.**

| Severity | Finding | State |
|---|---|---|
| CRITICAL | `contentIdem` **collides at the UTF-8 encoding boundary** — a lone surrogate encodes to the same bytes as U+FFFD, so two different titles share one idem and the second dies as `DUP_IDEM`. The C2 loss class, inside the rule written to prevent it | FIXED, both in `contentIdem` and `assertContent` |
| HIGH | `content_sha` was **two different functions**: the draft path BOM-stripped and re-encoded, the publish path read raw. The BOM twin of that same day's CRLF fix — **fifth twin-fix recurrence in this lane** | FIXED; a BOM is now refused, not stripped |
| HIGH | A **mutant ignoring the chain entirely** passed the rewritten test — one slug per fixture made array order and chain order indistinguishable | FIXED; head listed before its predecessor, second slug added |
| HIGH | `classifyPublication` still returned a `content_sha` as its supersede pointer, in the **third** adjacent file, cited as MET in the phase-04 bundle | FIXED, renamed `supersedesEventId` |
| MEDIUM | `repinUrl` **invented a path** out of a query string, fragment or password | FIXED, authority ends at the first of `/ ? #` |
| MEDIUM | `checkSitemapCoverage` **stripped the host and never compared it** — in the one phase whose subject is a host change | FIXED, `expectedSite` required |
| MEDIUM | Same checker blind to CDATA, namespace prefixes, tag attributes and tag case; its `parsed` counter used the same regex, so it could not see what it was failing to read | FIXED |
| MEDIUM | `planCutover` reported forks, cycles, duplicate events, ambiguous slugs, unreadable payloads and idem collisions **as work** | FIXED, all refused by name |
| MEDIUM | `loadSiteConfig` crashed with a bare `SyntaxError` on a BOM (Windows leg only), took the last of a duplicate JSON key silently, and accepted unknown keys while its neighbour refused them | FIXED |

**A regression I introduced and caught in verification:** the first CDATA fix stripped *all* CDATA,
which also removes legitimate `<loc><![CDATA[url]]></loc>` entries. Unwrapping inert text while
dropping CDATA that contains markup handles both directions.

**A NUL byte** had got into `cutover.mjs` as the `idemTuple` separator. It now joins on the same
`|` the spine uses — a collision predictor keyed differently from the thing it predicts is worse
than none.

## The clock, stated because it is why this phase exists

**Adding the Search Console property did NOT start evolve's four-week clock.** The site serves
`noindex, nofollow` plus `Disallow: /`, so Google accrues zero impressions and Search Console holds
zero Performance rows. Property **and** indexability together are the condition. ADR-1105's
one-for-one day loss did not get paid off — it **moved**, to the `INDEXABLE` flip, which is
prepared as arc-site PR #3 and awaits the one merge click E2 reserves for a human.
