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

## Collisions with the face's meaning contract — found by reading the code

The first pass over this drop reported ONE collision, read off the screenshots. Reading
`src/ui/kit.jsx` afterwards found **three**, plus an accessibility defect the eye cannot
see at all. That gap is the whole argument for reading the source and not the render: two
of the three are invisible in a screenshot because they only appear on a screen carrying
both meanings at once.

All four are resolved in `docs/design/system/tokens.css`, with the reasoning in that
file's header. The owner's drop is NOT edited — the reference is the target, the contract
is the law, and the token file is where they are made to agree.

| # | the reference does | the contract says | resolution |
|---|---|---|---|
| 1 | `SimBadge` renders **amber** | amber = needs-you ONLY | the non-real family renders `--violet` on `--sim-hatch`. A simulated number is not a request for attention, and on a screen carrying both, the eye cannot separate them. |
| 2 | `KIND_FAMILY.council` renders **violet** | violet = the non-real family ONLY | council renders `--accent-dim`. A council verdict is as real as any receipt; violet says the opposite. |
| 3 | `StatusDot state="live"` and the Money room's simulated-revenue `Stat` both render **green** | green = real money ONLY, and real revenue is 0 | liveness is a DATA-MODE statement → `--mode-live` (accent). Simulated currency → `--sim-fg`. Green stays **unspent** until `revenue.received` fires for the first time. |
| 4 | `COLOR.faint` = `rgba(255,255,255,0.42)`, carrying real text (every `Stat` label) | ≥4.5:1 is the brief's own floor | computed **3.94:1 — fails**. Raised to `0.46`, the first alpha that clears it, at 4.56:1. Every ratio in the token file was computed, not assumed. |

**What did NOT collide, and why it matters:** cyan `#00ffd1` is not one of the four
reserved hues. That is the structural reason this palette survives the contract intact —
chrome, nav, focus, panel titles, links and the live accent all have a colour of their own
and never have to borrow a reserved one. A four-hue palette would have had to.

Two further items are corrections rather than collisions: the drop's spine-kind list is a
snapshot and must be re-derived from `validate.mjs` (never copied), and
`src/data/arcKnowledge.js` quotes 22 commands / 23 agents where the frozen contract counts
**26 / 30**.

## Decided 2026-08-24 — was open for the owner, and did not need to be

The brain's action protocol (`src/brain/persona.js`) lets the model emit
`{"type":"approve","id":...,"reason":"..."}` and `{"type":"reject",...}`, which the UI then
executes. It is told in the prompt not to auto-approve money or kill decisions.

**A prompt is not a tool contract.** REQ-07 requires `face-ask` to have ZERO write tools,
proven by a tool-list fixture, and E2 Human Sovereignty says the stamp belongs to the owner
alone. A prompt instruction not to do something is exactly the decorative gate ADR-0049
describes: a rule with nothing enforcing it.

**Decided: `approve` and `reject` are not in arc's action vocabulary.** `open_room`,
`set_speed` and `enter_hq` are read and navigation, and stay exactly as the reference has
them. Nothing about the design changes; three words leave a protocol.

Taken rather than asked, because the answer is forced by a requirement and not by taste. The
owner kept the FACE for himself and handed over every other arc decision, and this is not a
design call — it is what the model is permitted to DO, which REQ-07 and E2 already settle.
Asking would have been asking him to re-derive an answer his own laws already give.

And it is a CONTRACT now, not a paragraph. `face/src/lib/ask.mjs` carries `ASK_ACTIONS` and
`actionAudit`, the action-side twin of the `ROUTE_EFFECT` / `noHandsAudit` pair that already
holds the route side. Any action whose effect is `write` — and any action the vocabulary does
not classify at all — makes the audit dirty and is named, on the same reasoning `noHandsAudit`
uses for an unknown method: the safe reading of "I do not know what this does" is not
"probably nothing". An empty vocabulary is reported as dead rather than clean, because
`Object.freeze({})` once satisfied every assertion the route audit made.

That is the retro lesson from this cycle applied to its own last open question: when a rule
matters, stop writing it down and convert it into something that FAILS.
