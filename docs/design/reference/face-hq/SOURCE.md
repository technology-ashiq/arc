# Source of the reference design — arc face HQ

**Form:** a running Vite + React app (source, not screenshots). The strongest form
this directory accepts — exact tokens, exact components, exact behaviour.

**Where:** `assets/arcface/` · run with `npm install && npm run dev`

**What it is:** `arc — Speak To The Company (v0.4, "the WORKING HQ")`. Two layers over one
persistent particle face: a landing at full presence, and an HQ of **eleven rooms** where
every panel is a derived view over an in-browser event spine. Built by the owner outside
this repo, brought in as the design the face is to be built from.

## What was in the drop, and what was done to it

The folder arrived with two generations copied together — Windows had suffixed the second
one `X (2).ext`. The `(2)` set is the NEWER one (2026-07-29/30, the eleven-room HQ); the
unsuffixed set was the older landing page (2026-07-19, six marketing sections). The newer
set was promoted to the canonical names and the older one archived under
`_v1-landing-2026-07-19/`. Verified by reading both: the old `App.jsx` renders
`S1…S6` sections, the new one renders `FaceStage + Landing + HQ + VoiceDock` over a booted
spine.

Not committed (the app's own `.gitignore` covers them): `node_modules/` (197 MB),
`dist/` (pre-built bundles), `_to_delete/` (two superseded rounds), `.env.local`. The
`.env.local` was read before anything was staged: it holds a filesystem path, no key.

## The rooms, as they actually render

`00 overview` · `01 the spine` · `02 factory` · `03 council` · `04 portfolio` ·
`05 autonomy` · `06 money` · `07 learn` · `08 the law` · `09 story` · `10 engine room`

Each was opened and looked at, not read about.

## What matters most about it — the part that must survive extraction

1. **The face is the shell, not a hero image.** It persists behind every room at reduced
   presence. It is the product's identity and the reason the surface does not read as a
   dashboard template.
2. **Every room leads with a sentence, not a title.** "If it isn't an event, it didn't
   happen." · "Twelve seats. No rubber stamps." · "Trust is earned. Never assumed." ·
   "The factory is not the product." · "Correct it twice, it becomes impossible."
3. **Honest states are already first-class.** `SIMULATED` badges, `real ₹0 — honest`,
   `BRAIN: OFFLINE`, `NOT INSTRUMENTED`, `SIMULATED FEED · REAL VOCABULARY`. The design
   already refuses to let a simulated number wear a real number's clothes.
4. **The inbox is the one write path**, with `j/k/a/r` keys and a mandatory typed reason —
   exactly the decision door Phase 03 built.
5. **The token set** (`src/ui/kit.jsx`): cyan `#00ffd1` · green `#4ade80` · amber
   `#fbbf5d` · red `#ff6b6b` · violet `#b9a2ff` on black, with ink/dim/faint text ramps.
   Type is Anybody (display) + JetBrains Mono (data). Focus rings, reduced-motion and
   thin scrollbars are already in `src/index.css`.

## What is placeholder — safe to replace with arc's real data

Everything the spine renders. The default data source is a **seeded simulator** streaming
a virtual arc day; the numbers on screen (₹9,976 simulated revenue, sim day 3, the
approval cards) are generated, and the app labels them so. `vite.config.js` already serves
`GET /api/spine` from `ARC_SPINE_DIR` in read-only mode, so the same components render the
real log the moment they are pointed at it — which is what Phase 04 will do, against L2's
door instead of a dev middleware.

The knowledge base in `src/data/arcKnowledge.js` is a snapshot of the repo's docs and will
be stale; the counts it quotes (22 commands, 23 agents) are already behind the frozen
contract in `initiatives/face/contracts/expected-set.json` (26 commands, 30 agents).

## Collisions with the face's meaning contract — for the owner to rule on

| # | the reference does | the contract says | why it matters |
|---|---|---|---|
| 1 | **cyan `#00ffd1` is the primary accent** — nav, buttons, headings, chart lines, focus rings | four reserved signals: amber = needs-you · green = real money · red = incident · hatched = non-real | cyan is NOT one of the four, so it does not collide. It reads as "the product's own colour". This is the resolution that costs nothing, and it is the reason the palette survives intact. |
| 2 | `revenue.simulated` renders in **green** on the Money and Overview screens | green is reserved for **real** money, and real revenue is ₹0 | this one is a real collision. A green ₹9,976 next to a green ₹0 makes the simulated number wear the real number's colour. The `SIMULATED` badge is doing all the work, and a badge is weaker than a colour. |
| 3 | `revenue.simulated` is a spine kind in the reference | the frozen 46-kind set is the authority | the drop's kind list is a snapshot and must be re-derived from `validate.mjs`, never copied |
| 4 | ₹0 renders as a plain `0` | never a bare 0 that could mean two things | the reference labels it `REAL REVENUE · HONEST` in words, which is most of the fix; the hollow-zero idea from the v2 round finishes it |

Row 2 is the only one that needs a decision. Rows 1, 3 and 4 have obvious resolutions and
are recorded here so they are not silently dropped.
