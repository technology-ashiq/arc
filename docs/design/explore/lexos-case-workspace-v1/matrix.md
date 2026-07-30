# IA-difference matrix — explore `lexos-case-workspace-v1`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact.
>
> Brief: `docs/design/briefs/lexos-case-workspace/brief.md` (which reads LexOS at `4784ac9`) ·
> explore base `7f65ab0` · isolation: route-namespace fallback (ADR-0037), all three variants
> side by side in this dir.
>
> Phase 1 (§1–§7 below) is the contract. Phase 2 — the `Director call:` line — is recorded at
> the foot of this file, written after all three variants existed and were read against the
> expected-entry table. Nothing in Phase 1 was edited to match what got built.

## The structural question this explore exists to answer

The brief's answer A.5 names the disclosure split and then refuses to arrange it:

> Always visible: the case's identity (parties, case number where one exists), its status, its
> next hearing, its overdue count. On demand: the full hearing history, the document list, the
> task list, the notes. **This brief deliberately does not declare HOW that split is arranged.**

The shipped build arranges it as a five-tab rail (Overview | Hearings | Documents | Tasks |
Notes) plus a 16rem actions panel. Three variants, three different arrangements. The two
escalated debts are the sharpest axes available, and each variant owes a *different answer* to
both — see "The two debts, answered three ways" below.

## Assigned theses

| variant | thesis (product structure) | one-line thesis |
|---|---|---|
| A | **command center** — dense, keyboard-first | This product wins because the user can see and record into all four of a case's sections at once at full viewport width, without a tab switch or an actions panel standing between him and the row he needs to write. |
| B | **narrative** — content-led, paced | This product wins because the user can read a case's whole history as one dated record and add the next fact at its head, without deciding which of five tabs the thing he is looking for was filed under. |
| C | **guided workflow** — steps, progressive disclosure | This product wins because the user can advance a case by taking the single action its current position demands, without choosing between four identical buttons or judging for himself what the case is waiting on. |

The three answer the job sentence ("opens a case and knows, without hunting, what has happened
on it and what is due next") from three different ends. **A** removes hunting by putting
everything on screen simultaneously. **B** removes hunting by abolishing the categories you
would hunt *within* — one dated record, type is a label not a container. **C** removes hunting
by answering the second half of the sentence for the lawyer: the case tells him what is due
next and offers exactly that.

## The two debts, answered three ways

Both debts are IA decisions the shipped review escalated. A variant that answers either one the
same way as another variant has spent its divergence budget badly.

| debt | A · command center | B · narrative | C · guided workflow |
|---|---|---|---|
| **1. Content column frozen at 416px above `lg`** | **Exceed the token.** The route stops being a shell page: full viewport width up to a wide cap, and the freed width buys *simultaneity* — two or three ledgers side by side at ≥1024px. `max-w-shell` is explicitly declared not to govern this route, with the reason written on the page. | **Replace the measure for this route.** Still one column, but a *reading* measure wider than `max-w-shell` — the record's dated rows get the width the list route's 689px rows already prove is available. The width buys line-length for the record, never a second region. | **Keep the token; delete the panel.** 48rem minus a 16rem panel minus the gap is 416px; 48rem with no panel is 768px. C fixes the debt with an 85% gain and zero token change, and says so — the measure was never the bug, the panel eating it was. |
| **2. Actions panel has no hierarchy, offers all four actions on every tab** | **Distribute and delete.** No panel exists. Each ledger's own header carries its one verb; the case header carries the one thing the whole case is waiting on. Row-level `add` is inline, at the cursor. | **One compose point.** No panel, no per-section verbs. The record has a single affordance at its head, where the next dated fact will land; the type of entry is chosen inside that one act, not before it. | **One action, ever.** No panel. Exactly one primary button on screen at any time — the one the current step demands. The other three verbs are not secondary buttons; they live inside steps that are not open yet, and later steps state why they are blocked. |

## The 7 dimensions — EXPECTED entry per variant

| # | dimension | A · command center | B · narrative | C · guided workflow |
|---|---|---|---|---|
| 1 | **primary object** | The case as **one dense board of its four ledgers** — hearings, documents, tasks and notes are four simultaneous regions of a single instrument; the unit is a row in a ledger. | The **case record** — one continuous dated stream. The unit is a dated entry; its type (hearing · document · task · note) is a label carried *on* the entry, not a container it lives inside. | The **case's current position in its hearing cycle** — what this case is waiting on right now. The unit is a step, and the case's four sections are the steps' contents, not destinations. |
| 2 | **primary action** | **Record into the ledger the cursor is in.** Inline row-level `add`/`record` at the cursor, plus one case-level primary in the header for the thing the whole case is waiting on. Four verbs exist, each in its own ledger header — never four in one place. | **Add the next entry at the head of the record.** One compose affordance, at the top of the stream; recording what happened and adding the next hearing are the *same* entry, because in the record they are one dated fact and its consequence. | **Fire the current step's single verb.** `Record hearing outcome` now; `Add hearing` only after that; `File document` only inside the documents step. One primary button on screen, always, and it changes as the run advances. |
| 3 | **info before action** | The mandated quartet as a dense fixed header strip, **plus the latest rows of all four ledgers** — the lawyer sees the newest hearing, newest document, oldest overdue task and newest note without a single click. | The quartet as a **standing preamble** above the record's first entry (a case file's cover sheet precedes its pages), and the next hearing appears *twice* — once in the preamble, once as the record's future-dated head entry, because in a record a future date is an entry that has not happened yet. | The quartet as a fixed status line, **plus the current step's precondition and nothing else** — "Hearing held 14 Jul 2026 · outcome not recorded". Enough to act on the step without opening anything; the history is not needed to take the step and is not shown. |
| 4 | **navigation model** | **None.** One screen, no routes, no tabs, no drill-in. Navigation is cursor movement between ledgers and between rows inside a fixed layout. | **Chronological progression.** Position in the record is the address. Sticky dated period headers are the only navigation control — they collapse and expand; there is no section list and no type tab. | **Step progression through a run with a definite end state** ("Nothing due until 12 Aug 2026"). A horizontal step rail across the top, not a vertical panel; steps are addressable and revisitable, but ordered, and completed steps collapse to a one-line dated done state. |
| 5 | **progressive-disclosure rule** | **In place, by row.** Everything the brief marks on-demand is already on screen at row density; depth expands *beneath its own row*, displacing nothing and moving no other ledger. Nothing is hidden by type. | **Temporal, by period.** The current period and the next-due entry are open in full; older periods collapse to one dated summary line ("Mar–Jun 2026 · 3 hearings · 4 documents") that expands in place. The future is exactly one entry. | **Per step.** Only the current step is open. Each step shows only its own slice — the documents step shows the documents due before the next hearing, not the document list — and the full hearing history is a single disclosure at the foot of the run. |
| 6 | **expert path** | Keys move over **ledgers and rows**: jump ledger, `j`/`k` within it, expand, add a row inline without reaching for a button, and one key to the next case due this week — never leaving the board. | Keys move over **dates and entries**: jump to the next-due entry, a "since you last opened" marker so only new entries are read, and an in-stream filter to one entry type that never leaves the record. | Keys move over **steps**: one key fires the current step's single action, one walks the steps, and when the run reaches its end state the same key advances to the next case whose run is incomplete. Expertise is never having to choose which of four actions to take. |
| 7 | **failure/recovery path** | The failed row stays **in place in its ledger**, holding its sort position, with what failed and the next step in the row. Nothing else on the board moves. Return: the cursor lands in the ledger carrying the overdue. | The failed entry stays **in the stream at its date**, marked unrecorded with what failed and the next step, and the record cannot read as current while an entry is unrecorded. Return: opens at the next-due entry, not at the top. | The run **stalls at the step**: the step stays open with what failed and the next step, and later steps are explicitly disabled with a stated reason ("Cannot add the next hearing until the 14 Jul outcome is recorded"). Return: opens at the stalled or current step, never at a section. |

## Shared floor — NOT divergence surface

Identical across A, B and C. A variant that "innovates" here has diverged on the wrong axis.

**From the brief, non-negotiable:**

- The **always-visible quartet** — parties, case number where one exists, status, next hearing,
  overdue count — is on screen at all times in all three, never behind a click and never
  behind a step. This is the hq lesson: the losing variant there hid brief-mandated facts
  behind a queue selection. A guided run that hides the case's status is a VIOLATION, not a
  thesis.
- **A field that exists and is empty still shows.** "Next hearing — not set" is information in
  a legal record. Do not hide it, do not collapse it, do not substitute a dash for the label.
- **Loading exists.** The shipped build has none; `SKEL` / `SKEL_SOFT` exist for exactly this.
  Every variant declares all five states — empty · loading · error · success · disabled — for
  the case header and for each of its own content regions (A's ledgers, B's periods, C's steps).
- **Closed vocabulary.** Nouns: case · hearing · document · task · note · client · firm ·
  case number · court · case type · filing. Verbs: `add` · `edit` · `remove` · `save` ·
  `record` · `file`. **`set`, `schedule`, `reschedule`, `close`, `reopen` are not verbs in this
  product** — "set the next hearing" is rendered as **`Add hearing`**. The brief records that a
  first draft invented `close`/`reschedule`/`reopen` and `cause title`/`adjournment`; do not
  re-invent them. "Hearing outcome" is sanctioned — it is the brief's own words in A.3.
- **Statuses are exactly `INTAKE` · `ACTIVE` · `ON_HOLD` · `CLOSED`**, rendered through
  `statusLabel()` (so "On hold", never `ON_HOLD`), and never carried by colour alone — the
  badge has a label as well as a tone. No fifth status. No status-like word invented for a
  step, a period or a ledger.
- **Voice: a court record, not an assistant.** State the fact and its date. No exclamation
  marks, no encouragement, no congratulation for filing something. Anti-words: urgent ·
  decorative · chatty.
- **Destructive language names the thing** and states that it cannot be undone; a destructive
  link is never styled identically to a benign one beside it. Errors say what failed and what
  to do next.
- **Density rules:** one row per hearing, per document, per task · dates and amounts in
  tabular numerals so they align down a column · a row's meta separated by ` · ` consistently
  (the shipped build is inconsistent between routes — every variant picks ` · `).
- **Dates as `27 Jul 2026`. ₹ in Indian digit grouping (₹18,45,000).** Lorem ipsum is a
  VIOLATION anywhere, including inside a collapsed period or a disabled step.

**System stance, kept unless a thesis is explicitly about changing it:**

- No drop shadows anywhere — separation by `line` borders. No gradient heroes. No emoji as
  iconography. No centre-everything empty states in dashed boxes; empty states are
  left-aligned on a quiet fill. One radius token. Motion is colour-only, 150ms, with
  `motion-reduce:transition-none`.
- The `disabled` token (#6b7280, 4.83:1 under white) is **earned and deliberate**. It is not a
  defect and no variant "improves" it.
- a11y floor: text contrast ≥4.5:1 against the brief's declared pairs · targets ≥44px ·
  visible focus (the rebuilt rail's 2px inset `outline-ink` is the reference) · reduced motion
  honoured.
- Colour lives in `variant-*/tokens.css` only, as custom properties taken from
  `tokens-reference.md`. **A raw hex anywhere in variant markup is refused by
  `design-explore check`.** Do not read the LexOS repo — it carries the owner's uncommitted
  work and is out of bounds; `tokens-reference.md` is the substitute.

**Director ruling — `max-w-shell` (48rem).** It is a token, and debt 1 is explicitly a licence
to answer it differently. A and B may exceed or replace it **for this route only**, and must
declare the departure on the page with the reason. C must NOT — C's whole answer to debt 1 is
that the token was never the bug. Any other token change is out of scope for all three.

**Director ruling — real court vocabulary as CONTENT vs as LABEL.** A document's own title is
data a lawyer typed (`Written statement`, `Affidavit`, `Vakalatnama`, `Interim application` are
all fine as document titles in the fixture). An interface LABEL, status, step name, column
heading or button may use only the closed vocabulary above. This is the exact line the brief's
`cause title` / `adjournment` note draws — real-sounding is not the bar for chrome.

**Mobile is required and is not a divergence dimension.** Each variant owes a stated reflow:

- **A** — the four ledgers stack as four labelled sections in one scroll; the ledger-jump keys
  become a sticky section switcher. Still no tabs, still no panel.
- **B** — natively one column already; the period headers stay sticky and the compose
  affordance stays at the head.
- **C** — one step per screen, which is the guided run's natural shape; the horizontal step
  rail compresses to "Step 1 of 4" plus the step's own name.

A variant that only works at 1280px is not a thesis. Tablet is `no` by declaration, but 768px
is where the shipped content column is widest and a variant may use that; it does not owe it.

## Canonical fixture — same case in all three

So that divergence is structural and not an artefact of one composer inventing better content.
Composers may add rows, but not change these facts.

- **Open case:** `Meera Raghunathan v. Sunvale Housing Pvt. Ltd.` · case number
  `O.S. No. 412 of 2024` · `City Civil Court, Bengaluru` · case type `Civil suit` ·
  client `Meera Raghunathan` · claim `₹18,45,000`
- **Status:** `ACTIVE` (rendered "Active")
- **Last hearing:** held `14 Jul 2026` — **outcome not recorded**
- **Next hearing:** **not set** (the field shows, empty — this is why the case needs advancing)
- **Overdue:** `2` — one task due `21 Jul 2026`, one document due `24 Jul 2026`
- **Recent record:** a document filed `08 Jul 2026`, a note added `16 Jul 2026`, an earlier
  hearing held `19 May 2026` with its outcome recorded, fee received `₹42,500` on `02 Jul 2026`
- **Other cases** (only where a variant's next-case path needs them):
  `Vishnu Menon v. Ashirvad Developers` · `O.S. No. 118 of 2025` · `ACTIVE` · next hearing
  `04 Aug 2026` · 0 overdue — and `Sundaram Finance Ltd. v. R. Palaniappan` ·
  `E.P. No. 63 of 2026` · `ON_HOLD` — and one `INTAKE` case, `Latha Bhaskaran`, with **no case
  number yet**, whose case-number field shows empty rather than hidden.

## Convergence risks the composers must actively avoid

- **A vs B** — both abolish the five tabs and both use the freed width. A's width buys
  **simultaneity** (several ledgers visible at once); B's buys **line length for one stream**.
  If A collapses to a single merged chronological column, A has become B. If B grows a second
  region beside the record, B has become A. The tell: in A, hearings and documents are
  *different places on screen at the same time*; in B, they are *the same place, different
  dates*.
- **A vs C** — both delete the actions panel and both are keyboard-driven. A offers four verbs
  simultaneously, one per ledger header; C offers exactly one, ever. If C ends up showing all
  four steps open with their own buttons, C has become A with a progress bar. If A adds a
  "what to do next" recommendation strip, A has become C.
- **B vs C** — both put a small amount in front of the user at a time and both are single
  column. B's unit is **a dated entry in a record that has no end**; C's is **a step in a run
  that finishes**. If B's periods become numbered stages with a next button, B has become C. If
  C's steps become a dated list of everything that happened, C has become B.
- **All three vs the shipped build** — the failure mode is same-app-different-styling. Any
  variant that keeps a vertical 16rem region of buttons, or a five-item section rail, has not
  answered either debt and has re-skinned the baseline.

## Rejected theses

Rejected **before** composing, because a thesis reassignment after build burns the phase
appetite (pre-mortem risk 4).

- **canvas (spatial object manipulation)** — structurally absurd for this brief. Position on a
  canvas would have to encode a date, which means dragging a hearing changes when it is — and
  that is `reschedule`, a verb the brief records as appearing in **zero** LexOS files. A canvas
  thesis therefore cannot be built without smuggling in the exact invented verb the content
  contract exists to prevent. It also fails the platform contract twice: keyboard-first and
  mobile-required are both defeated by free spatial manipulation, and the primary action is
  `record` a fact into a legal register, not arrange objects in space. A case file is a
  sequence of dated facts; space adds no dimension the record does not already own.

- **ambient assistant (AI present, not dominant)** — rejected on voice and on vocabulary. The
  brief's voice line is literally *"a court record, not an assistant"*, `chatty` is a declared
  anti-word, and the product ships no AI noun at all — every noun in the content contract is
  case · hearing · document · task · note · client · firm. An assistant layer needs a product
  noun from outside that set (suggestion, draft, summary), which the content contract's own
  VIOLATION rule bans. Strip the invented noun and what remains is the case's overdue count
  read aloud — it converges on C's "what is this case waiting on" instead of diverging from it.

- **review workspace (compare, annotate, approve)** — not absurd, and the strongest reserve,
  but rejected on two counts. First, its native verbs map onto almost nothing shipped:
  `approve` does not exist in a solo lawyer's case workspace, `annotate` exists only as `note`,
  and `compare` needs a second thing to compare against that the product does not hold —
  reaching for one means inventing a "required before the next hearing" checklist status,
  precisely the fifth-status invention the brief forbids. Second and worse, its natural shape
  is two vertical panes, which is the shipped build's shape — it carries the highest
  same-app-different-styling risk of the six, on the one axis (debt 1) this explore most needs
  answered differently. Its untaken claim — *the case is read as a gap between what the next
  hearing requires and what is on record* — is real, and if a Phase 2 reassignment round is
  ever called this is the first candidate to swap in, with the approve/compare vocabulary
  problem solved first.

---

# Phase 2 — the divergence call

Written after all three variants existed, by reading `variant-{a,b,c}/index.html` and
`variant-{a,b,c}/tokens.css` against the expected-entry table above. The question this section
answers is not "is each variant good" — that is the critic's and the jury's job — it is only:
**on how many of the 7 dimensions do the three actually differ, and materially?**

## Dimension by dimension — assigned vs built

| # | dimension | differ? | what is actually on the three pages |
|---|---|---|---|
| 1 | **primary object** | **differ** | A: four `section.ledger` regions in a grid, the unit a `details.row`. B: one `section#record` of `article.entry` rows, each carrying its type as a `.tag` label with `data-type`, inside two dated `details.period` containers. C: `section.run` of three `article.step` elements plus a "Waiting on" line — the object is the case's position, and the four sections appear only as step contents and two foot disclosures. A ledger row, a dated entry, a step: three different units. |
| 2 | **primary action** | **differ, countably** | Action affordances on the live page: **A 40** (four ledger-header verbs live at once, four inline add rows, a case-header `Add hearing`, per-row record/save/edit/remove) · **B 13** (one `Add entry` compose point at the head, type chosen *inside* the act so exactly one submit is ever visible, the rest are per-entry edit/remove links) · **C 1** (`Record hearing outcome`, the only `<button>` on the page; steps 2 and 3 carry reasons, not buttons). Four verbs / one compose point / one verb, as assigned. |
| 3 | **info before action** | **differ** | All three show the same mandated quartet (that is the floor). What surrounds it is not the same thing: A adds the newest rows of all four ledgers at row density; B adds a five-field sticky preamble, the whole dated stream, and the next hearing stated *twice* (preamble + the "Ahead" future entry); C adds one line — "Waiting on — Hearing held 14 Jul 2026 · outcome not recorded" — and hides the history in collapsed disclosures. Everything at once / everything in date order / one precondition and nothing else. |
| 4 | **navigation model** | **differ** | A: one screen, four regions co-present, movement is cursor movement (keys 1–4 + `j`/`k`); a four-item jump nav exists but exchanges nothing and hides nothing. B: chronology is the address — sticky period headers, a `#next-due` anchor, no region ever swapped. C: an ordered three-step run with a declared end state ("Nothing due until 12 Aug 2026"), horizontal rail, blocked steps addressable but stated-blocked. Co-presence / chronology / an ordered run that finishes — the dimension where the three are least alike in kind. |
| 5 | **progressive-disclosure rule** | **differ** | A hides by *nothing structural* — every row is present, depth opens beneath its own row inside its own ledger, no type is ever hidden. B hides by *time* — Jul 2026 open in full, "May 2026 · 1 hearing" collapsed, the future exactly one entry. C hides by *position in the run* — one step open, the others collapsed to a stated reason, history behind foot disclosures. Three different axes of hiding. |
| 6 | **expert path** | **differ (on the object, not the letters)** | A's keys traverse ledgers and rows (1–4 jump ledger, `j`/`k` within it, `a` opens the inline add row at the cursor, `n` reveals the next case due this week). B's traverse dates and entries (`n` to the next-due entry, `s` the since-marker, `f` the in-stream type lens). C's traverse steps (`Enter` fires the one verb and, at the end state, advances to the next case awaiting action; arrows walk steps). A and B both bind `j`/`k`/`n` — that shared *lettering* is not evidence of shared *concept*, and the inverse of superseded row 12 applies as strictly as the original: A's `n` is the next **case**, B's `n` is the next **entry in this record**, and their `j`/`k` move over region-scoped rows vs one continuous stream. |
| 7 | **failure/recovery path** | **differ** | A: the failed row holds its sort position in its own ledger ("File written submissions · Due 21 Jul 2026 — could not save this task" + Retry) and return focuses the ledger carrying the overdue — Tasks — stated on the page. B: the unrecorded entry stays in the stream at 14 Jul, flagged `Unrecorded` with "Next step: record the outcome to keep this case current", and return is the `#next-due` anchor, not the top. C: the run stalls at step 1 and the two downstream steps are disabled with stated reasons; "Opens here on return — Hearing outcome, not a section." Three loci of failure, three return addresses. |

Director call: A/B/C differ materially on 7 of 7 dimensions — the three do not arrange the same case three ways, they disagree about what the primary object *is* (a ledger row · a dated entry · a step in a run), and that disagreement propagates all the way down: 40 action affordances on A's page against 13 on B's and exactly 1 on C's, hiding by row against by period against by step position, and three different return addresses after a failure.

The bar was ≥3 of 7. The call stands and the explore proceeds to critique. Two cells drifted
from their expected entry without collapsing the difference, and are recorded here so the record
is honest rather than rounded up: **A dim 4** was assigned "navigation: none" and built a
four-item jump nav (anchors + keys 1–4) — it hides nothing and swaps no region, so A still
differs from B and C on the dimension, but it is the closest A comes to the baseline's rail;
**C dim 5** was assigned the full hearing history as *a single* foot disclosure and built two
("Full hearing history" and "Recent record").

## The four convergence risks, checked against what got built

- **A vs B — simultaneity vs line length. Not converged, and the tell holds both ways.** A's
  `.board` is a grid that goes 1 → 2 columns at 1024px → 4 columns at 1440px inside a 96rem
  cap: hearings and documents are literally different columns at the same moment. B is one
  column at 56rem whose own measure note states "the extra width is spent entirely on the
  record's line length — it does not open a second region": hearings and documents are the same
  column at 14 Jul and 08 Jul. A did not collapse into a merged chronological column; B grew no
  second region.
- **A vs C — four verbs vs exactly one. Not converged; the widest gap in the set.** C's live
  page contains one `<button>`. Steps 2 and 3 are not secondary buttons, they are reasons
  ("Cannot add the next hearing until the 14 Jul 2026 outcome is recorded"), so C did not become
  A-with-a-progress-bar. A grew no "what to do next" recommendation strip either: its
  case-header primary is a single button (`Add hearing`, the empty field in the quartet), and its
  `n` strip is the *next case*, not advice about this one — so A did not become C.
- **B vs C — an endless dated record vs a run that finishes. Not converged, but this is the one
  contact point to watch.** B has no end state anywhere, no step numbers and no next button; its
  future is one open-ended entry ("Next hearing — Not set"). C is numbered Steps 1–3 with a
  declared terminus ("Nothing due until 12 Aug 2026"). C *does* carry a dated list of seven
  facts — its "Recent record" disclosure — which is the closest C ever comes to B. Ruling: it
  does not converge, because it is collapsed by default, sits at the foot, has no compose
  affordance, has no periods, and is not the primary object. Flagged for the critic: if that
  disclosure were ever open by default, C would be B with a step rail.
- **All three vs the shipped build — no re-skin.** No variant has a vertical 16rem button
  region: A distributed the verbs into ledger headers, B has one compose point, C has one
  button. No five-item section rail: A's jump nav is four items and hides nothing, C's step rail
  is three. **B's five-item type filter is the one item that needed adjudicating**, and the
  ruling is that it is a lens, not an address — it filters entries in place with `display:none`
  inside a single region, defaults to `All` so the whole record is the resting state, has no
  "Overview" destination, and leaves scroll position and period structure untouched. It is also
  the thing dim 6 explicitly assigned B as its expert path ("an in-stream filter to one entry
  type that never leaves the record"), which sits in tension with dim 4's "no type tab" — my own
  contract, so my own reconciliation: dim 4 forbids type as an **address**, dim 6 grants type as
  a **lens** over the single address, and B built the lens. Craft note handed to the critic, not
  a divergence finding: the filter's inverse-filled 44px pills *read* tab-like even though the
  IA underneath is not.

## Shared floor — held in all three

- **Always-visible quartet:** held. A (title + meta lines, status badge, Next hearing, Overdue,
  in a sticky header stack) · B (a five-field sticky preamble that stays pinned through the whole
  record) · C (h1 + meta, status badge, Next hearing, Overdue, Claim). All five mandated facts
  are on screen at all times in all three — nothing behind a click, a period or a step.
- **Empty field still shows:** held. All three render "Next hearing — Not set" as a labelled
  field; B states it a second time in the "Ahead" entry; C also shows Latha Bhaskaran's case
  number as "Not set" rather than hiding it. Recorded so nobody mis-flags it later: **"Not set"
  is the brief's own phrase for the empty field** (fixture line: "Next hearing: not set"), not
  the banned verb `set` used as a label.
- **All five states declared:** held, at three depths. A renders 5 states × 5 surfaces (header +
  four ledgers). B renders 5 × 2 regions (case header, period). C renders four states × 2
  regions and names the two that are live above, with its intro sentence declaring all five
  explicitly. C's is the leanest reading of the requirement and still meets it.
- **Closed vocabulary:** held. Grep-clean across all three for `set`/`schedule`/`reschedule`/
  `close`/`reopen` as verbs; "Closed" appears only once, as a status label in B's disabled card.
  Statuses are exactly the four, rendered as human text ("Active", "Intake", "On hold",
  "Closed") with a label *and* a tone, never colour alone. No fifth status was invented for a
  ledger, a period or a step. `Record hearing outcome` / `Record outcome` / `Record hearing` all
  sit inside the sanctioned "hearing outcome" + `record`.
- **Canonical fixture facts unchanged:** held in all three — Active · hearing held 14 Jul 2026
  with outcome not recorded · next hearing not set · overdue 2 (a task due 21 Jul, a document due
  24 Jul) · document filed 08 Jul · note added 16 Jul · hearing 19 May held with outcome recorded
  · fee ₹42,500 on 02 Jul · O.S. No. 412 of 2024 · City Civil Court, Bengaluru · Civil suit ·
  ₹18,45,000. The document and task *titles* differ between variants (Reply affidavit / Reply to
  written statement / Affidavit; File written submissions / File rejoinder / Collect certified
  copy of sale deed) — permitted by the content-vs-label ruling above, since the dated facts they
  carry are identical. C added a 10 Feb 2026 hearing to its history, which "composers may add
  rows" allows.
- **Declared mobile reflow present:** held in all three. A's grid falls to one column so the four
  ledgers stack as four labelled sections, switcher sticky and horizontally scrollable. B keeps
  one column, moves the sticky period offset to 6.75rem and drops entries to a single column,
  compose still at the head. C hides the full rail and shows a compact "Step 1 of 3" plus the
  step name, quartet to one column.
- **System stance:** grep-clean for `box-shadow`, gradients and lorem in all three. One radius
  token (0.375rem) each; `--disabled: #6b7280` present and untouched in all three; transitions
  colour-only at 150ms with `prefers-reduced-motion` honoured; 44px targets and 2px focus
  outlines throughout.

## Licensed departures — each did what it was licensed to do, and nothing more

- **A (permitted to exceed `max-w-shell`)** — added `--board-max: 96rem` and **kept**
  `--max-w-shell: 48rem` in tokens, commented "kept for the record — this route does not use
  it", with the reason on the page in the `.width-note` paragraph. It took the licence more
  narrowly than granted: a route-scoped token rather than raising the shared one.
- **B (permitted to replace the measure)** — added `--record-measure: 56rem` and kept
  `--shell-measure: 48rem` labelled as the default it departs from, with the reason on the page
  in the `.measure-note` block, including "it does not open a second region" and "this departure
  applies to this route only".
- **C (forbidden to touch it)** — `--shell-max: 48rem`, commented "max-w-shell — unchanged. The
  panel was the bug." Obeyed exactly; the whole 416px → 768px gain comes from deleting the panel.
- No other token changes in any of the three.

> **Pointer, appended 2026-07-30 — this section describes the pages AS BUILT and is left intact
> as that record.** The `.width-note` paragraph (A) and the `.measure-note` block (B) were
> **removed from the pages before blind-test packaging** by owner decision — see AMENDMENT 2 in
> `phases/phase-03-spec.md`. The token declarations themselves are untouched and still carry
> their comments in each `tokens.css`; only the on-page prose was stripped, because
> `max-w-shell` is meaningless to an external respondent and only two of the three pages carried
> such a note. The director's ruling above is not amended — what each variant was licensed to do,
> and did, is unchanged.

## The composers' self-reports, judged rather than taken on trust

1. **A wired its keyboard model as real DOM focus movement — verified, not accepted on trust.**
   `focusLedger()` moves focus to the first row summary of the target ledger; `moveRow()` indexes
   the focused summary within its own ledger and moves focus by ±1; `openAddRow()` opens the
   inline add row and focuses its first field; a `focusin` listener tracks which ledger is
   current so `a` lands in the right one; `isTypingTarget()` guards the bindings while a field
   has focus. That is real focus movement, not a legend. Consequence for the record: dim 6 is
   **wired in A and declared-only in B and C** (neither ships a script; B's filter is still
   operable because it is native radios, and its jump is a real anchor). That is a fidelity
   asymmetry for the critic and the jury to price — it is not a divergence failure, because the
   three still differ on what the keys traverse.
2. **C scoped its run to three hearing-cycle steps and invented no fourth step for tasks —
   accepted, and it was the right call.** The closed verb set (`add` · `edit` · `remove` ·
   `save` · `record` · `file`) contains no verb for completing a task, so a fourth step would
   have required inventing one — the exact violation the content contract exists to prevent, and
   one the brief already caught once. The *shape* is unchanged (ordered horizontal rail, one open
   step, blocked steps with stated reasons, a declared end state) and the compact mobile rail
   correctly reads "Step 1 of 3"; the matrix's "Step 1 of 4" was shape illustration, not a count
   contract. The same reasoning covers there being no step for `add note`: adding a note does not
   advance a case.
3. **C's bare overdue number with the detail in a foot disclosure — accepted.** The floor
   requires the overdue *count* to be always visible, and it is (2, danger tone, tabular). *Which*
   items are overdue is the task list and the document list, which the brief's own A.5 assigns to
   on-demand. This is the thesis's cost, deliberately paid — C's lawyer must open a disclosure to
   learn what the 2 are, where A's sees both overdue rows without a click — and pricing that cost
   is exactly what the jury is for.
4. **B anchored "next-due" on the 14 Jul unrecorded hearing rather than the earliest overdue item
   — accepted and internally coherent.** B's assigned dim 7 is that the record cannot read as
   current while an entry is unrecorded, which makes the unrecorded entry the correct recovery
   address; the entry states its own next step ("record the outcome to keep this case current"),
   and the two overdue items are still visible and flagged `Overdue` in the same stream above it,
   so nothing is buried. Consequence worth naming: B and C now anchor on the **same fact**. That
   is content convergence, not structural — B holds it as one entry among seven, at its date, in
   a record with no end; C holds it as the only thing on screen and the gate on two blocked steps.

## Reassignment

**None.** All three theses were built as assigned — A is a board of four simultaneous ledgers, B
is one dated record with a single compose point, C is a run with exactly one button — so there is
no thesis that "genuinely was not built", and the one reassignment round stays unspent. The two
drifted cells (A's jump nav, C's second disclosure) and the fidelity asymmetry on dim 6 are craft
findings, which are the critic's and the jury's to judge, not grounds for a director
reassignment. Spending the round here would have burned phase appetite (pre-mortem risk 4) to
buy divergence the trio already has.
