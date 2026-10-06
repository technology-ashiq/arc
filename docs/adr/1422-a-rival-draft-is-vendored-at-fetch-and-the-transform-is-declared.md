# ADR 1422 — A rival draft's remote assets are vendored at fetch time, and the transform declares what it destroys

**Status:** accepted
**Date:** 2026-10-06
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a provider whose draft is self-contained as delivered (the vendoring step then
does nothing and is removed for it), or a jury result in which a juror names the vendored rendering
as the reason a rival lost.

## Context

The Phase 06 spike ([receipt](../../initiatives/design/evidence/phase-06/spike-receipt.md)) proved
Stitch's contract and then failed self-containment: its HTML generates every style at runtime from
`cdn.tailwindcss.com` and loads its type from Google Fonts. Rendered with every `https://` request
aborted it is unstyled text (`22e4061f…` against `5b8fcd5f…` open). The Phase 06 exit criterion bars
such a provider from Phase 07 "on a special-case render path", because a render that reaches the
network is not deterministic: the CDN can change the page between two renders of the same file.

The owner chose (2026-10-06) to keep Stitch in the blind jury by vendoring its assets rather than
trying v0 (a performance-testing clause and paid credits, [ADR-1413](1413-a-rival-is-not-called-until-its-terms-clear.md))
or dropping REQ-09.

## Decision

The rival adapter, at fetch time and once, downloads every remote asset the draft references --
the Tailwind runtime script, the stylesheet links and the font files they name -- and writes a
self-contained copy of the draft in which each reference points at the local copy. That copy is
what the ordinary renderer renders, with the network blocked. There is no special-case render path:
the renderer never learns which items are rivals.

The vendoring is gated like any other fetch: https only, a fixed allow-list of asset hosts recorded
in the adapter (`cdn.tailwindcss.com`, `fonts.googleapis.com`, `fonts.gstatic.com`), a byte cap, and
every asset's sha256 recorded beside the draft. A reference to any other host is left unresolved and
NAMED in the adapter's report -- never silently dropped -- and the self-containment check then fails
for that draft, which leaves the jury.

**What the transform destroys, declared (the lesson of `design-render.sh` pinning Arial):**
1. **Time-of-render freshness.** The vendored Tailwind runtime is the version fetched once; a later
   CDN change does not reach the jury. Intended -- it is what makes two renders comparable.
2. **The provider's own font-loading behaviour.** `font-display` and network timing are replaced by
   local files; a font that would have flashed or failed live renders correctly here. This can only
   flatter the rival, never penalise it, so it is not a bias against the provider.
3. **Nothing about layout, colour or content.** The draft's markup and class names are byte-for-byte
   the provider's; only `src`/`href` targets change, and the diff is recorded.

The vendored copy and its assets are local state, never committed (non-negotiable: no rival draft in
git). The jury item is the render of the vendored copy, opened in-session before any ranking.

## Consequences

Easier: Stitch competes in Phase 07 on the same renderer as arc's variants, offline. Harder: the
adapter carries an asset fetcher, which is a new gate on the network boundary and so gets the
two-surface adversarial pass on the PR that ships it. Phase 07's verification plan carries the
offline render of the vendored copy as its first assertion.
