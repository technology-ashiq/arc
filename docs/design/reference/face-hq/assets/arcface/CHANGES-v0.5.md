# v0.5.4 — the queue, cleared (2026-08-24)

- **Council calibration, real** — verdicts you convene now persist and sit in
  a verdict ledger; score each HIT or MISS (`council.outcome`, the call and
  the outcome deliberately separate kinds) and "your calibration — the real
  ledger" computes verdicts-scored, hit-rate and Brier from receipts alone.
  Sim verdicts stay labeled SIM · UNSCORED. E2E-tested.
- **LIVE bench scorecards** — with an engine-room key, any bench row can run
  5 real fixture calls (instruction-following, extraction, JSON schema,
  arithmetic, classification) against ITS model id via `modelOverride`;
  assertion/schema/latency are measured, receipts say LIVE · measured, and a
  cross-provider id fails loudly as a driver-fault. Mock stays, labeled.
- **Autonomy + council persistence** — `autonomy.changed` and your convened
  `council.verdict` now write through the workspace hook; the ladder replays
  its overrides on load.
- **Workspace export / import** — engine room: download the log as JSONL;
  import merges by event id (append-only survives a restore); reset warns to
  export first.
- **Room polish** — Factory/Learn filter inputs and Portfolio venture cards
  moved onto the v2 surface system.
- **Mobile pass** — HQ content clears the mobile room switcher
  (pt-118px), the hero scrim deepened and the face steps back to 0.7
  presence on phones. Verified at 390×844: hero, platform, today, money.

# v0.5.3 — money, motion, and the REAL spine (2026-08-24)

- **Money room v2** — the chart now obeys the meaning contract: simulated
  revenue is violet AND 45°-hatched, cost is plain ink, and green (real
  money's colour) stays unspent until `revenue.received` fires. A "record
  real revenue" form is the human-only write path (E2) — the FIRST entry
  opens the green gate across the HQ and resets the kill clock. Kill panel:
  days_without_revenue meter (OK/WARNING/CROSSED vs the 90-day ceiling) and
  the traffic-floor row rendered honestly ABSENT with its reason. Crosshair
  tooltip reads all three substances; legend uses texture + markers so
  identity is never colour-alone (palette CVD-validated).
- **Choreography** — every room switch replays a weighted entry; council
  seats now TYPE their arguments onto the floor, grade chips pop in after
  the point lands, and the verdict card stamps down (heavy in, recoil,
  settle). All of it collapses under prefers-reduced-motion. Council chrome
  moved off violet (non-real only) to accent-dim, per the contract.
- **THE REAL SPINE RENDERS** — the dev API now defaults to this machine's
  arc checkout (`.claude/state/hq/events`, override via ARC_SPINE_DIR; reads
  only, never writes). Engine room → "connect REAL spine" streams arc's
  actual receipts — 14 day-files, 225 events — through the spine room, with
  a per-kind summarizer turning envelopes into honest sentences
  ("approved — escalate commit-msg-draft to a stronger tier" ·
  "lane engine · phase 08 closed · tests 19/19").
- Overview + Money real-₹ KPIs are green-gated: white "never-fired" until
  the kind actually fires.

# v0.5.2 — dashboard design system v2 (2026-08-24)

The HQ interior, rebuilt as one system (every room inherits it via kit/bits):

- **Icon rail** — @phosphor-icons/react (light weight, fill when active), ring
  groups, left accent bar + glow on the active room. Day player is one
  segmented pill.
- **Room hero headers** — each room opens with its sentence as display type
  over a soft accent wash, subline in Jakarta, gradient hairline under.
- **Double-bezel panels** — hairline shell (rgba white 2%) holding a solid
  core (#0b1113, inset highlight). Panel titles: accent tick + Jakarta 600,
  mono hints right.
- **Pills everywhere** — Btn is now a pill with weighted ease, hover lift,
  primary glow; PickRow segments and inputs (12px radius, inset shadow) match.
- **Today command center** — brief lines carry per-tone gradient bars; the six
  KPIs merged into one hairline-divided instrument strip (simulated ₹ renders
  violet per the meaning contract).
- **EventRow / ApprovalCard v2** — glowing kind dots, receipt chips that wake
  on hover; approval cards carry an amber needs-you rail, fact keys columned,
  pill actions. Receipt drawer marks YOURS events in cyan.
- Verified by CDP screenshots: today, bench, council, leads, absorb.

# v0.5.1 — the redesign (2026-08-24, same day)

Owner verdict on the first pass: slop. The rework:

- **Landing is now a full Cloudflare-grammar product page**: fixed glass nav,
  hero (message left, the face seated right where they render the globe),
  receipted stats band, 8-module platform bento (hq cell renders the LIVE
  brief; council cell carries the 12 seats), the golden loop as a node
  timeline, a LIVE spine ticker section (the actual app streaming behind the
  page), an inbox-card section, the three constitutional laws, ventures
  (LexOS + consumers), final CTA, sitemap footer. All product information is
  back on the landing.
- **The face lives on the front page ONLY.** Entering HQ it flies past the
  camera (warp) and unmounts; HQ is a clean room on solid #050708 surfaces.
  `stage.shiftX = 6` parks it in the hero's right seat; presence drops as you
  scroll into the story; the VoiceDock slides away with it.
- **Type system**: Anybody (display) + Plus Jakarta Sans (body) + JetBrains
  Mono (data). Pill CTAs with nested arrow circles on the landing; rounded-lg
  controls in the app. One motion voice: cubic-bezier(0.32,0.72,0,1).
- `/#hq` deep-links straight into the command room.
- Verified with headless-Chrome CDP screenshots (hero, platform, loop, spine,
  ventures, footer, HQ today + bench) — see `.shots/`.

# v0.5 — "the REAL working HQ" (2026-08-24)

v0.4 was an explanatory HQ over a simulated day. v0.5 makes it an
**application**: every add/hire/absorb/convene you perform appends a real
event, persists in `localStorage` (`arcface.ws.v1`), and every panel stays a
derived view over the log. Reload the page — your company is still there.

## The workspace layer

- `src/spine/workspace.js` — the persistent user-event layer + every registry
  (bench, hires, runs, absorb, agents, leads, growth, design, gates) as pure
  folds over the log. `wsRequestApproval()` raises cards into the same inbox;
  decisions on YOUR approvals persist (`spine.persistHook`).
- Honesty labels: sim events say `SIMULATED` (now violet + hatched, per the
  meaning contract), your events say `YOURS · persisted` (cyan).
- Meaning-contract fixes in `kinds.js`/`kit.jsx`: violet = non-real only
  (revenue.simulated, trade.paper now violet), council = accent-dim,
  red = incident family added.

## New rooms (rail now grouped into arc's five rings)

| ring | room | working module |
|---|---|---|
| kernel | **bench** | paste a model → challenger · scorecard (MUTED / NO PROPOSAL gates) · promotion via inbox |
| kernel | **absorb** | paste a skill/repo/tool → candidate · study→report→classify→rebuild→judge · adopt via inbox · ≤12/lane cap |
| factory | **executor** | hire employees & contractors (4 tenure fields) · 12-fixture cert suite · expiry refuses at use · dispatch runs |
| factory | **agents** | 24-agent repo census + add/enable/disable with tiers |
| money | **leads** | funnel (researched→…→won/lost) · 20/day cap · 2-touch window · suppression ledger · jurisdiction guard |
| money | **growth** | draft → live slop-lint → review pack (inbox) → human merge → published |
| money | **legal** | 7 gates with receipted mode changes · publish gate queue · E2 seals · hash chain |
| factory | **design studio** | brief → 3 thesis variants → critique with BELOW-BAR → blind jury (reference item) → your pick via inbox |

## ⌘K — the paste door

`src/hq/CommandPalette.jsx`, mounted app-wide. Paste anything, see a preview,
Enter routes it: model → bench · `hire X as Y` → executor · repo/skill →
absorb · `…?` → council (convenes on arrival) · `lead: X` → funnel · room
name → jump · anything else → note.logged.

## Landing (Cloudflare grammar)

Slim top nav, message left, the particle face parked in the right seat
(`stage.shiftX`, smoothed in `FaceStage`; HQ recenters it), five-ring strip
at the bottom.

## Verified

- `npm run build` green (76 modules).
- `scratchpad/smoke.mjs` (session-local): 25/25 — full flows including
  champion promotion, contractor lifecycle + expiry refusal, absorb adoption,
  lead caps/suppression, publish gates, and the reload-replay of all of it.
- Reset: engine room → "reset workspace" wipes only YOUR log.

# v0.5.5 — the calm palette (2026-08-24)

Owner feedback: the colours strained the eye. Full re-tune, centrally:
- Accent: laser cyan #00ffd1 → calm teal #2dd4bf everywhere (chrome, focus,
  rails, links). Violet → #a99ae6, red → #f87171, growth yellow → #e3cd7a;
  green/amber unchanged. Meaning contract intact.
- Grounds lifted off pure black: page #0b0e11, panel cores #12181c,
  elevated #0e1215 — layered soft-dark, Linear/Vercel-class contrast.
- The face itself re-lit: teal family particles (#2dd4bf/#3ecfd4/#3f9fd6),
  deeper edges, ambient cloud opacity 0.88 → 0.72, scene ground #0b0e11.
- Glows halved (primary button 0.16 → 0.09 alpha). Favicon re-tinted.

# v0.5.6 - split identity (2026-08-24)

Owner call: the calm palette was for the DASHBOARD only. The front page and
the face are restored to the original neon identity (#00ffd1 family, laser
cyan particles, cloud opacity 0.88, black scene ground) via a local NEON
constant in Landing.jsx; the HQ keeps the calm teal system (#2dd4bf on
#0b0e11/#12181c). Two surfaces, two moods, one product: the front door
glows, the workroom stays easy on the eyes.

# v0.5.7 - the readability pass (2026-08-25)

Owner could not read the dashboard comfortably. 586 mechanical fixes across
the HQ (kit, shell, bits, palette, all rooms - Landing and the face
untouched): every type size one step up (8.5-12.5px -> 10-13.5px), line
heights follow, smallcaps tracking reduced, low-contrast grays lifted
(white/35-62 -> white/50-72), thin 300-weight body -> regular 400.
