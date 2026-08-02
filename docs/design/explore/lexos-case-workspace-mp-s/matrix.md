# Assignment matrix — explore `lexos-case-workspace-mp-s`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact.
>
> Brief: `docs/design/briefs/lexos-case-workspace/brief.md` (amended 2026-07-30 by ADR-0049) ·
> explore base `e46bbda` · isolation: route-namespace fallback (ADR-0037), all three variants
> side by side in this dir.
>
> Two tables are the contract, not one: §4 the **7-dimension IA** table and §5 the **4-axis
> art-direction** table. Both carry the EXPECTED entry per variant. The two verdict lines are
> appended in Phase 2, after the pages exist — they are deliberately absent from this file
> today, and this sentence is not one of them.

## §0 — This assignment is used by TWO runs. Read this first.

This is the director assignment for **model-policy Cycle 5, REQ-03 (ADR-0064)**: a paired A/B
in which the *only* difference between the two arms is the model tier of the three composers.

- The assignment is made **exactly once** — here.
- `docs/design/explore/lexos-case-workspace-mp-s/variant-{a,b,c}/thesis.txt` are the assignment
  of record. The owner copies those three files **byte-for-byte** into
  `docs/design/explore/lexos-case-workspace-mp-o/variant-{a,b,c}/thesis.txt` before either
  composer trio starts. The director writes nothing in the `-mp-o` dir, so that the copy is
  provably identical.
- **Everything a composer needs is in `thesis.txt`, including the content fixture.**
  `ui-composer` iron law 1 forbids reading this file. Retro 2026-07-30 records the exact failure
  that follows from ignoring that: the canonical fixture lived only in `matrix.md`, three
  composers invented three different cases, and the panel ended up comparing fixtures instead of
  directions. In a paired experiment that failure is not a wobble, it is a void result — six
  composers inventing six cases means the arms are not comparable and the phase produces nothing.
- Therefore §6 (shared floor), §7 (canonical fixture) and each variant's structure + art
  direction are reproduced **inside** the three `thesis.txt` files. §6 and §7 are reproduced
  **verbatim-identical in all three** — they are the experiment's control. Only the thesis and
  the art direction differ between a, b and c.
- `docs/design/explore/lexos-case-workspace-v2` is **context only, never an arm** (phase-02
  spec). Its assignment is not inherited here; this one was made from the brief.

## §1 — The structural question this explore exists to answer

The brief's answer A.5 names the disclosure split and then refuses to arrange it:

> Always visible: the case's identity (parties, case number where one exists), its status, its
> next hearing, its overdue count. On demand: the full hearing history, the document list, the
> task list, the notes. **This brief deliberately does not declare HOW that split is arranged.**

The shipped build arranges it as a five-tab section rail plus a 16rem actions panel of four
identical buttons. Three variants, three different arrangements. The two escalated debts (§3)
are the sharpest available axes and each variant owes a *different* answer to both.

The bar is the brief's own *At its best* line: the page a lawyer opens first every morning and
trusts on sight — an instrument built by people who understood the work, not a table with a
border on it. A page that merely lists the case correctly has not reached it, and **timidity is
a failure, not a safe choice** (`BELOW-BAR`, ADR-0049).

## §2 — Assigned theses, and the ones rejected before composing

| variant | structure thesis | one-line thesis |
|---|---|---|
| **A** | **command center** — dense, keyboard-first | This product wins because the user can hold the whole case — every dated fact and every open obligation — in one viewport and act on any of it from the keyboard, without opening a section, aiming at a button, or leaving the case to find the next one that needs him. |
| **B** | **narrative** — content-led, paced | This product wins because the user can read the case's whole life as one dated record, with what is still owed standing above today's line and what happened below it, without ever choosing a category for the thing he is looking for or for the thing he is about to write down. |
| **C** | **guided workflow** — steps, progressive disclosure | This product wins because the user can finish this case for the day in a single decision and see on sight that it is finished, without holding in his head what else the case owes or deciding which of four buttons applies. |

The three answer the job sentence — *"opens a case and knows, without hunting, what has happened
on it and what is due next"* — from the three cardinal ends a workspace can take:

- **A · everything at once, under a cursor.** Hunting is impossible because nothing is hidden:
  the answer to "what happened / what is due" is on screen before the first keystroke, and the
  keyboard is the whole interaction surface.
- **B · one continuous thing, read down.** Hunting is removed by abolishing the categories you
  would hunt *within*. One dated record; type is a label in the margin, never a container. The
  future is the head of the same record, not a different place.
- **C · one thing at a time, ending.** Hunting is removed by answering the second half of the job
  sentence for him: the case states the one thing it is waiting on, and states when it is done.

### Rejected — rejected BEFORE composing

A thesis reassignment after build burns the phase appetite (pre-mortem risk 4), and in a paired
run it burns it twice. The absurd lines die here.

- **canvas (spatial object manipulation) — structurally absurd for this brief.** Position on a
  canvas has to encode a date, so dragging a hearing changes when it is — and that is
  `reschedule`, a verb the brief records as appearing in **zero** LexOS files. The thesis cannot
  be built without smuggling in the exact invented verb the content contract exists to prevent.
  It also defeats the platform contract twice: keyboard-first and mobile-required both die under
  free spatial manipulation. ADR-0049 freed the *look*; section D was not amended.

- **ambient assistant (AI present, not dominant) — rejected on voice and on vocabulary.** The
  brief's voice line is literally *"a court record, not an assistant"*, `chatty` survived the
  amendment as an anti-word, and the product ships no AI noun at all — the closed set is case ·
  hearing · document · task · note · client · firm. An assistant layer needs a noun from outside
  that set (suggestion, draft, summary), which is the content contract's named VIOLATION. Strip
  the invented noun and what is left is the overdue count read aloud, which converges on C.

- **review workspace (compare, annotate, approve) — not absurd; dropped on a three-slot budget.**
  Review workspace and command center both spend the freed width on co-presence, and buying both
  in a three-slot budget buys one shape twice. Command center takes the slot because the brief
  names its payoff as a *hole in the shipped product*: answer A.7 says what does not exist yet is
  "a way to go from 'this case is done for today' to the next case that needs him", and A.7 also
  makes keyboard movement the declared expert path. A review workspace would also have to invent
  `approve` or fake it with a computed sentence; command center needs no verb the product does
  not already ship. If a Phase-2 reassignment round is ever called, review workspace is the first
  candidate back in.

## §3 — The two escalated debts, answered three ways

Both are IA decisions the shipped review escalated to the owner and refused to fix as polish. A
variant that answers either one the same way as another variant has spent its divergence budget
badly.

| debt | A · command center | B · narrative | C · guided workflow |
|---|---|---|---|
| **1. Content column frozen at 416px from 1024px to infinity** | **Abolish the measure.** There is no 48rem shell: the console fills the viewport to a wide cap and spends every pixel on **co-presence** — four ledgers of the case plus a caseload column, all live at once. Width buys more of the case on screen, never longer lines. | **Replace the measure with a reading measure.** Still one column, but sized for reading (~62–68 characters, comfortably wider than 416px) with a left marginalia gutter for dates and type. Width buys line length and margin, nothing else. If B ever opens a second content region it has stopped being B. | **Spend width on scale, not on columns.** One decision region, no measure on the step statement (it is display type), body text capped at two lines. Width buys size and air around the one live thing. |
| **2. Actions panel with no hierarchy, all four actions on every tab** | **No panel; the cursor is the hierarchy.** Verbs are keys, with a permanent key-hint bar; inline verbs appear on the **cursor row only**, so exactly one row is actionable at a time out of a page full of rows. No global primary anywhere. | **No panel; one compose point.** A single affordance sitting on today's rule, where the next dated fact will land. The entry's type is chosen *inside* that one act, never before it. No per-section verbs. | **No panel; one button, ever.** Exactly one primary button on screen at any time — the current step's single verb. The other verbs are not secondary buttons; they live inside steps that are not open, and blocked steps state their reason. |

**Ruling on inherited tokens.** ADR-0049 removed the inheritance: all three set their own
measures and their own values. What is assigned is that the three give debt 1 **three different
answers** — abolish / re-measure / re-scale. Record the departure and its reason as a **comment
in `tokens.css`**, never as prose on the page: v1 put width notes on the page and they had to be
stripped before blind packaging, because `max-w-shell` means nothing to a respondent.

## §4 — The 7 IA dimensions, EXPECTED entry per variant

| # | dimension | A · command center | B · narrative | C · guided workflow |
|---|---|---|---|---|
| 1 | **primary object** | The **addressable row**. Every hearing, document, task and note is a peer row in one of four co-present ledgers; the caseload is a fifth column of case rows. The case is read as a full board of rows, and the cursor is always on exactly one of them. | The **dated entry** in one continuous record. Its type (hearing · document · task · note) is a label carried in the margin, never a container it lives inside. What is owed is an entry that has not happened yet, sitting above today's rule. | The **step** — the case's current position in an ordered run. The case's sections are the steps' contents, not destinations; the run has a first step, a current step and a declared end. |
| 2 | **primary action** | **Fire a verb on the row under the cursor, from the keyboard.** `record` / `file` / `add` / `edit` / `remove` are bound to keys and shown in a permanent hint bar; the matching inline verbs render on the cursor row only. Many possible acts, one addressable at a time, none global. | **Write the next dated fact at today's rule.** One compose affordance, on the Today line, where the new entry will land. Recording what happened and adding what is due next are the same act, because in a record they are one dated fact and its consequence. | **Fire the current step's single verb.** `Record hearing outcome` now; `Add hearing` only after that; `File document` only inside its own step. One primary button on screen, always, and it changes as the run advances. |
| 3 | **info before action** | **Everything.** The quartet as a dense top status line, plus every ledger's live count, plus each queued case's own overdue count and next hearing — all before the first keystroke. A's claim is that nothing needs opening, so nothing is. | The quartet as a **standing cover sheet** above the record's first entry (a case file's cover sheet precedes its pages), with the next hearing stated **twice**: once in the cover sheet, once above today's rule as the entry that has not happened. | The quartet as a fixed header line, **plus the current step's precondition and nothing else** — "Hearing held 14 Jul 2026 · outcome not recorded". Enough to act; the history is not needed to take the step and is not shown. |
| 4 | **navigation model** | **Cursor and key; no destinations.** Move within a ledger, across the four ledgers, and to the next case in the caseload column — all by key. No tabs, no steps, no drill-in, and no view ever replaces another. The caseload column is **content** (case rows with counts), never a rail of buttons. | **Chronology is the address.** Sticky dated period heads are the only navigation control; they collapse and expand in place. Today's rule is the origin of the page. No section list, no type tab, no step. | **An ordered run with a declared end state.** A horizontal step rail (never a vertical panel); steps are addressable and revisitable but ordered; completed steps collapse to a one-line dated done state; the run terminates in a real screen, not a label. |
| 5 | **progressive-disclosure rule** | **By depth inside a ledger, never by type.** Every type is present on screen at all times; only depth is truncated, and truncation is numbered and expands in place ("+3 earlier documents"). Nothing is ever behind a control that names a category. | **Temporal, by period.** Everything above today's rule and the current period are open in full; older periods collapse to one dated summary line ("Mar–Jun 2026 · 1 hearing · 2 documents · 1 note") that expands in place. The future is exactly the dated obligations that exist — nothing speculative. | **Per step.** Only the current step is open. Each step shows only its own slice — the documents step shows the document that step is about, not the document list — and the whole record is **one** collapsed disclosure at the foot of the run (one, not two). |
| 6 | **expert path** | Keys over **rows and cases**: every verb has a key, the hint bar is permanent, one key moves to the next case with a non-zero overdue count. Expertise is never touching the mouse and never leaving the console — the brief's named hole (A.7) answered directly. | Keys over **dates and entries**: jump to today's rule, jump to the pending set, a "since you last opened" marker so only new entries are read, and a type lens that narrows *within* the stream without leaving it. Expertise is reading less of a record you already know. | Keys over **steps**: one key fires the current step's single verb, one walks the run, and at the end state the same key opens the next case whose run is not finished. Expertise is never having to choose which action to take. |
| 7 | **failure/recovery path** | The write fails **in the row**: the row holds its position and gains a state cell with what failed and what to do next; the ledger counts do not move, because the counts are the truth about the record. No toast, no dialog. Return puts the cursor on the first overdue row. | The failed entry stays **in the stream at its date**, flagged not recorded, with what failed and the next step stated in the entry; the record cannot read as current while an entry is unrecorded. Return opens at today's rule, not at the top of the file. | The run **stalls at the step**: the step stays open with what failed and the next step, and later steps stay explicitly disabled with a stated reason ("Cannot add the next hearing until the 14 Jul 2026 outcome is recorded"). Return opens at the stalled or current step, never at a section. |

## §5 — The 4 art-direction axes, EXPECTED entry per variant

This table has the same contractual weight as §4. `lexos-case-workspace-v1` differed on 7 of 7 IA
dimensions and the owner scored the set 23/100 because nobody wrote this table and three
composers independently chose grey. Hues are named so that cannot recur. Approximate hexes are
**direction, not specification** — hit the hue and the temperature, tune the value.

| axis | A · the dark instrument | B · the printed case diary | C · one decision on a quiet sheet |
|---|---|---|---|
| **palette** | **A graphite field, and never white.** Ground deep graphite (~`#191c20`), one step up for rails (~`#22262b`), type in warm bone (~`#e9e5dd`) with a dimmer bone for meta. **Exactly one meaning hue: signal amber** (~`#e8a33d`), spent only on what is overdue or not yet recorded — nothing that is fine is ever coloured. One reserved hue, **rust** (~`#e0705c`), used nowhere but destructive verbs. **Refuses:** white or paper grounds, a second bright hue, colour on anything healthy, glow, neon, gradients as decoration. | **Warm paper, sepia ink.** Ground parchment (~`#f4efe6`), ink a warm sepia-black (~`#241f1a`), rules hairline sepia (~`#cbbba4`). **One structural hue: ink blue** (~`#1f3a6e`), spent on dates and on today's rule — **here colour marks time, never status**; overdue is carried by a word and by weight, not by a colour. One reserved hue, **oxblood** (~`#7b2230`), appearing exactly once on the page, on the destructive verb. **Refuses:** pure white, pure black, status fills, coloured chips, any hue used to mean a state. | **A quiet sheet with one solid block.** Ground near-white porcelain (~`#fbfbfa`) with near-black text. **One meaning hue as a large solid field: deep court green** (~`#0f3d2e`) — the live step is a green block with bone type inside it, and the block *moves* as the run advances. **Burnt clay** (~`#9a3b1e`) is reserved for what is overdue. **Refuses:** dark page grounds, tinted panels everywhere, a third hue, colour used at hairline sizes — this palette works in whole blocks or not at all. |
| **typography** | **A console voice: caps labels against a true monospace.** Column heads and labels in a squarish grotesk, small, wide-tracked, all-caps; **every date, amount, count and case number in a genuine monospace** so columns lock. **4 tight steps plus one violent exception** — the overdue count is set enormous and nothing else on the page comes near it. First family must be genuinely available offline (e.g. `Consolas`/`Lucida Console` for data; `Tahoma`/`Franklin Gothic Medium`/`Arial` for labels). **Refuses:** serifs, mixed-case labels, anything above 15px in body rows, decorative weight changes. | **One old-style serif, worked hard.** Real italics carrying entry type, small caps for labels, body at genuine reading size with generous leading, old-style figures in prose against **lining tabular figures** in the date margin, and dated period heads big enough to pace the page (2.5–3rem). **7 live steps.** First family must be a genuinely available old-style/transitional serif (`Constantia`/`Cambria`/`Palatino Linotype`/`Georgia`). **Refuses:** sans-serif anywhere in content, all-caps headlines, condensed faces, bold as the main emphasis (italics and small caps do that work). | **A neo-grotesk sans at display scale.** The step statement is set at 48px+ and is the loudest thing on any screen in this explore; labels are small, wide-tracked caps; dates are oversized tabular numerals. **4 steps and nothing in the middle** — the rhythm is the gap between the huge and the small. **Refuses:** serifs, more than two lines of body copy anywhere, italics, and type used to fill space. |
| **density & rhythm** | **Maximum density, read across.** ~28–32px rows on a strict grid, columns locked by the monospace, the whole case in one viewport at 1280. Air exists only in the gutters between ledgers. The eye is paced by the cursor, which is the only moving thing on the page. | **Unhurried, read down, slowly.** One reading column with a marginalia gutter. Tight inside an entry, **very generous between periods** — the air between periods is the instrument and is the largest interval on the page. Dated period heads set the pace; nothing else does. | **One decision per viewport.** Space measured in whole line-heights around the live block; everything not live compressed to a single line. The page is mostly empty on purpose, and the emptiness is what makes "finished" legible. |
| **surface & ornament** | **Flat, ruled, and lit only by inversion.** Zero shadow, hairline rules in a lighter graphite, radius ≤2px. Two real ornaments: **the cursor row inverts** (bone ground, graphite type) so the eye finds it instantly, and a **permanent key-hint bar** at the foot rendering the closed verb set against its keys. A 2px state tick in the left gutter of a row, always beside a word. **Refuses:** cards, shadows, rounded surfaces, illustration, icon sets. | **A printed page.** No cards, no shadow, no rounded corners, no fills. A sepia hairline rule system, a running head behaving like a printed folio, **left-margin marginalia** carrying date and entry type instead of chips, and one typographic ornament between periods. **Refuses:** boxes, pills, chips and iconography of every kind — this record is type and rules only. | **Solid blocks, strictly flat.** The live step is a full-bleed-ish green block; done steps are one flat line each; blocked steps are flat with their reason in text. **Elevation is refused outright** — state is carried by block vs line, and by colour plus word, never by depth. One heavy step numeral, one rule running the length of the run. **Refuses:** shadows, elevation, hairline table grids, icon sets, centred layout. |

### Art-direction rulings the composers are bound by

- **Where colour lives, not which colour.** Every colour value — including SVG `fill`, shadow
  colours and gradient stops — is a custom property in `variant-*/tokens.css`. This constrains
  *where* values are written and, after ADR-0049, never *which*.
- **Declare your own contrast pairs.** The brief's pair table is today's LexOS, not tomorrow's
  floor. Comment your own fg/bg pairs in `tokens.css` and hold **≥4.5:1 on every text pair you
  rely on**. The three to actually measure rather than assume: A's amber and rust on graphite,
  B's ink blue on parchment, C's bone on the green block and clay on porcelain.
- **Typography must survive the render with no network.** The renderer no longer substitutes
  Arial (`PIN_FONT=0`, recipe `font-true;aa-on`), so the typeface is finally visible to the
  critic and to the blind ranking — and a webfont that fails to fetch returns this run to the
  exact v1 failure. Declare a stack whose **first genuinely-available family carries the assigned
  character**, and order fallbacks so the character survives one step down.
- **Colour is never the only carrier of status** (brief kill-list). A's amber, B's ink blue and
  C's green and clay all carry a word or a mark as well.
- **Read the kill-list as banning the unmotivated version, not the technique** (ADR-0049). What
  stays banned outright: emoji as iconography, centre-everything empty states in dashed boxes,
  raw enum text (`ON_HOLD`), invented labels where court vocabulary exists, and decoration that
  carries no meaning.
- **Motion character is yours;** reduced motion is honoured in all three, and none of the three
  theses needs motion to be legible.

## §6 — Shared floor: identical in all three, NOT a divergence surface

Reproduced verbatim inside all three `thesis.txt` files (§0). A variant that "innovates" here has
diverged on the wrong axis.

- The **always-visible quartet** — parties, case number where one exists, status, next hearing,
  overdue count — is on screen at all times in all three. Never behind a click, a period, a step,
  a keystroke or a scroll.
- **A field that exists and is empty still shows.** "Next hearing — Not set" is information in a
  legal record. Never hidden, never collapsed, never a bare dash.
- **Loading exists.** The shipped build has none. All five states — empty · loading · error ·
  success · disabled — are real states rendered where they occur, and the state gallery stays
  **off** the product page (brief's own instruction; last cycle it ate 40–60% of every variant).
- **Closed vocabulary.** Nouns: case · hearing · document · task · note · client · firm · case
  number · court · case type · filing. Verbs: `add` · `edit` · `remove` · `save` · `record` ·
  `file`. `set`, `schedule`, `reschedule`, `close`, `reopen`, `approve`, `complete` are not verbs
  in this product — "set the next hearing" renders as **`Add hearing`**. "Hearing outcome" is
  sanctioned (brief A.3). A document's own **title** is content and may be real court vocabulary;
  an interface **label** may use only the closed set — this is exactly the line the brief's
  `cause title` / `adjournment` note draws.
- **Statuses are exactly `INTAKE` · `ACTIVE` · `ON_HOLD` · `CLOSED`**, rendered as human text
  ("On hold", never `ON_HOLD`), never carried by colour alone. No fifth status, and no
  status-shaped word invented for a step, a period, a row state or a queue.
- **Voice: a court record, not an assistant.** State the fact and its date. Anti-words: urgent ·
  flimsy · chatty. Feel: exact · unhurried · durable.
- **Destructive language names the thing** and states it cannot be undone; a destructive verb is
  never styled like the benign verb beside it. Errors say what failed and what to do next.
- **Density rules:** one row per hearing, per document, per task · dates and amounts in tabular
  numerals so they align down a column · a row's meta separated by ` · ` consistently.
- **Dates as `27 Jul 2026`. ₹ in Indian digit grouping (₹18,45,000).** Lorem ipsum is a VIOLATION
  anywhere, including inside a collapsed period, a truncated ledger or a disabled step.
- **a11y floor:** ≥4.5:1 on your own declared text pairs · targets ≥44px · visible focus ·
  reduced motion honoured.
- **Desktop and mobile are both required; tablet is not** (declared `no`). A layout that only
  works at 1280px is not a thesis.

## §7 — Canonical fixture: the same case in all three

Reproduced **verbatim-identical** inside all three `thesis.txt` files, and — as the control of a
paired experiment — inside the copies used by the second arm. Composers may add rows of the same
case where their thesis needs more depth; they may not change a fact, a name, a date or an
amount. The full block, with its five-state copy, is in the thesis files; its substance:

- **Today** for every relative reading: `30 Jul 2026`.
- **The case:** `Meera Raghunathan v. Sunvale Housing Pvt. Ltd.` · `O.S. No. 412 of 2024` ·
  `City Civil Court, Bengaluru` · case type `Civil suit` · client `Meera Raghunathan` · firm
  `Iyer & Ananth, Advocates` · claim `₹18,45,000` · status `ACTIVE` → "Active" · overdue `2` ·
  **next hearing Not set** (the field shows, empty — this is why the case needs advancing).
- **Hearings:** `19 May 2026` held, outcome recorded ("Defendant's written statement taken on
  record."); `14 Jul 2026` held, **outcome not recorded** — the live gap.
- **Documents:** `Vakalatnama` filed `11 Mar 2024`; `Written statement of the defendant` filed
  `08 Jul 2026`; `Affidavit of the plaintiff` due `24 Jul 2026`, not filed, **overdue**.
- **Tasks:** rent receipts, due `21 Jul 2026`, **overdue**; reply to the interim application, due
  `06 Aug 2026`.
- **Notes:** `21 May 2026` and `16 Jul 2026`, one line each.
- **Money:** claim `₹18,45,000`; fee received `₹42,500` on `02 Jul 2026`.
- **Other cases** (only where a variant's caseload or next-case path needs them): `Vishnu Menon
  v. Ashirvad Developers` (`O.S. No. 118 of 2025`, Active, hearing `04 Aug 2026`, 0 overdue) ·
  `Sundaram Finance Ltd. v. R. Palaniappan` (`E.P. No. 63 of 2026`, On hold) · `Latha Bhaskaran`
  (Intake, **case-number field empty**, shown rather than hidden).

**Derived for A:** the console shows all four ledgers of this case at once plus the three other
cases as rows with their own counts; the two live gaps (14 Jul outcome, next hearing Not set) and
the two overdue items are the four rows a lawyer must be able to reach without hunting.
**Derived for B:** above today's rule sit the dated obligations that have not happened (the two
overdue items and "Next hearing — Not set"); below it the record runs `16 Jul` → `14 Jul` →
`08 Jul` → `02 Jul` → older, with `Mar–Jun 2026` collapsed to one line.
**Derived for C:** the run is 3 ordered steps named only with closed verbs
(`Record hearing outcome` → `Add hearing` → `File document`). **No step may be invented for an
obligation the closed verb set cannot name** — there is no verb for completing a task and none is
to be introduced. The end state is a real screen with the fixture's verbatim end sentence.

## §8 — Convergence risks, and the tell for each

Recorded here, for the Phase-2 call — **not** repeated into `thesis.txt`, because `ui-composer`
is contractually blind to what the other two are building and naming their assignments would
break that blindness.

- **A vs C — a full board vs a single decision.** Both enumerate what the case owes. The tell:
  A shows *all* of it simultaneously with no prescribed order and one addressable row at a time
  under a cursor; C shows *one*, ordered, with the rest stated-blocked and no button on them.
  Countable: A's page has zero global buttons and a permanent key-hint bar; C's page has exactly
  one button, full stop. If A numbers its ledgers into an ordered run, A has become C. If C opens
  every step with its own button, C has become A without a keyboard.
- **A vs B — a board vs a stream.** A's ledgers are dated content and could drift into being a
  chronology. Ruling: **A's rows are ordered within their own ledger and by obligation first**,
  not merged into one date order, and A has no compose point at the head of anything. If A's four
  ledgers merge into a single dated column with an add affordance on top, A has become B.
- **B vs C — a record with no end vs a run that finishes.** B has no end state, no step numbers,
  no next button; its future is exactly the dated obligations that exist. C is numbered steps
  with a declared terminus. If B's periods become numbered stages with a next button, B has
  become C. If C's foot disclosure opens by default into a dated list of everything that
  happened, C has become B with a step rail — hence **one** collapsed foot disclosure, not two.
- **All three vs the shipped build.** Any variant that keeps a vertical 16rem region of buttons,
  or a five-item section tab rail, has answered neither debt and has re-skinned the baseline.
  A's caseload column is content — case rows carrying counts — and is not a button rail; A has no
  global action anywhere.
- **And the risk this run exists to kill — three structures in one visual language.** The three
  grounds are graphite, parchment and porcelain-with-a-green-block; the three type voices are
  caps-plus-monospace, old-style serif, and display neo-grotesk; the three surfaces are
  flat-ruled-with-an-inverted-row, printed-page, and solid-flat-blocks. A human at three metres
  must be able to say which is which without reading a word.

## §9 — Mobile is required and is not a divergence dimension

Each variant owes a stated reflow. Tablet is `no` by declaration, but 768px is where the shipped
content column is widest and a variant may use that; it does not owe it.

- **A** — ledgers stack in a fixed priority order (what the case owes first), the caseload column
  becomes a one-line strip of case rows with counts at the top, and the cursor model degrades to
  select-a-row-then-its-inline-verbs. Density stays; a phone-sized A that becomes airy has lost
  the thesis.
- **B** — natively one column; period heads stay sticky, marginalia moves above its entry, and
  the compose point stays on today's rule.
- **C** — one step per screen, which is the run's natural shape; the horizontal rail compresses to
  "Step 1 of 3" plus the step's own name; the green block goes full-bleed minus a margin.

---

# Phase 2 — the divergence calls

Appended after all three variants exist, by re-reading `variant-{a,b,c}/index.html` and the
**rendered** pages against §4 and §5. Two independent verdict lines are recorded here and a run
must pass both: the structural one over the 7 dimensions of §4, and the art-direction one over
the 4 axes of §5, judged by looking at the rendered pages rather than by reading token files.
Neither line has been written yet — Phase 1 is the contract, and nothing in it will be edited to
match what gets built.
