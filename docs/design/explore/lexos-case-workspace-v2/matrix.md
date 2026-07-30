# Assignment matrix — explore `lexos-case-workspace-v2`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact.
>
> Brief: `docs/design/briefs/lexos-case-workspace/brief.md` (amended 2026-07-30 by ADR-0049) ·
> explore base `ab35046` · isolation: route-namespace fallback (ADR-0037), all three variants
> side by side in this dir.
>
> Two tables are the contract, not one: §3 the **7-dimension IA** table and §4 the **4-axis
> art-direction** table. Both carry the EXPECTED entry per variant. The two verdict lines are
> appended in Phase 2, after the pages exist — they are deliberately absent from this file
> today, and this sentence is not one of them.

## Why this run exists, stated plainly

`lexos-case-workspace-v1` differed on **7 of 7 IA dimensions** and the owner scored the set
**23/100**, saying they all looked like one design. He was right. Three composers were handed an
existing product's exact palette, told that departing from its stance would make the pilot "a
rewrite instead of an explore", given no art-direction axis to vary — and the renderer then
replaced every typeface with Arial before anyone judged. Structural divergence was real and
invisible.

ADR-0049 fixed all four causes. What that means for this assignment, concretely:

- **Nothing is inherited.** The LexOS token set is context, not a cage. The brief's declared
  contrast-pair table is *a fact about today's LexOS, never a floor on tomorrow's* — in the
  brief's own amended words. A composer who opens with `#111827` on `#ffffff` because that is
  what the table says has repeated v1 exactly.
- **Typography is now real.** `design-render.sh` no longer pins Arial by default; the critic and
  all three blind jurors will see the typeface you chose. Typography is the strongest single
  carrier of design character and for the first time it survives to judgment.
- **Timidity is now a failure, not a safe choice.** The critic can return `BELOW-BAR` for work
  that breaks no rule and is still not good enough, and `BELOW-BAR` **fails the run**. The brief
  says it directly: *"A page that avoids every risk, uses colour only as absence and sets
  everything at one size has made a hundred choices to be invisible. That is `BELOW-BAR`."*
- **The bar is the brief's own "At its best" line** — the page a lawyer opens first every
  morning and trusts on sight; an instrument built by people who understood the work, not a
  table with a border on it. A page that merely lists the case correctly has not reached it.

## §1 — The structural question this explore exists to answer

The brief's answer A.5 names the disclosure split and then refuses to arrange it:

> Always visible: the case's identity (parties, case number where one exists), its status, its
> next hearing, its overdue count. On demand: the full hearing history, the document list, the
> task list, the notes. **This brief deliberately does not declare HOW that split is arranged.**

The shipped build arranges it as a five-tab rail plus a 16rem actions panel. Three variants,
three different arrangements, and the two escalated debts are the sharpest available axes — each
variant owes a *different* answer to both (§2).

### Assigned theses

| variant | structure thesis | one-line thesis |
|---|---|---|
| **A** | **review workspace** — compare, annotate, approve | This product wins because the user can see every obligation this case carries set row-for-row against what is already on the record, and close any one of them where it stands, without opening a section, reading the history, or being told which one to do first. |
| **B** | **narrative** — content-led, paced | This product wins because the user can read the case's whole life as one dated record and write the next fact at its head, without ever choosing a category for the thing he is looking for or for the thing he is about to add. |
| **C** | **guided workflow** — steps, progressive disclosure | This product wins because the user can finish a case for the day in a single decision and know on sight that it is finished, without holding in his head what else the case might owe or when it will next need him. |

The three answer the job sentence — *"opens a case and knows, without hunting, what has happened
on it and what is due next"* — from three different ends, and they occupy the three cardinal
shapes a workspace can take:

- **A · many at once, in pairs.** Hunting is removed by putting the *difference* on screen: what
  the case owes, beside what it has. The lawyer judges; the page does not order him.
- **B · one continuous thing.** Hunting is removed by abolishing the categories you would hunt
  *within*. One dated record; type is a label, never a container.
- **C · one at a time, ending.** Hunting is removed by answering the second half of the sentence
  for him: the case states the one thing it is waiting on, and states when it is done.

### Rejected theses — rejected BEFORE composing

A thesis reassignment after build burns the phase appetite (pre-mortem risk 4), so the absurd
lines die here.

- **canvas (spatial object manipulation) — structurally absurd for this brief, unchanged by
  ADR-0049.** Position on a canvas would have to encode a date, which means dragging a hearing
  changes when it is — and that is `reschedule`, a verb the brief records as appearing in **zero**
  LexOS files. A canvas thesis cannot be built without smuggling in the exact invented verb the
  content contract exists to prevent. It also defeats the platform contract twice: keyboard-first
  and mobile-required both die under free spatial manipulation. ADR-0049 freed the *look*, not the
  content contract; section D was not amended.

- **ambient assistant (AI present, not dominant) — rejected on voice and on vocabulary.** The
  brief's voice line is literally *"a court record, not an assistant"*, `chatty` survived the
  amendment as an anti-word, and the product ships no AI noun at all — the closed set is case ·
  hearing · document · task · note · client · firm. An assistant layer needs a noun from outside
  it (suggestion, draft, summary), which the content contract's own VIOLATION rule bans. Strip the
  invented noun and what remains is the overdue count read aloud, which converges on **C** rather
  than diverging from it.

- **command center (dense, keyboard-first) — not absurd; built and proven in v1, and dropped here
  on a budget argument.** Three slots, three cardinal shapes. Command center and review workspace
  both spend the freed width on co-presence, and putting both in a three-slot budget would buy one
  shape twice. Review workspace takes the slot because its co-presence is *matched and weighted* —
  two regions in a stated relationship to each other — rather than four peer ledgers side by side,
  which is the sharper and the untried claim. If a Phase-2 reassignment round is ever called,
  command center is the first candidate back in, and its dark dense-instrument art direction is
  already unused.

**Why review workspace, which v1 rejected, is viable now.** v1 held it as "the strongest
reserve" and rejected it on two counts; both are answered at assignment time rather than left for
a composer to trip over.

1. *Its verbs map onto nothing shipped.* Resolved by mapping the mechanic, not the word.
   **compare** is structure, not a verb — it is the two-region layout itself and needs no label.
   **annotate** is `add` a `note`, both shipped, attached to the row it annotates. **approve**
   does not exist and is not introduced: the terminal act is `record` or `file`, and "the gap is
   closed" is a *computed count sentence* ("5 of 7 obligations are on record · 2 overdue"), never
   a badge, never a status word, and never a fifth case status. The four statuses stay exactly
   `INTAKE` · `ACTIVE` · `ON_HOLD` · `CLOSED`.
2. *Its natural shape is two vertical panes, which is the shipped build's shape.* Resolved by
   ruling, in §6: the shipped shape is a content column plus a 16rem rail of four identical
   buttons. A's two regions are of **comparable weight**, both carry content, **neither is a
   button rail**, and there is no global action anywhere on the page. A page with a narrow
   right-hand column of buttons has re-skinned the baseline and has not built this thesis.

**One fixture problem A must solve, named here so it is not discovered at 80% built.** The
canonical case's next hearing is **not set** (§7), so "required *before the next hearing*" has no
date to hang on. A's frame is therefore **obligations the case carries now**, not a countdown:
an outcome not recorded, a hearing not set, items past their due date. Where a next hearing does
exist — Vishnu Menon, 04 Aug 2026 — the same list is dated against it. "Next hearing — Not set"
is itself the top row of the gap, which is the strongest thing about this thesis: the brief's
"an empty field is information in a legal record" becomes the primary object rather than a
footnote.

## §2 — The two escalated debts, answered three ways

Both are IA decisions the shipped review escalated to the owner and refused to fix as polish. A
variant that answers either one the same way as another variant has spent its divergence budget
badly.

| debt | A · review workspace | B · narrative | C · guided workflow |
|---|---|---|---|
| **1. Content column frozen at 416px from 1024px to infinity** | **Split the width into two weighted regions.** The route takes real width up to a wide cap and spends it on *co-presence with alignment* — required and on-record on one line of sight. Below `lg` the pair stacks per row, never per region. | **Replace the measure with a reading measure.** Still one column, wider than 48rem, and every pixel of the gain goes to line length for the record. If it ever opens a second region, B has become A. | **Keep the measure; delete the panel.** 48rem minus a 16rem panel minus the gap is 416px; 48rem with nothing beside it is 768px. C fixes the debt with an 85% gain and no token change — the measure was never the bug, the panel eating it was. |
| **2. Actions panel has no hierarchy, offers all four actions on every tab** | **The verb lives on the discrepancy.** No panel and no global primary; each unmatched row carries its own one verb (`record` / `file` / `add`), fired where it stands. Many affordances, each scoped to exactly one obligation. | **One compose point.** No panel, no per-section verbs. The record has a single affordance at its head where the next dated fact will land; the entry's type is chosen *inside* that one act, never before it. | **One action, ever.** No panel. Exactly one primary button on screen at any time. The other verbs are not secondary buttons — they live inside steps that are not open, and blocked steps state why. |

**Ruling on `max-w-shell` and every other inherited token.** ADR-0049 removed the inheritance:
all three may set their own measures and their own values. What is assigned is that the three
give debt 1 **three different answers** — split / widen / keep-and-delete. Record the departure
and its reason as a **comment in `tokens.css`**, not as prose on the page: v1 put width notes on
two of three pages and they were stripped before blind-test packaging because `max-w-shell` is
meaningless to an external respondent. Do not repeat that.

## §3 — The 7 IA dimensions, EXPECTED entry per variant

| # | dimension | A · review workspace | B · narrative | C · guided workflow |
|---|---|---|---|---|
| 1 | **primary object** | The **discrepancy** — one obligation the case carries that is not yet on the record. The unit is a *matched pair*: a required item beside its record entry, or beside the void where the entry should be. The case is read as the set of these. | The **case record** — one continuous dated stream. The unit is a dated entry, and its type (hearing · document · task · note) is a label carried *on* the entry, never a container it lives inside. | The case's **current position in its cycle**. The unit is a step; the case's four sections are the steps' contents, not destinations. |
| 2 | **primary action** | **Close a discrepancy in place.** `record` the outcome / `file` the document / `add` the hearing, fired from the unmatched row itself on the required side and landing on the record side; `add note` annotates any row. Several affordances, each bound to exactly one obligation, none global. | **Add the next entry at the head of the record.** One compose affordance, at the top of the stream. Recording what happened and adding what is next are the *same* act, because in a record they are one dated fact and its consequence. | **Fire the current step's single verb.** `Record hearing outcome` now; `Add hearing` only after that; `File document` only inside its own step. One primary button on screen, always, and it changes as the run advances. |
| 3 | **info before action** | The mandated quartet **plus the readiness count sentence** — "5 of 7 obligations are on record · 2 overdue" — stated in numbers before anything is opened, and the gap itself visible without a click. | The quartet as a **standing preamble** above the record's first entry (a case file's cover sheet precedes its pages), with the next hearing stated **twice**: once in the preamble, once as the record's pending head entry, because in a record a future date is an entry that has not happened yet. | The quartet as a fixed status line, **plus the current step's precondition and nothing else** — "Hearing held 14 Jul 2026 · outcome not recorded". Enough to act; the history is not needed to take the step and is not shown. |
| 4 | **navigation model** | **Paired position across two aligned regions.** The address is a row-pair, not a section. The two regions are locked in alignment — moving in one moves the other — and there are no tabs, no steps and no drill-in. | **Chronology is the address.** Sticky dated period heads are the only navigation control; they collapse and expand. No section list, no type tab. | **An ordered run with a declared end state** ("Nothing due until 12 Aug 2026"). A horizontal step rail, not a vertical panel; steps are addressable and revisitable but ordered, and completed steps collapse to a one-line dated done state. |
| 5 | **progressive-disclosure rule** | **By match state.** Unmatched obligations are open in full with their detail; reconciled pairs collapse to one line showing both sides; everything on record that nothing requires sits in one dated "Also on record" region, collapsed. Hiding is by *reconciled or not* — never by type. | **Temporal, by period.** The current period and the pending entry are open in full; older periods collapse to one dated summary line ("Mar–Jun 2026 · 3 hearings · 4 documents") that expands in place. The future is exactly one entry. | **Per step.** Only the current step is open. Each step shows only its own slice — the documents step shows the document this step is about, not the document list — and the full history is **one** disclosure at the foot of the run (one, not two). |
| 6 | **expert path** | Keys move **across the pair and down the gap**: next unmatched obligation, cursor between the two sides of the same row, one key fires that row's own verb, one key goes to the next case whose gap is non-empty. Expertise is never reading a history to find out what is missing. | Keys move **over dates and entries**: jump to the pending entry, a "since you last opened" marker so only new entries are read, and an in-stream type lens that never leaves the record. Expertise is reading less of a record you already know. | Keys move **over steps**: one key fires the current step's single action, one walks the steps, and at the end state the same key advances to the next case whose run is incomplete. Expertise is never having to choose which action to take. |
| 7 | **failure/recovery path** | The failed close **stays on the required side, still unmatched**, holding its row position, with what failed and the next step stated in the row — and **the readiness count does not move**, because the count is the truth about the record. Return: opens on the first unmatched obligation. | The failed entry stays **in the stream at its date**, flagged unrecorded with what failed and the next step, and the record cannot read as current while an entry is unrecorded. Return: opens at the pending entry, not at the top. | The run **stalls at the step**: the step stays open with what failed and the next step, and later steps are explicitly disabled with a stated reason ("Cannot add the next hearing until the 14 Jul 2026 outcome is recorded"). Return: opens at the stalled or current step, never at a section. |

## §4 — The 4 art-direction axes, EXPECTED entry per variant

This table has the same contractual weight as §3. v1 failed on it, and it failed because nobody
wrote one. Hues are named so that three composers cannot independently choose grey. Approximate
hexes are **direction, not specification** — hit the hue and the temperature, tune the value.

| axis | A · the audit desk | B · the printed case diary | C · the lit desk |
|---|---|---|---|
| **palette** | **Cold, and never white.** Ground is a pale blue-grey paper (~`#eceff4` family); ink is a blue-black. Exactly **two** meaning-bearing hues and their tints: **deep petrol** (~`#0d3b3f`) = on record, **vermilion** (~`#b03a1f`) = not on record. Colour's whole job is to encode the diff, and every coloured item also carries a word. **Refuses:** white grounds, warm neutrals, a third accent, colour used for anything but match state. | **Warm, paper, ink.** Ground is oat/cream (~`#f7f1e6`); ink is a warm near-black (~`#1b1714`); rules are sepia (~`#c9b79a`). **One** structural hue: **oxblood** (~`#7b1f2b`), spent only on dates and on anything not yet recorded — colour is chronological signal, never category. **Refuses:** blue in any form, pure white, pure black, and status fills as coloured chips. | **A dark field with a lit sheet.** Field is deep ink-navy (~`#101a2e`); the sheet the reading happens on is bone (~`#f6f3ec`); one high-chroma **marigold** (~`#e0a020`) touches nothing but the live action and the overdue count. Every other tone is muted so the bright thing is unmistakable. **Refuses:** a white page, a second bright hue, and colour on anything that is not live. |
| **typography** | **Two voices on one page, on purpose.** Required side in a tight mechanical grotesk — squarish, technical, caps labels, tabular figures. Record side in a transitional legal serif at real text size. **6 live steps**; every numeral one step above its own label; the top step used only on the readiness count. **Refuses:** a single-typeface page, italics as decoration, and anything under 13px. | **One editorial old-style serif, worked hard.** Real italics carrying entry type, small caps for labels, body at genuine reading size with generous leading, old-style figures in prose against **lining tabular figures** in the date column, and a period head big enough to pace the page (2.5–3rem). **7 live steps. Refuses:** sans-serif anywhere in content, all-caps headlines, condensed faces. | **One humanist geometric sans at a violent scale jump.** Step statement above 40px; labels small, wide-tracked caps; dates oversized tabular. **5 steps and nothing in the middle** — the page's rhythm comes from the gap between them. **Refuses:** serifs, more than two lines of body copy anywhere, and type used to fill space. |
| **density & rhythm** | **Dense, columnar, read across.** Rows on a strict grid, aligned row-for-row between the two regions so the eye tracks horizontally. Row height tight. The only generous space on the page is the gutter the comparison happens across. | **Unhurried, read down, slowly.** One column at a reading measure. Tight inside an entry, very generous between periods — the air between periods is the instrument and it is the largest interval on the page. Dated period heads pace the reading. | **One decision per viewport.** Space measured in whole line-heights around the live step; everything not live compressed to a single line. The eye is paced by **scale**, not by rules or by grid. |
| **surface & ornament** | **Flat and ruled.** Zero shadow. Hairline column rules, one small radius, and one real ornament: a **dotted leader rule** tying each requirement across the gutter to its match, or to the void where the match should be. A single geometric present/absent mark, always beside a word. **Refuses:** cards, shadows, illustration, icon sets, rounded surfaces. | **A printed page.** No cards, no shadow, no rounded corners. A sepia hairline rule system, a running head behaving like a printed folio, **left-margin marginalia** carrying entry type and time instead of chips, and one typographic ornament between periods. **Refuses:** boxes, pills, chips, and iconography of every kind — the record is type and rules only. | **Layered, and the layer means something.** The live step is a bone sheet **raised on the navy field with a genuine soft shadow**; done and blocked steps lie flat *in* the field, unraised — elevation is the state, not decoration. A heavy numeral glyph per step and one thick rule running the length of the run. **Refuses:** hairline tables, grids, centred layout, decorative texture. |

### Art-direction rulings the composers are bound by

- **Where colour lives, not which colour.** Every colour value — including SVG `fill`, shadow
  colours and gradient stops — is a custom property in `variant-*/tokens.css`. A hex, `rgb()`,
  `hsl()` or a CSS named colour anywhere else is refused by `design-explore check`. This is a
  constraint on *where*, and after ADR-0049 it is no longer a constraint on *which*.
- **Declare your own contrast pairs.** The brief's pair table is today's LexOS, not tomorrow's
  floor. Comment your own fg/bg pairs in `tokens.css` and hold **≥4.5:1 on every text pair you
  rely on** — C's bone sheet and B's oat paper make this easy; A's vermilion on pale blue-grey is
  the one to actually check rather than assume.
- **Typography must survive the render with no network.** The renderer no longer substitutes
  Arial, which means your typeface is finally visible to the critic and to three blind jurors —
  and it also means a webfont that fails to load returns this run to the exact v1 failure.
  Declare a stack whose **first genuinely-available family carries the assigned character**, and
  order the fallbacks so the character survives one step down. Do not stake a direction on a
  fetch.
- **Colour is never the only carrier of status** (brief kill-list). A's petrol/vermilion diff, B's
  oxblood unrecorded flag and C's marigold live-action all carry a word or a mark as well.
- **Read the kill-list as banning the unmotivated version, not the technique** (ADR-0049). C's
  shadow is assigned *because* it reads as genuine elevation. A gradient that carries state is not
  a gradient hero. What stays banned outright: emoji as iconography, centre-everything empty
  states in dashed boxes, raw enum text (`ON_HOLD`), invented labels where court vocabulary
  exists, and decoration that carries no meaning.
- **Motion character is yours**; reduced motion is honoured in all three, and none of the three
  theses needs motion to be legible.

## §5 — Shared floor: identical in all three, NOT divergence surface

A variant that "innovates" here has diverged on the wrong axis.

**From the brief, non-negotiable:**

- The **always-visible quartet** — parties, case number where one exists, status, next hearing,
  overdue count — is on screen at all times in all three. Never behind a click, a period, a step
  or a match state. A guided run that hides the case's status is a VIOLATION, not a thesis.
- **A field that exists and is empty still shows.** "Next hearing — Not set" is information in a
  legal record. Do not hide it, collapse it, or substitute a dash for the label. ("Not set" is the
  brief's own phrase for the empty field, not the banned verb `set` used as a label.)
- **Loading exists.** The shipped build has none. Every variant declares all five states — empty ·
  loading · error · success · disabled — for the case header and for its own primary region.
  **And the brief's explicit instruction on how:** keep the state matrix **off the product page**.
  Render them as *real* states where they naturally occur, and if a reference block is needed put
  it at the foot, clearly marked as reference, visually subordinate. Last cycle it ate 40–60% of
  every variant's page. A variant that spends a third of its canvas on a state gallery has spent
  it on the wrong thing and will read as `BELOW-BAR` for that reason alone.
- **Closed vocabulary.** Nouns: case · hearing · document · task · note · client · firm · case
  number · court · case type · filing. Verbs: `add` · `edit` · `remove` · `save` · `record` ·
  `file`. **`set`, `schedule`, `reschedule`, `close`, `reopen` are not verbs in this product** —
  "set the next hearing" renders as **`Add hearing`**. The brief records that a first draft
  invented `close`/`reschedule`/`reopen` and `cause title`/`adjournment`; do not re-invent them.
  "Hearing outcome" is sanctioned — it is the brief's own words in A.3.
- **Statuses are exactly `INTAKE` · `ACTIVE` · `ON_HOLD` · `CLOSED`**, rendered as human text
  ("On hold", never `ON_HOLD`), never carried by colour alone. No fifth status, and no
  status-shaped word invented for a step, a period or a match state.
- **Voice: a court record, not an assistant.** State the fact and its date. No exclamation marks,
  no encouragement, no congratulation for filing something. Anti-words: **urgent · flimsy ·
  chatty**. (Note the amendment: "decorative" is no longer an anti-word. Ornament that carries
  meaning is not the enemy; looking untrustworthy is.)
- **Destructive language names the thing** and states that it cannot be undone; a destructive link
  is never styled identically to a benign one beside it. Errors say what failed and what to do
  next.
- **Density rules:** one row per hearing, per document, per task · dates and amounts in tabular
  numerals so they align down a column · a row's meta separated by ` · ` consistently.
- **Dates as `27 Jul 2026`. ₹ in Indian digit grouping (₹18,45,000).** Lorem ipsum is a VIOLATION
  anywhere, including inside a collapsed period, a reconciled pair or a disabled step.
- **a11y floor:** text contrast ≥4.5:1 on your own declared pairs · targets ≥44px · visible focus ·
  reduced motion honoured.

**Real court vocabulary as CONTENT vs as LABEL.** A document's own title is data a lawyer typed
(`Written statement`, `Affidavit`, `Vakalatnama`, `Interim application` are all fine as titles in
the fixture). An interface LABEL, status, step name, column heading or button may use only the
closed vocabulary above. This is exactly the line the brief's `cause title` / `adjournment` note
draws — real-sounding is not the bar for chrome.

## §6 — Convergence risks, and the tell for each

**A vs C — a gap you judge vs a run that tells you.** Both enumerate outstanding obligations, and
this is the sharpest risk in the set. The tell: A shows **all** obligations at once, in no
prescribed order, each with its own verb, and the lawyer chooses; C shows **one**, ordered, with
the rest stated-blocked and no button on them. If A numbers its gap into ordered steps with one
actionable row, A has become C. If C opens every step with its own button, C has become A's
required column with a progress bar. Countable version: A's page carries one affordance per
unmatched obligation; C's page carries exactly one button, full stop.

**A vs B — a matched comparison vs a stream.** A's record side is dated content and could drift
into being B. Ruling: **A's record side is ordered by requirement, not by date** — it exists to
sit opposite the required side row-for-row — and record entries that match no obligation are
collapsed into one region at the foot, not woven through. A has no compose point at the head of
anything. If A's record side becomes the primary reading surface in date order with an add
affordance at its top, A has become B.

**B vs C — a record with no end vs a run that finishes.** B has no end state, no step numbers and
no next button; its future is exactly one open-ended pending entry. C is numbered steps with a
declared terminus. If B's periods become numbered stages with a next button, B has become C. If
C's foot disclosure opens by default into a dated list of everything that happened, C has become B
with a step rail — hence the assignment of **one** collapsed foot disclosure, not two.

**All three vs the shipped build — the same-app-different-styling failure.** Any variant that
keeps a vertical 16rem region of buttons, or a five-item section rail, has answered neither debt
and has re-skinned the baseline. A's two regions are content vs content, of comparable weight;
**neither region is a button rail**, and A has no global action.

**And the risk this whole run exists to kill — three structures in one visual language.** Check
your own page against the other two art directions before you call it done: if your page would
still make sense with A's palette, or B's typeface, or C's surface treatment, you have designed a
layout and not a direction. The three grounds are pale blue-grey, oat, and ink-navy; the three
type voices are grotesk-plus-serif, editorial serif, and geometric sans; the three surfaces are
flat-ruled, printed-page, and raised-sheet-on-a-field. A human at three metres must be able to
tell which is which.

## §7 — Canonical fixture: the same case in all three

So that divergence is structural and art-directional, never an artefact of one composer inventing
better content. Composers may add rows; they may not change these facts. Document and task
*titles* may differ between variants (content, not label).

- **Open case:** `Meera Raghunathan v. Sunvale Housing Pvt. Ltd.` · case number
  `O.S. No. 412 of 2024` · `City Civil Court, Bengaluru` · case type `Civil suit` · client
  `Meera Raghunathan` · claim `₹18,45,000`
- **Status:** `ACTIVE` (rendered "Active")
- **Last hearing:** held `14 Jul 2026` — **outcome not recorded**
- **Next hearing:** **not set** (the field shows, empty — this is why the case needs advancing)
- **Overdue:** `2` — one task due `21 Jul 2026`, one document due `24 Jul 2026`
- **Recent record:** a document filed `08 Jul 2026`, a note added `16 Jul 2026`, an earlier
  hearing held `19 May 2026` with its outcome recorded, fee received `₹42,500` on `02 Jul 2026`
- **Other cases** (only where a variant's next-case path needs them):
  `Vishnu Menon v. Ashirvad Developers` · `O.S. No. 118 of 2025` · `ACTIVE` · next hearing
  `04 Aug 2026` · 0 overdue — and `Sundaram Finance Ltd. v. R. Palaniappan` · `E.P. No. 63 of
  2026` · `ON_HOLD` — and one `INTAKE` case, `Latha Bhaskaran`, with **no case number yet**, whose
  case-number field shows empty rather than hidden.

**Derived for A:** the obligations this case carries now are the unrecorded 14 Jul outcome, the
absent next hearing, the task due 21 Jul and the document due 24 Jul — four unmatched — against a
record holding the 19 May hearing with its outcome, the 08 Jul filing, the 16 Jul note and the
02 Jul fee. State the readiness count from those numbers; do not invent a different arithmetic.

**Derived for C:** the run is 3–4 ordered steps, each named with a verb from the closed set
(`Record hearing outcome` → `Add hearing` → `File document`). **No step may be invented for an
obligation the closed verb set cannot name** — there is no verb for completing a task and none is
to be introduced. The end state is stated ("Nothing due until …") and is a real screen, not a
label.

## §8 — Mobile is required and is not a divergence dimension

Each variant owes a stated reflow. A variant that only works at 1280px is not a thesis. Tablet is
`no` by declaration, but 768px is where the shipped content column is widest and a variant may use
that; it does not owe it.

- **A** — the pair stacks **per row, not per region**: each obligation becomes one block with
  required above and on-record (or the void) below, so the comparison survives. Two independently
  scrolling lists on a phone would destroy the thesis.
- **B** — natively one column; period heads stay sticky, marginalia moves above its entry, compose
  stays at the head.
- **C** — one step per screen, which is the run's natural shape; the horizontal rail compresses to
  "Step 1 of 3" plus the step's own name. The navy field and the raised sheet survive; the sheet
  goes full-bleed-minus-a-margin, and the field stays visible so elevation still reads.

---

# Phase 2 — the divergence calls

Appended after all three variants exist, by re-reading `variant-{a,b,c}/index.html` and the
**rendered** pages against §3 and §4. Two independent verdict lines are recorded here and a run
must pass both: the structural one over the 7 dimensions of §3, and the art-direction one over the
4 axes of §4, judged by looking at the rendered pages rather than by reading token files. Neither
line has been written yet — Phase 1 is the contract, and nothing in it will be edited to match
what gets built.
