# ADR 1412 — Gallery eligibility is decided by robots.txt and terms, not by gallery quality

**Status:** accepted
**Date:** 2026-08-23
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a source's robots.txt or terms change in our favour (or against us) — the
registry row moves on re-checked evidence, and the re-check is part of the retro metric pack.

## Context

[ADR-1408](1408-dsv-i-one-source-registry-owner-born-lint-guarded.md) files eight free
galleries as reference sources, six of them `active`, on the assumption that a free public
gallery is fetchable. Verification on 2026-08-23 falsified that assumption for most of them.

The design source's open question was whether Dribbble and Behance should be `trial` or `off`
on **quality** grounds. That was the wrong axis: they are excluded on **permission** grounds,
and so are two of the sources filed as `active`.

## Options considered

1. **Fetch what is reachable and handle complaints later** — pros: a full pack day one / cons:
   arc runs on Claude, and two of these sites name ClaudeBot in an explicit `Disallow: /`;
   ignoring a named exclusion is a governance defect, not an oversight.
2. **Registry status derives from robots.txt + terms, checked per source** — pros: the
   permission model is evidence-backed and re-checkable / cons: the day-one pack is much
   smaller than planned.

## Decision

Option 2. Initial registry status, on checked evidence rather than reputation:

| Source | Status | Why |
|---|---|---|
| **Lapa Ninja** | `active` | `Allow: /`, only `/api/` disallowed; server-rendered, plain fetch returns real HTML |
| **SaaSFrame** | `active` | Generic `*` disallows only query URLs; server-rendered, no JS needed |
| **Awwwards** | `link-only` | Terms forbid reproduction of its material — provenance link permitted, **local image cache is not** |
| **Godly** | `off` | robots.txt sets `ai-train=no` and names **ClaudeBot** in `Disallow: /`; also a JS-only shell |
| **Dribbble** | `off` | Developer terms, verbatim: *"Scraping, copying, saving, or storing our data is strictly prohibited."* |
| **Behance** | `off` | robots.txt names ClaudeBot `Disallow: /`; edge infra rate-limited a single automated GET |
| **Land-book** | `off` | Cloudflare bot challenge returns 403 even for robots.txt — permission unreadable, so unusable |
| **Page Collective** | `off` | TLS handshake failed on two independent fetchers — **unverified, not disallowed**; may move to `trial` after a headless-browser probe |

This adds one `allowed_use` value, **`link-only`**, for a source we may cite but never cache.
The design source's own rejected-row 4 established that day-one facts get to falsify this
grammar; this is the second time they have.

**Evidence:** per-site robots.txt and terms fetched 2026-08-23; the Dribbble clause is quoted
from developer.dribbble.com/terms. **Confidence:** high for Dribbble, Godly, Behance, Lapa
Ninja and SaaSFrame (primary sources read directly); medium for Awwwards (terms via snippet);
Page Collective is explicitly **unverified** rather than judged.

**Rejected because:** classifying these by gallery quality would have kept two ClaudeBot-excluded
sites and an explicit anti-storage ToS inside an automated fetch path.

## Consequences

Easier: the curator's permitted set is a fact the registry states, and a `status: off` source is
never fetched by construction. Harder: REQ-04's *"provenance from ≥2 sources"* now has **exactly
two** qualifying sources and zero margin — if either breaks, that acceptance cannot be met, which
is why it is carried as an assumption-ledger row with a real trigger rather than as a safe
assumption. The curator therefore performs a **robots.txt preflight per fetch and refuses on
disallow**, so permission is enforced mechanically rather than by this table staying current.

## Amendment 2026-09-27 — the zero margin was spent on the first real build

The assumption-ledger row fired on the first real pack build (Phase 02, 0 screens added):

- **Lapa Ninja** — its Cloudflare answers `robots.txt` with **403** to `ClaudeBot` and
  `Claude-User`, while a browser agent gets through. That is the site refusing Claude. A borrowed
  agent string would be evasion, so the row goes **off**.
- **SaaSFrame** — pages browse fine, but every screenshot is served from Webflow's shared CDN
  (`cdn.prod.website-files.com`), whose `robots.txt` answers **403 AccessDenied**. Permission is
  unknown for every image the gallery shows, and adding a host shared by every Webflow site to one
  row's binding would bind nothing. The row goes **off**.

The owner chose the replacements on 2026-09-27, on the same test this ADR applies, run by probe
the same day: **nicelydone.club** and **collectui.com** go **active**. Each serves `robots.txt`
as plain text allowing `ClaudeBot` and `Claude-User` on both the page host and the image host, and
neither publishes terms at the usual paths. The rule did not change; the table did, which is the
mechanism working. The preflight per fetch still decides every request.

### Second change, same day: saasui off, screensdesign born off

collectui is a client-rendered app, so a plain fetch reaches no screen URL. The owner then made
**saasui.design** active. Its homepage images were on its own host, but every screen on an
application page is on **cdn.sanity.io**, a CDN shared by every Sanity project: the SaaSFrame
case again. The site's `/_next/image` proxy is on saasui.design, but its query (~120 bytes) is
past the curator's 64-byte cap (ADR-1420). The owner declined widening that boundary for one
gallery, so the row goes **off**.

**screensdesign.com** was scouted as the replacement. robots allows both agents, and every screen
image is on its own `media.screensdesign.com`. But its Terms of Service §(e) forbid "any robot,
spider, scraper, or other automated means" without prior written consent. It is recorded **off**
so it is not scouted again. The lesson is about order: a homepage count is not the screen pages,
and the terms page is read before any probe, not after.

That leaves one working source (nicelydone). The owner amended REQ-04 from "≥2 active sources"
to "≥1" through `/arc-change` rather than widen a boundary or keep scouting (0 of 5 clean). The
price is a new PLAN ledger row: if Phase 03's jury shows single-gallery bias, a second source is
mandatory again before Phase 05.
