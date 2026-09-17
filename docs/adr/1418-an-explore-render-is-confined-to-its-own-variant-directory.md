# ADR 1418 — An explore render is confined to its own variant directory

**Status:** accepted
**Date:** 2026-09-17
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a real explore page needs a resource from outside its own variant directory
(a shared asset, a CDN font), so confinement refuses legitimate work. Widen the served root to
named directories then; never relax the policy into a path-string match.

## Context

[ADR-1415](1415-the-composer-iron-law-gains-a-read-path-allowlist.md) and its two amendments scope
what `ui-composer` may Read, Write and run. The fifth adversarial pass found that none of that
governs what the composer's **page** does once it is inside the browser. Both attackers found it
independently (`evidence/phase-01/adversarial-open.md`, BL-1 = BS-1, CONFIRMED):

- the composer writes `<iframe src="../variant-b/index.html">` into its OWN `index.html`, which its
  write boundary allows because the file is in its own directory;
- its Bash boundary allows the render, because the route and the session are its own;
- `design-render.sh` opens the page as `file://`, and a `file://` page loads any file on disk as a
  subresource;
- the sibling's pixels land in the composer's own session PNG, the one render ADR-1415 lets it read.

`<img>`, CSS `url()`, an absolute `file:///` path and a JS navigation are the same hole. Pinning the
command cannot close it, because the page is the attack.

It reaches past the composer:

- `design-explore.sh render` renders every variant through the same path for the director's
  divergence call and for the jury, so a variant that frames its sibling corrupts the comparison;
- [ADR-1410](1410-dsv-k-outbound-blind-packages-carry-arc-authored-renders-only.md)'s "arc-authored
  renders only" is defeated by a page that embeds a gallery image.

## Options considered

1. **Serve the variant directory over loopback, with the policy in the response header.** The
   renderer starts a node `http` server on `127.0.0.1`, rooted at the one variant directory, and
   opens `http://127.0.0.1:<port>/<page>`. Every response carries a Content-Security-Policy that
   admits the origin and nothing else — pros: the boundary is the browser's origin model, not a
   string match; `../variant-b` is a 404 from a server that holds nothing else; a policy sent as a
   header cannot be loosened by the page / cons: the renderer owns a server process on three OSes,
   and explore mode now requires node.
2. **`agent-browser network route` aborts** — pros: no extra process / cons: unverified that it
   intercepts `file://` at all; the CLI offers `--abort` and `--body` only, with no
   allow-this-prefix; and on `file://` there is no origin, so the boundary becomes a path-string
   match across drive letters, case, 8.3 names and `file://localhost/`. That is the class of check
   this lane keeps shipping holes in.
3. **Copy the variant to a temp directory and render that** — closes relative paths only;
   `file:///C:/…/variant-b/index.html` still loads.
4. **Scan the page for URLs before rendering** — a script builds its URLs at runtime. Unwinnable.
5. **Detect after the capture, prevent nothing** — and it depends on a log whose coverage of
   `file://` loads is unknown.

## Decision

Option 1, in **explore mode only**, with detection as a second layer.

- **Route.** Explore mode refuses any route that is not a file inside
  `docs/design/explore/<id>/variant-<x>/`, and refuses `http://`, `https://` and `file://` routes.
  Its only callers, `design-explore.sh render` and the composer, already pass that shape.
- **Root.** The server's root is that variant directory. Each request path is decoded, normalised
  and resolved through symlinks, and anything outside the root is refused and recorded.
- **Policy.** Every response carries a CSP admitting `'self'`, `data:` and `blob:`, plus the page's
  own inline style and script, and nothing else — frames, images, fonts, fetch, workers, objects
  and `base-uri` included — with violation reports posted back to the server.
- **Refusal, never a degraded render.** The capture is refused, and its PNG and meta removed, when
  any of these hold:
  - the server recorded an out-of-root request or a policy violation;
  - the page's final top-level URL, read by agent-browser from outside the page, is not the served
    page;
  - more than one tab is open;
  - node is absent.
- **Lifecycle.** The server has a hard lifetime cap and inherits none of the caller's file
  descriptors, so a killed renderer cannot leave it holding a CI job or a bats run open.
- **Receipt.** The recipe gains `confined-loopback`, so every meta says which transport produced
  its pixels.

Critique mode is unchanged. The critic is not blind to siblings, and its routes include dev-server
URLs.

**What this transform destroys** (the lane's rule for transforms): every resource from outside the
variant directory, i.e. CDN fonts, remote images and shared assets. Measured on 2026-09-17: the
explore pages on disk (`lexos-p01`, `lexos-p02`: 22 html, 24 css) reference no remote or
out-of-directory resource, and `ui-composer.md` already requires "the page, self-contained". A page
that reaches out is refused loudly. It is never rendered with fallback fonts and judged as if that
were its design.

**Not yet verified, and verified before this ADR is accepted:**

- Chromium refuses a `file://` subresource requested by an `http://127.0.0.1` page;
- the header policy holds against the page's own `<meta>` policy;
- the renderer's injected determinism `<style>` still lands under the policy;
- the attackers' four leak shapes (iframe, img, CSS `url()`, navigation) are refused by the real
  browser.

CI's `agent-browser` is a fake and cannot show any of these, so the proof is a real re-render on the
live-demo path plus the next two-surface adversarial pass.

## Consequences

Easier: blindness becomes a property of the render, not only of the composer's tools. The same
confinement is ready for Phase 07's rival drafts and for ADR-1410's packager.

Harder: the renderer owns a process lifecycle on three OSes, the bats suite must not wait on a
server holding an inherited descriptor, and explore mode needs node. If the root proves too tight,
widen it to named directories. The policy stays origin-based.
