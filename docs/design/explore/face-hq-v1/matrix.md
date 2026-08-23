# IA-difference matrix — explore `face-hq-v1`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact. Brief:
> `docs/design/briefs/face-hq/brief.md` · base `5132cad` · isolation: route-namespace
> fallback (ADR-0037, phase-open decision 2026-07-29) — all three variants side by side in
> this dir.
>
> Two things are assigned here, and a run must pass on both independently: the **product
> structure** (the 7 dimensions) and the **art direction** (the 4 axes). Three layouts in one
> visual language is the same failed explore as three skins of one layout. The art-direction
> table below is not decoration around the real assignment; it *is* half the assignment.
>
> **Phase 2 is not yet run.** The two verdict lines are deliberately absent — see the final
> section, which explains what their absence does and does not mean.

## Assigned theses

| variant | thesis (product structure) | one-line thesis |
|---|---|---|
| A | **command center** — one dense keyboard-first surface; Today / Inbox / needs-you are regions of one object; navigation is selection movement | This product wins because the user can read what the company did overnight and stamp every open `approval.requested` from a single surface, without a route change, a drill-in, or the mouse. |
| B | **canvas (map-first)** — the transit **Map** is the home; the company is read spatially; rooms and inbox open from stations; the tape ruler anchors time | This product wins because the user can see where every line is in flight and which stamp stations hold an open gate in one glance at one picture, without opening a session or reading a list. |
| C | **review workspace (inbox-first)** — the decision queue is the spine; one approval at full evidence depth at a time; everything else orbits the stamp | This product wins because the user can decide one `approval.requested` on its whole evidence — profile detail body, receipt drawer, supersedes chain, seals — without assembling that evidence from receipts he has to go find. |

The three answer the job sentence (answer 1: *run a one-person AI company in 30–60 minutes a
day — see what needs him, decide it with a reason, read what the company did while he was
away*) from three different ends. **A** takes all three clauses at once on one surface. **B**
takes *read what the company did* and makes it a place rather than a list, so the decisions
are found by looking. **C** takes *decide it with a reason* to its full depth, one decision at
a time, and demotes everything else to context around the stamp.

## The 7 dimensions — EXPECTED entry per variant

| # | dimension | A · command center | B · canvas (map-first) | C · review workspace (inbox-first) |
|---|---|---|---|---|
| 1 | **primary object** | The **surface itself** — Today's brief, needs-you, the money strip, the receipts feed and the tape ruler are regions of one object; a receipt is a row inside it and an `approval.requested` is a row that has not been stamped yet. | The **station on a line** — the company drawn as lines, stations, stamp stations (square) and shared stations across the four rings; a receipt is a train arriving and lighting the station it belongs to. An open gate is a place on the picture. | The **`approval.requested`**, singular and opened — its profile detail body, its receipt drawer (canonical JSON, sha, supersedes chain), its ₹ amount, the seals that name what this decision can never do. Exactly one is on screen. |
| 2 | **primary action** | **Sweep and stamp.** Move the selection down needs-you and fire `a`/`r` with the typed reason inline in the row; the selection never leaves the grid and no region is displaced. | **Locate, then stamp where it lives.** Read the map for lit stations, dashed unexercised lines and open-gate squares; the stamp is performed *at* the stamp station, in a panel anchored to that station on the map. | **Adjudicate.** One decision, full depth, with the mandatory typed reason as the artifact of the act — the reason field is the largest input on the screen, not a modal afterthought. |
| 3 | **info before action** | The approval's profile detail body rendered as fixed columns inside the selected row, at row density — plus needs-you count, money strip, data mode, tape ruler and arc ring in permanent peripheral view, free, for every row. | **What is around it in space**: the station's line, its upstream and downstream stations, which stations lit in the last 24 h, which segments are dashed (unexercised) or dotted (planned), which ring it sits in, and the open-gate count per line. The detail body opens as a panel pinned to the station, never full-screen. | **Everything about one**: profile detail body in full prose, the receipt drawer expanded (canonical JSON · sha · supersedes chain), the ₹ amount with its honesty class stated, the seals for this decision verbatim with their ADR ids, and prior `decision.recorded` receipts on the same kind and lane for comparison. |
| 4 | **navigation model** | **None.** One screen, no routes, no drill-in. Navigation is selection movement inside a fixed layout; ⌘K is a cursor teleport that lands the selection on a row or region of the *same* surface, never a page change. | **Spatial zoom and pan, plus time.** Company (four rings) → line → station → room is a change of scale, not a change of page; the map's viewport position is the address. The tape ruler is the second axis: scrub it and the whole map re-renders as-of that day. ⌘K moves the viewport. | **Record-to-record.** The inbox rail is a spine of identifiers (ULID · kind · lane) and the workspace reloads per record; Map, Money, Board, Spine and Council room are peripheral surfaces that context the open record and never take the screen. |
| 5 | **progressive-disclosure rule** | **In place.** Everything answer 5 marks always-visible is on screen simultaneously; the receipt drawer and *Why?* expand *beneath the selected row*, inside their own region, displacing nothing else. Nothing ever covers anything. | **Scale-dependent.** Detail is a function of zoom, not of clicks: at company scale only lit / open-gate / incident are legible; at line scale, station names with live counts; at station scale, the room's zones; the receipt drawer only at the deepest zoom. Nothing is hidden — it is small until you come near. | **Inverted.** Evidence is always at maximum depth and the **queue** is what stays collapsed: the rail carries identifiers only, no verdict, no ₹, no summary. Depth belongs to exactly one record at a time. |
| 6 | **expert path** | The whole morning without the mouse: `j`/`k` · `a`/`r` with the reason typed in the row · `w` · `t` · `/`. The expert's day is a keystroke sequence over one static layout, so muscle memory holds because nothing moves. | `t` scrubs the tape and the picture answers *enna nadakuthu?* without any session being opened; `j`/`k` walk **along a line's stations** rather than down a list; ⌘K teleports the viewport to a station, kind or ULID. The expert reads the shape of the day before reading any text. | `a`/`r` fire from the rail without opening the record when the expert already knows, and reason presets are bound to keys so expertise is spent on judgment, not typing. The queue announces its own end (`0 open approval.requested`), so triage is a run with a definite finish rather than a browsable list. |
| 7 | **failure/recovery path** | Refusal renders **in the row**, code verbatim (`ALREADY_DECIDED` · `UNKNOWN_APPROVAL` · `BAD_REASON`), and the row holds its grid position. Success animates the stamp once (200 ms), prints the `decision.recorded` ULID on the row, and the row slides into the receipts feed region. Return opens on the cursor diff pinned to the top of the same surface. | Failure is **a place**: the station reddens, the segment shows the break, and an incident is somewhere on the picture rather than an item in a list. A refused stamp leaves that station's gate square open with the code verbatim beside it; quarantined emits appear at the station that emitted them. Return replays the gap since he left as trains arriving along the lines, from the last cursor to now. | **Two-level.** The rail item carries the refusal code while the workspace *retains the loaded evidence*, so the retry needs no re-reading — only a two-level product can fail that way. `ALREADY_DECIDED` collapses the record and re-points the rail at the next one. Return re-opens the top of the rail with the cursor diff stated as the rail's header. |

## The 4 art axes — EXPECTED direction per variant

Named directions: **A = "Ink & Signal", embodied and taken to its severe end** (the direction
to beat, made real by the variant it was written for) · **B = paper-first cartographic**, a
genuine departure — the paper mode is the default, not the print escape hatch · **C =
editorial-warm ink**, a genuine departure — a dossier you read, not a console you scan.

| axis | A · Ink & Signal, severe | B · paper-first cartographic | C · editorial-warm ink |
|---|---|---|---|
| **palette** | **Cold ink monochrome, one ground only.** `#101114` everywhere — no second surface tone, no tinted panels. Prose `#E8E6E1`, meta `#9CA3AF`, hairlines cold grey. Colour is *for* alarm and money and nothing else: an average screenful carries three amber marks and no other hue. **Refuses** brand colour, tinted surfaces, any fill larger than a chip. | **Warm paper ground, ink drawing.** `#F7F5F0` ground, `#1A1B1E` ink, needs-you amber `#92400E`. The four rings are distinguished by **ink weight, tint of the same ink hue, dash pattern and label — never by hue**, because hue is spent entirely on the reserved four. This is the inversion of the Vignelli reference: he coloured the lines, here the lines may not be coloured. Paper-safe green / red / violet must be declared with measured ratios (see shared floor). **Refuses** dark chrome, coloured lines, any second ground. | **Warm oxidised ink, two grounds.** Surround `#17140F`-class warm black; the open record sits on a distinctly lighter warm sheet (`#221D16`-class) — elevation by tone, never by shadow. Prose in bone/parchment, hairlines and the ruled margin in warm ochre-neutral (`#6B5B45`-class, non-reserved). Reserved hues appear at **text scale inside the prose**, marking each fact's honesty class, never as fills. **Refuses** cold grey, flat single-ground console chrome, colour as background. |
| **typography** | **Mono-primary.** A monospace (IBM Plex Mono / JetBrains class) is the *interface* face, not just the numeral face; humanist sans appears only in the few prose sentences. **Three real steps** (≈11 meta / 13 body / 16 region label) — a console has no headlines. Tight tracking, everything left-aligned to one grid. **Refuses** italics, weights above 600, any type over 16 px. | **Geometric grotesque, Unimark register.** Helvetica/Univers-class only; station and line labels set **ALL-CAPS at small size with wide tracking**; **five real steps** (≈34 / 22 / 15 / 12 / 10) because a map needs true size hierarchy: ring → line → station → station meta → legend. Mono tabular confined to ULIDs, ₹ and the receipt drawer. **Refuses** serif, lowercase labels, and mono anywhere in the map layer. | **Text serif, editorial measure.** A real text serif (Source Serif / Charter class) carries the profile detail body at ≈18–19 px on a 62–70 ch measure; **six real steps** including a genuine ≥30 px display size for the kind name. Mono tabular for ids, sha and ₹ only. **Refuses** all-caps, mono-for-prose, and the console register in its entirety. |
| **density & rhythm** | **Maximum.** 8-pt grid compressed to a 4-pt internal rhythm; ≈28 px rows; every always-visible region fits 1440×900 with no scroll on the primary regions. The eye is paced by **column alignment** — you scan straight down one column and the day is read. | **Airy and spatial.** No rows at all; whitespace is the map's substrate and the thing that makes lines legible. The 8-pt grid is the map's snap grid — stations land on it, segments run at 0°/45°/90° only. The eye is paced by **direction of travel** along a line. Exactly one dense element on the page: the legend. | **Paced, single-column reading rhythm.** 24–32 px vertical rhythm, large section spacing, one decision per screenful with intentional scroll. The eye is paced by the **document's sections** — what · ₹ · evidence · seals · reason. The rail is the single dense counterweight to a deliberately unhurried body. |
| **surface & ornament** | **Absolutely flat.** Zero radius. Hairlines are the only separators — regions are divided by a 1 px rule and a label, never by a box or a fill. No icon set at all. Ornament budget = the stamp, the seal, and the arc ring, which is the only curve on the screen. **Refuses** cards, tiles, panels, shadows, illustration. | **Linework is the whole visual system.** 2 px strokes; station glyphs carry meaning (circle = station · square = stamp station · double ring = shared station · dashed = unexercised · dotted = planned); hatched violet is a real diagonal hatch fill on non-real segments; the printed **legend is a first-class surface**; the tape ruler is drawn as a printed ruler with tick marks and is the only chrome. **Refuses** cards, boxes-around-things, shadows, raster texture, any drop-shadow "map depth". | **One layered document.** The evidence sheet is a lighter warm ground with a hairline edge and a **2 px ruled left margin** (dossier rule); 2 px radius, present but quiet. The stamp is the one true skeuomorph and it lands *on the sheet*; the seal is a hairline-embossed lock block carrying its article/ADR id. **Refuses** grids, tiles, KPI strips, icon sets, and any second illustrative idiom. |

Assignment intent, stated so it can be checked later: at a glance across three renders, **A
reads blue-black and grey with three amber marks; B reads cream and black line drawing; C
reads brown-black and bone with a lighter sheet floating on it**. If two of the three read the
same at thumbnail size, the art direction failed regardless of what the token files say.

## Shared floor — NOT divergence surface

These come from the brief and are identical across A, B and C. A variant that "innovates"
here has diverged on the wrong axis.

**Vocabulary — arc's own words, verbatim.** Kinds (`approval.requested`, `run.completed`,
`decision.recorded`, `day.closed`), gates, lanes, ADR ids, station names exactly as the
commands and scripts that perform them. Terms already in daily use: receipt · stamp · seal ·
chip · lane · phase · appetite · burn · tripwire · century · spine · brief · inbox · kill line
· proving week · dogfood. Verbs: approve · reject · emit (never in UI) · run (chip only) ·
close (chip only) · scrub · ask. Prettified vocabulary ("Approval Request" for
`approval.requested`) is a VIOLATION in all three. A thesis that needs a noun outside this
list is answering a different brief.

**The 8 signature screens — the explore set, obligatory for all three:** Today · Inbox · Map ·
Spine/Tape · Council room · Money · Board · Ask arc. All three must answer all eight. What
diverges is the *relationship* between them — regions of one surface (A), places on the map
reached by zoom (B), peripheral context orbiting the open record (C) — never which eight exist.

**Affordance classes and the one-write law.**
- **Stamp** — approve / reject on an `approval.requested` with a mandatory typed reason. This
  is the product's **only write**. Everything else on every screen is a view over receipts and
  sanctioned files.
- **Chip** — the verbatim command or script that performs a thing, shown so the operator knows
  what performs it. `run` and `close` exist as chips only. The UI never emits.
- **Seal** — a forever-human or ungrantable act, rendered as the **disabled/sealed state**: a
  lock plus the article or ADR id, never styled as a button. A button drawn onto a forever-human
  act is on the slop kill-list; the UI's honesty about what it cannot do IS the design.

**Honesty classes are never mixed.** Real vs SIMULATED / REHEARSAL / DRILL / EXPLORATORY is
always labelled (E3). A summed figure that mixes real with any non-real class is a VIOLATION.
The whole non-real family renders in one **hatched violet** treatment so the eye can never read
it as truth.

**Reserved colours — meaning is fixed, rendering is the variant's business.** Amber = *needs-you*
and nothing else · green = **real** money · red = incident · hatched violet family = every
non-real class. A variant may re-tone these for its ground (B must: paper needs darker greens,
reds and violets than the brief's ink pairs) but **any pairing not in the brief's declared
contrast table must be declared in that variant's `tokens.css` with its measured ratio**, and
the meaning may never move. Colour lives in `variant-*/tokens.css` only — no raw hex in any page.

**a11y floor:** contrast ≥ 4.5:1 on every declared pair · targets ≥ 44 px · visible focus ·
reduced motion honoured. Motion only on state change, 200 ms. Desktop yes, tablet yes, mobile
no.

**State matrix, per surface:** empty · loading · error · success · disabled. Empty is
honest-empty text in words (a kind that never fired says so: "0 receipts ever", "ABSENT (no
criteria receipt)", "not instrumented"). Error renders the refusal code **verbatim**
(`ALREADY_DECIDED`, `UNKNOWN_APPROVAL`, `BAD_REASON`). Disabled is the sealed state. A number
never spins — it greys the last known value and says how stale it is.

**Keyboard model — floored, not optional:** `j`/`k` move · `a`/`r` stamp (reason prompt) · `w`
why · `t` tape · `/` search · ⌘K jump (rooms, kinds, ULIDs, commands, concepts). A variant may
bind additional keys that its thesis requires; it may not rebind or drop these six. A morning
triage must be completable without touching the mouse in all three.

**Always visible in all three** (answer 5): needs-you count · money strip · data mode
(live/replay/sim) · the tape ruler · the arc ring. Needs-you never collapses. Every number
opens its receipts via *Why?*.

**Realistic real-company content is mandatory.** Real lane names, real kind names, full 26-char
ULIDs, ₹ in paise-derived integers, IST timestamps, real ADR ids, real dated clocks. Placeholder
filler text of any kind is a VIOLATION. Voice is terse, honest, dated; every state names its
evidence or its absence.

**Slop kill-list (all three):** no invented number, ETA or health emoji · no summed figure
mixing honesty classes · no chart that decorates instead of answers (the KPI tile's *Why?* is
the feature, not the sparkline) · no button on a forever-human act · no purple gradients,
glassmorphism, emoji status, mascots or particles · no prettified vocabulary. The stamp and the
seal are the **only** two permitted skeuomorphs.

## Convergence risks the composers must actively avoid

- **A vs C** — both carry an approval queue and both are dark. A's queue is *one region of a
  whole-company surface* and must never become the screen; C's queue is *a rail of identifiers*
  and must never grow into a readable grid. If A opens a full-width evidence pane, A has become
  C; if C's rail starts carrying ₹ and verdicts, C has become A. On art direction the same pair
  is the risk: A is cold, mono, flat and 28 px dense; C is warm, serif, layered and 30 px airy.
  Two dark variants that both default to Inter-on-near-black is this run's most likely failure.
- **B vs A** — both show the whole company at once. A shows it as *regions and rows*; B shows it
  as *one picture with no rows at all*. If B grows a sidebar list of stations with counts, B has
  become A with a decorative header.
- **B vs C** — both open a detail panel. B's panel is *pinned to a station and stays inside the
  map's space*; C's record *is* the screen. If B's station panel goes full-screen, B has become C
  with a map splash.
- **All three** — the always-visible strip (needs-you · money · data mode · tape · arc ring) is a
  floor surface the brief mandates, not a shared product region. It must not become a navigation
  target in any variant, and it must not be rendered the same way in all three: A's is a hairline
  text row, B's is a printed ruler, C's is a rail header. Compliance is not convergence, but
  identical *rendering* of the compliance is an art-direction failure.

## Rejected theses

Three of the six candidate structures were rejected **before** composing, because a thesis
reassignment after build burns the phase appetite (pre-mortem risk 4).

- **guided workflow (steps, progressive disclosure)** — rejected as structurally contradicted by
  answer 6: *walking away loses nothing because state is the log*, and coming back opens on the
  cursor diff. A stepped workflow must hold a session state this product refuses to own, and it
  imposes an order on a day that already has one — the spine's. Stripped of its invented session,
  it converges on the review workspace: same primary object, same primary action, same forward
  queue. It is the strongest reserve if a reassignment round is ever called.
- **narrative (content-led, paced)** — rejected because it breaks its own thesis on the first
  screen. Answer 4 requires needs-you **first and never collapsed**; a paced narrative that
  discloses beats in order structurally cannot put the undecided items first. It also duplicates
  an axis the product already owns: the Tape is the time model, read-only by construction, and a
  second competing pacing over the same day is one time axis too many.
- **ambient assistant (AI present, not dominant)** — rejected because **Ask arc** already exists
  as one of the eight signature screens, so the assistant has its room; promoting it to the
  product's structure would put a generated answer where the receipt belongs, in a product whose
  entire claim is that every number opens its receipts. And under the one-write law the assistant
  cannot act — only the stamp writes — so an ambient-assistant home surface is a chat box with
  read-only powers, which converges on the inbox again instead of diverging from it.

---

# Phase 2 — the divergence call (NOT YET WRITTEN)

Both verdict lines are **deliberately absent from this file at assignment time**. Their absence
is a statement about *when* this file was written, not a verdict of any kind, and it must not be
read as one:

- the structure verdict line (`Director call` + colon, N of 7) and
- the art-direction verdict line (`Art-direction call` + colon, N of 4)

are written here **only after all three variants exist and have been re-read and re-rendered**,
each judged independently, the art-direction one from the rendered screens rather than from the
token files. Until then `design-explore check` is expected to fail on `director-call-missing`,
and that failure is correct — it is the tool holding the phase to its own order of operations.

Nothing in the sections above is a claim that the variants diverged. It is a claim about what
they were **assigned** to be.

---

## Phase 2 — the divergence call

Written after all three variants were built and re-rendered. Judged from the three rendered
PNGs first, then cross-checked against each `tokens.css`. The two calls below are made
independently — a run must pass on both. **This section supersedes the placeholder above:** the
verdict lines are no longer absent.

### Structure — the 7 dimensions (evidence from the renders)

- **1 · Primary object — differs.** A renders as one continuous surface where every screen is a
  region and every open approval is an unstamped row; B renders the company as a literal transit
  diagram (concentric rings, radiating lines, square stamp-stations, a printed legend); C opens
  exactly one `approval.requested` as a full-depth serif dossier with the rest of the queue
  demoted to a hairline identifier rail. Three different primary objects are legible at thumbnail
  size.
- **2 · Primary action — differs.** A's stamp is inline in a dense grid row (sweep-many); C's is
  a single deliberate act with the mandatory reason as the largest field on the screen
  (adjudicate-one); B stamps from amber station cards read off the map. The sweep-vs-adjudicate
  split between the two dark variants is real and visible; B's "stamp where it lives" is the
  weakest of the three — performed in cards near the map rather than literally on it.
- **3 · Info before action — differs.** A packs the profile body into fixed row columns at
  ~28 px density; C expands the full receipt drawer (canonical JSON, sha, supersedes chain), the
  seals verbatim and the ₹ honesty class for the one open record; B surfaces spatial context —
  which stations lit, which segments run dashed. Distinct on screen.
- **4 · Navigation model — converged on the render (weak).** All three shipped the eight
  signature screens as one long vertical scroll behind a near-identical top nav bar, so the
  intended split — no-nav selection (A) vs spatial zoom/pan (B) vs record-to-record rail (C) — is
  only partly readable from the static page. Within-section the models do differ (A's grid, B's
  map viewport, C's reloading rail), but page-level navigation is the weakest of the seven.
- **5 · Progressive disclosure — differs.** C is unmistakably inverted: a hairline rail of
  identifiers with one record at maximum depth. A discloses in place, drawers opening beneath the
  selected row. B discloses by proximity/zoom on the map. Visible.
- **6 · Expert path — weak on the render.** The keyboard floor (`j/k a/r w t / ⌘K`) is shared,
  and its per-variant application — walking stations vs rows vs a rail — does not surface in a
  static screenshot. Specified in the tables, not shown by the pixels.
- **7 · Failure/recovery — differs.** All three render the state matrix with verbatim refusal
  codes, but the treatment differs: A's refusal holds a grid row, C's is a two-level
  rail-code-plus-retained-evidence table, B's is a reddened place on the picture.

### Art direction — the 4 axes (judged from the rendered screens, not the token files)

- **Palette — differs, three ways.** The thumbnail test passes cleanly: A reads cold blue-black
  (`#101114`, one ground) with grey ink and a few amber marks; B reads warm cream paper
  (`#F7F5F0`) with black linework and amber; C reads warm oxidised brown-black (`#17140F`
  surround / `#241F17` sheet) with bone/parchment serif on a lighter floating sheet. The two dark
  variants (A, C) are unmistakably different temperatures — cold vs oxidised warm — not one dark
  reused twice.
- **Typography — differs, three ways.** A is monospace as the interface face; B is a geometric
  grotesque with wide-tracked all-caps small labels; C is a genuine text serif carrying a large
  display "approval.requested". No two share a typeface character.
- **Density & rhythm — differs.** A is maximum-density packed rows; B is airy, with whitespace as
  the map's substrate; C is a paced single-column reading rhythm with large section spacing.
  Three different pacings of the eye.
- **Surface & ornament — differs.** A is absolutely flat — hairlines and the single arc-ring
  curve, no icon set; B's entire visual system is 2 px linework (station glyphs, hatched non-real
  segments, a first-class legend, a printed ruler); C is one layered dossier sheet with a 2 px
  ruled left margin and the stamp skeuomorph. Distinct idioms, no shared ornament.

### Verdict

Director call: A/B/C differ materially on 5 of 7 dimensions — three different primary objects (whole-company surface vs transit map vs one deep record), three disclosure rules and three failure treatments are visible on the renders; only navigation and expert-path partly converged because all three stacked the eight screens as one scroll behind a shared nav bar.

Art-direction call: A/B/C differ materially on 4 of 4 axes — palette (cold blue-black / warm cream / oxidised brown-black), typeface character (mono / grotesque / serif), density (packed / airy / paced) and ornament (flat hairline / linework map / layered dossier) each read differently at thumbnail size, so no two pages are indistinguishable.

Both calls stand. No reassignment ordered — the run passes both gates and proceeds to critique.
