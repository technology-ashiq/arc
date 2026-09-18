# Render confinement on a real browser — ADR-1418

**Date:** 2026-09-17 · **Built at:** `ee8d4707` · **Renderer:** `design-render.sh --mode explore`
· **Browser:** agent-browser 0.31.1 driving Chrome, on the owner's Windows box.

CI's `agent-browser` is a fake that replays a page's requests, so it cannot show what a browser
does with a page. This is that half of the proof. Every page here was synthetic, built for the
probe in a scratch explore `zz-confine-probe` that was removed afterwards. **No LexOS content was
rendered or recorded.**

## Setup

- `variant-a/` held one clean page, eleven leak pages and `tokens.css`.
- `variant-b/index.html` carried a red `SIBLING-SECRET` heading, and `variant-b/secret.svg` a red
  `SIBLING` box.
- `matrix.md` carried `MATRIX-SECRET`.
- Every page carried the same 280-character paragraph, so the blank-page guard (under 200
  characters) could not be the refusal on a page that stayed put.

Each page was rendered with
`bash .claude/scripts/design/design-render.sh docs/design/explore/zz-confine-probe/variant-a/<page>.html --mode explore --session zz-confine-probe--variant-a`.

## Results

| Page | Exit | What the renderer said, or what the PNG showed |
|---|---|---|
| `clean.html` (own `tokens.css`) | 0 | rendered, recipe `…;settle-paint;confined-loopback`, sha `2b03252c42f8756a5241584c07ebb8d9297fc2f7620e5166deb0f25a3562d8c4` |
| `leak-iframe-rel.html` — `../variant-b/index.html` | 1 | `REFUSED -- the page left its variant directory` · `missing GET /variant-b/index.html` |
| `leak-img.html` — `../variant-b/secret.svg` | 1 | refused · `missing GET /variant-b/secret.svg` |
| `leak-css.html` — `url(../variant-b/secret.svg)` | 1 | refused · `missing GET /variant-b/secret.svg` |
| `leak-fetch.html` — `fetch("../matrix.md")` | 1 | refused · `missing GET /matrix.md` |
| `leak-remote.html` — `https://example.com/probe.png` | 1 | refused · `violation POST img-src https://example.com/probe.png` |
| `leak-metacsp.html` — `<meta>` policy `default-src * file:` plus a remote image | 1 | refused · `violation POST img-src https://example.com/probe2.png`: the header policy held |
| `leak-nav-http.html` — `location.href = "http://127.0.0.1:9/elsewhere"` | 1 | refused by the blank-page guard (172 characters): the page had left before the capture |
| `leak-meta.html` — `<meta http-equiv="refresh">` to `http://127.0.0.1:9/` | 1 | refused by the blank-page guard (163 characters) |
| `leak-iframe-abs.html` — `file:///…/variant-b/index.html` | 0 | **PNG opened by hand: the frame is an empty box.** No sibling pixel. sha `0a14cada0fd02ad0404bdf656e4d2272628da6b24bcc73dec9e68d260ff21b5d` |
| `leak-nav.html` — `location.href = "file:///…/variant-b/index.html"` | 0 | **PNG opened by hand: own page, never left.** sha `4c9614c5b5dc5af09b0788dbd7a04249b8c85405c6b3d008e7482e191e289016` |
| `leak-popup.html` — `window.open("clean.html")` | 0 | **PNG opened by hand: own page captured, the popup was blocked.** sha `d9b09df67d3cb2fc1e504ecdbc88a32c179c27621c3a18345656435c05402e52` |

A first `leak-popup.html` was refused by the stale-duplicate guard, not by confinement: its pixels
were byte-identical to `leak-nav.html`'s, because the two pages differed only in script. It was
rebuilt with its own heading and re-rendered; the row above is the rebuilt page.

## The silent third

`file://` targets are blocked by Chromium before any policy check. A direct probe served the two
`file://` pages over the same server and read agent-browser's `console`, `errors` and
`network requests` afterwards. All three held nothing about the blocked load: the network log
listed the document and `/favicon.ico` only, and the server's record stayed empty. So these
attempts are **prevented, not detected**. ADR-1418 was amended the same day to say so, rather than
keep a "refused loudly" claim the browser does not support.

## What this does not prove

- **bash 3.2 and BSD userland.** That is CI's macOS leg.
- **A composer driving the render itself.** Phase 01's resume step 4 re-verifies one live composer
  turn.
- **An adversary.** The two-surface attack pass on the confinement is still owed, and its prompt
  carries this file.
