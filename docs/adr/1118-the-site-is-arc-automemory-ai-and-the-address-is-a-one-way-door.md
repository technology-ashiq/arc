# ADR 1118 — The site is `arc.automemory.ai`: a subdomain of the company root, chosen as a one-way door

**Status:** accepted
**Date:** 2026-08-16
**Product:** `growth`
**Reversibility:** one-way
**Revisit trigger:** **arc is spun out, sold, or branded independently of automemory.** That is the
only condition that makes this address wrong, and the move must be decided *before* there are
inbound links worth losing — after that point the cost stops being a redirect map and starts being
the ranking history itself. There is no "we changed our mind" trigger, deliberately: URLs,
backlinks and Search Console Performance history do not survive a move, and ADR-1105 already
established that Google backfills none of it.

## Context

ADR-1105 deferred the domain choice to Phase 01's entry gate and required that the choice, when
made, get **its own accepted ADR numbered from this band** — because the deferral is two-way and the
choice is not. The owner named the address on 2026-08-13; this ADR is that record, written at the
gate as specified. It is written after the fact by three days, which is itself worth noting: the
address went live before the decision was documented, and the gap is exactly the window in which an
undocumented one-way door gets treated as reversible by whoever reads the repo next.

The state at the time of writing, verified rather than assumed:

- `arc.automemory.ai` resolves, serves over HTTPS, and renders `/blog/receipts-driven-os` (HTTP 200).
- Nameservers are Cloudflare (`meera`/`noel.ns.cloudflare.com`).
- A Search Console **Domain** property for `automemory.ai` was added and its verification TXT record
  (`google-site-verification=X4WZ3w67…`) resolves from Google's own public resolver, 2026-08-16.
- The site serves `noindex, nofollow` plus `robots.txt: Disallow: /` by deliberate design
  (ADR-1115), so **no ranking authority of any kind exists at either address yet**. That fact is
  what makes this the cheapest possible moment to take the door.

`automemory.ai` is the company. arc is one part of it. That is the whole substance of the choice,
and the rest of this ADR is the cost accounting.

## Options considered

1. **`automemory.ai` root.** Rejected. The root belongs to the company, and pointing it at arc's
   blog would make the company site *be* arc's site — a product decision smuggled in through a DNS
   record. It also spends the single most valuable address the company owns on the first product
   that happened to need one.
2. **`automemory.ai/arc` — a subdirectory of the company root.** **This is the option with the real
   argument for it, and it is rejected on architecture, not on preference.** Search engines
   consolidate authority across a single origin more readily than across subdomains, so a
   subdirectory is the stronger long-run SEO position. It is rejected because ADR-1104 puts the site
   in its **own repository** with its own deploy: serving it under the company origin would require
   either one deployment built from two repos, or a reverse-proxy rewrite at the edge binding the
   company root's availability to arc's build. That is a coupling between a company organ and one
   product's release cadence, and it is a worse failure mode than a diluted link graph on a site
   that currently has zero links.
3. **A separate registered domain** (`arc.dev`, `getarc.com`, or similar). Rejected. ADR-1115
   already rejected the purchase — the obstacle was never the ~₹900/year, it was the owner's
   attention — and a separate domain also starts its authority at zero with no parent to inherit
   from, which is strictly worse than option 4 on the same money.
4. **`arc.automemory.ai` — a subdomain.** Chosen.

## Decision

**The permanent host is `arc.automemory.ai`.**

- The company root `automemory.ai` and the generic `blog.` and `www.` subdomains stay free for
  decisions that have not been made yet.
- `content.published.site` is pinned to this host. Every pre-cutover receipt carrying a preview host
  is corrected **by `supersedes`, never by editing** (REQ-11, phase-01 criterion 5) — `site` is in
  the idem preimage, so the correction is a genuinely new fact and hashes to a different idem.
- The Search Console property is registered against the **root domain** `automemory.ai` in **Domain**
  form, not URL-prefix and not against the subdomain. This is load-bearing and is the one piece of
  this decision that buys back optionality: a Domain property covers the root and *every* subdomain
  over both protocols, so a later `blog.` or `www.` decision needs no second property and — the part
  that actually matters — **no second clock**. ADR-1105's no-backfill rule means a second clock
  would start at zero on the day it was created.

## Consequences

**Good.** The company root stays uncommitted. arc-site keeps its own repo, its own deploy and its
own release cadence, with no edge coupling to a company organ. One Search Console Domain property
covers every address arc might ever use, so the four-week clock is started once and never restarted.
Taken at the only moment it is free: zero authority exists at either address today, so option 2's
advantage is currently worth nothing measurable and the choice costs nothing to have made now.

**Bad, and stated plainly.** Option 2 was the stronger SEO position and we did not take it. A
subdomain pools link equity with the company root less readily than a subdirectory would, and that
gap **widens with every link either address earns**. Today the gap is zero because both are at zero.
In two years it is whatever arc's link graph is worth, and by then this door is shut — moving the
site to `automemory.ai/arc` at that point would cost a full redirect map, a new property, and the
Performance history that does not survive the move. The right way to read this ADR later is: *we
traded a compounding SEO advantage for repo independence, knowingly, on the day the trade was
cheapest.*

**Also bad.** Documenting a one-way door three days after walking through it is the wrong order,
and it nearly went unwritten — the phase that requires this ADR was PARKED, so nothing was checking
for it. That is a gap in the park mechanism rather than in this decision: a parked phase suspends
its *work*, and it silently suspended its *record-keeping obligation* along with it. Worth a line in
the retro.
