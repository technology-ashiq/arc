# IA-difference matrix — explore `hq-dashboard-v1`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact. Brief:
> `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md` · base `7d42c2d` ·
> isolation: route-namespace fallback (ADR-0037), all three variants side by side in this dir.
>
> **Phase 2 is now complete.** The written `Director call:` line is at the foot of this file,
> in the "Phase 2 — the divergence call" section. (An earlier revision of this note recorded
> that the call was "deliberately absent until Phase 2" and that `design-explore check` was
> correctly failing on `director-call-missing`; that was true when written, and is superseded
> here so this file does not carry a stale statement about its own contents.)

## Assigned theses

| variant | thesis (product structure) | one-line thesis |
|---|---|---|
| A | **command center** — dense, keyboard-first | This product wins because the user can clear every approval with j/k/a/r while the KPI row and today's event timeline stay in view, without navigating to a second screen. |
| B | **review workspace** — compare, annotate, approve | This product wins because the user can judge one approval against its council verdict, its ₹ amount and its venture's kill-criteria state in a single pane, without reconstructing that evidence from receipts he has to go find. |
| C | **narrative** — content-led, paced | This product wins because the user can move through today's events in order and approve or reject each decision at the event that produced it, without a separate inbox that strips each decision of the day it came from. |

The three answer the job sentence ("see everything the company did today **and** clear the
decisions waiting on him in under ten minutes") from three different ends: A takes both
halves at once on one surface, B takes the *clear* half to full evidence depth on one
decision, C takes the *see the day* half and makes the decisions fall out of it.

## The 7 dimensions — EXPECTED entry per variant

| # | dimension | A · command center | B · review workspace | C · narrative |
|---|---|---|---|---|
| 1 | **primary object** | The **day surface** itself — KPI row, today's event timeline and the approval inbox are three regions of one object; an approval is one row inside it. | The **approval** on its own, opened to full depth: council verdict + score, ₹ amount, and the venture's kill-criteria state, held against that venture's prior receipts. | The **event** — today's timeline entries in order; an approval is the event that has not been dispositioned yet. |
| 2 | **primary action** | Sweep and dispose: move the selection down the inbox and fire approve/reject without the selection ever leaving the dense grid. | Adjudicate one decision: approve · reject · promote · kill, with the reason stated, against evidence that is already on screen. | Advance and dispose in place: move forward through the day, and approve/reject the event you have arrived at. |
| 3 | **info before action** | The three mandated facts as three fixed columns in the selected row — verdict + score, ₹ amount, venture kill-criteria state — at row density, plus the KPI row and timeline in peripheral view for free. | The same three facts as full blocks, not columns: the verdict with its score, the ₹ amount the decision touches, and the venture's kill-criteria state expanded to which criteria are near breach, alongside that venture's prior receipts for comparison. | The same three facts inline at the event, in the order the day produced them: what happened, what it costs, what the council said, where the venture's kill criteria stand — read as the day's sequence, not as a card's fields. |
| 4 | **navigation model** | **None.** One screen, no routes, no drill-in; navigation is selection movement within a fixed layout. | **Record-to-record.** A queue rail traverses approvals one at a time; the evidence pane re-loads per approval; comparison against the venture's prior receipts is a lateral move, not a new screen. | **Chronological progression.** Forward and back through today, earliest to latest; position in the day is the address. |
| 5 | **progressive-disclosure rule** | Everything the brief marks always-visible is on screen simultaneously; disclosure is **in place** — evidence links, autonomy-ladder detail and chart tooltips expand inside their own region without displacing anything else. | Inverted: the evidence is always deep and the **queue** is what stays collapsed — the rest of the inbox is a rail of identifiers, and only the open approval carries detail. | **Temporal**: later beats of the day are not yet shown; the day discloses itself as the user advances. Depth per event (evidence links, autonomy-ladder detail) stays on demand. |
| 6 | **expert path** | `j`/`k` selection, `a` approve, `r` reject-with-reason — never leaves the grid; the ~10-minute mouse clear collapses to ~3 minutes of keys. | Keyboard moves between the evidence pane and the rail, and reject/kill reasons are selectable presets rather than free typing — expertise is spent on the judgment, not on re-reading evidence. | A skim mode collapses the day to only its undecided events, and a jump-to-earliest-undecided key means the expert never re-reads a beat he has already cleared. |
| 7 | **failure/recovery path** | Failure is stated inline in the row (what failed + next step); the row holds its place in the grid. Success collapses the row into the done log carrying its receipt id. Return: inbox region re-orders newest-first, nothing lost. | Failure keeps the approval open in the evidence pane with the error and next step stated, evidence retained so the retry needs no re-reading. Success moves it out of the rail into the done log with its receipt id. Return: the rail re-orders newest-first and re-opens the top approval. | Failure marks the beat unresolved in place in the day, with what failed and the next step on the beat itself; the day cannot read as finished while a beat is unresolved. Success writes the receipt id into the beat and it settles into the done log. Return: resumes at the earliest unresolved beat, with the day's later beats re-ordered newest-first. |

## Shared floor — NOT divergence surface

These come from the brief and are identical across A, B and C. A variant that "innovates"
here has diverged on the wrong axis:

- The three facts of dimension 4 of the brief (council verdict + score · ₹ amount · venture
  kill-criteria state) are **on the card, never behind a click** — in all three.
- Closed vocabulary only: venture · phase · receipt · council verdict · approval · autonomy
  level (L0–L3); verbs approve · reject · promote · kill. No invented per-panel synonyms.
- Terse operator console voice; numbers carry the sentence; no exclamation marks. A kill
  action names the venture and states the irreversible consequence on the button. Errors
  state what failed and the next step — "something went wrong" is banned.
- State matrix: inbox and timeline (or each variant's equivalent region) declare all five —
  empty · loading · error · success · disabled. The KPI row declares empty and error only; a
  number never spins, it greys the last known value and says how stale it is.
- a11y floor: contrast ≥4.5:1 against the brief's declared pairs · targets ≥44px · visible
  focus · reduced motion honoured. Desktop + keyboard-first only; no mobile, no tablet.
- Colour lives in `variant-*/tokens.css` only — no raw hex in any page.
- Slop kill-list: no gradient heroes · no emoji as iconography · no three-equal-column
  feature rows · no centre-everything layouts.
- **Director ruling on a brief ambiguity:** the brief's disclosure line writes per-event
  evidence as "🧾 links" while the art direction bans emoji as iconography. The art
  direction wins — evidence affordances render as text or as the receipt id, never as the
  emoji. Applies to all three variants.

## Convergence risks the composers must actively avoid

- **A vs B** — both carry an approval queue. A's queue is a *region of a dense whole-day
  screen* and must never become the screen; B's queue is a *rail of identifiers* and must
  never grow into a readable grid. If A's inbox region ends up full-width with an evidence
  panel, A has become B.
- **A vs C** — both show today's events. A's timeline is a *peripheral always-visible
  region* that is read but not traversed; C's day *is* the navigation. If C ends up as a
  three-region dashboard with a taller timeline, C has become A.
- **B vs C** — both put one thing in front of the user at a time. B's unit is *an approval
  with its evidence*; C's unit is *a moment in the day*. If C's beats become cards in a
  queue with a next button, C has become B with a progress counter.

## Rejected theses

Three of the six candidate structures were rejected **before** composing, because a thesis
reassignment after build burns the phase appetite (pre-mortem risk 4).

- **canvas (spatial object manipulation)** — rejected as structurally absurd for this brief.
  Position on a canvas would encode nothing: the spine already holds the state (phase,
  autonomy level, receipt), so dragging a venture through space is decoration over a value
  the surface does not own. It also cannot honour the platform contract — keyboard-first,
  desktop, and a ten-minute clear are all defeated by free spatial manipulation, and the
  primary action is a one-click approve with a receipt, not a drag.

- **ambient assistant (AI present, not dominant)** — rejected on vocabulary and on
  convergence. The council verdict already *is* the machine voice in this product; the human
  is the approval gate on work the machine has already done. A second assistant layer needs
  a product noun outside the closed vocabulary (venture · phase · receipt · council verdict ·
  approval · autonomy level), which the slop kill-list explicitly bans; and once the invented
  noun is stripped, what remains is the approval inbox again — it converges on A and B
  instead of diverging from them.

- **guided workflow (steps, progressive disclosure)** — not absurd, but rejected as a
  duplicate. It collides with **review workspace** on the dimensions that decide this run:
  same primary object (one approval at a time), same primary action, same forward queue
  traversal, same one-decision-in-focus layout. Assigning both would have produced two skins
  of "big card plus queue" — exactly the failure this phase exists to catch. It is the
  strongest reserve: if a Phase 2 reassignment round is ever required, guided workflow is the
  first candidate to swap in for the weak line, since its distinct claim (the clear is a
  *run* with a definite end state, not a browsable list) is untaken by A, B or C.

---

# Phase 2 — the divergence call

Read against the three built `index.html` pages **and** the three renders from the one shared
render command at 1440×900, full-page. The renders are the evidence. Where a composer claimed
a surface stayed "peripheral", the claim was checked against the markup rather than accepted.

## The question this round actually turned on

The shared floor handed to the composers omitted the brief's A.5 always-visible line, so a KPI
row was added to **B** and **C** in round 2, and B additionally gained a compact "Today's
events" list in its rail. A always had both. The live question was therefore whether closing
that VIOLATION quietly collapsed three products into one — precisely the failure named above
under *A vs C*.

It did not, and the reason is structural rather than charitable:

- **A KPI row is not one of the seven dimensions.** It is a floor surface the brief mandates,
  in the same class as the declared contrast pairs. All three honouring it is compliance, not
  convergence. Convergence would mean the KPI row began *doing* something in the product —
  becoming a navigation target, or carrying the decision's evidence. In none of the three
  does it do either.
- **The markup backs the claim.** C's KPI row is a static five-item list with no focus target
  and no key binding, under a comment reading "peripheral, read-only, always visible. Not a
  second dashboard". B's is a compressed five-cell strip below the header. Neither is
  reachable by its own variant's keyboard model.
- **C did not become a three-region dashboard.** C has no approval inbox region at all — the
  word appears once, incidentally. Its address is time ("Position in the day: event 3 of 10 —
  09:02"), it carries settled events that hold no action because they are history rather than
  decisions, and it renders future beats as LOCKED · "not yet disclosed". A's timeline refuses
  that model in its own subtitle: "Read-only · newest at bottom · nothing to step through."
- **B's "Today's events" stayed peripheral in fact.** Three static list items at the foot of
  the rail, no evidence links, no keyboard path. It satisfies A.5 without giving B a time axis.

## Per-dimension verdict

| # | dimension | verdict | why, from the renders |
|---|---|---|---|
| 1 | primary object | **differs materially** | A's rows are all approvals; C's rows include settled history carrying no action at all, because C's unit is an event and not a decision; B's screen holds exactly one approval, named and opened. Three different things are on the screen. |
| 2 | primary action | **converged** | The brief fixes this — approve/reject, receipt recorded. B's four verbs with mandatory reason presets, and C's event-level "Retry capture / Mark settled manually", are ceremony around the same act. This dimension was never available for divergence. |
| 3 | info before action | **differs materially** | A shows seven decisions' evidence shallowly and at once ("Clear", "1 breached"); B shows one decision's kill criteria decomposed into four named criteria with actual-vs-floor-vs-status plus a five-point council-score trend — information A does not contain at any density; C compresses the same facts to one line per beat, ordered by time. |
| 4 | navigation model | **differs materially** | None (selection inside a fixed grid) vs record-to-record (rail ↔ evidence pane, Tab-switched, pane reloads per record) vs chronological position with three time zones — in order · since you left · not yet disclosed. No two are the same model. |
| 5 | progressive-disclosure rule | **differs materially** | A expands in place beneath the selected row, displacing nothing. B inverts it — rail collapsed to identifiers (the round-3 score-leak fix held; no council score in the rail), evidence always deep. C's is temporal: 14:30/16:00/18:00 exist as locked, undisclosed beats, a rule neither A nor B can express because neither has a time axis. |
| 6 | expert path | **converged** | All three are j/k/a/r because the platform contract requires it. B's Tab-plus-presets and C's skim/jump are real gains, but they are consequences of dimensions 1 and 4 rather than independent product choices, so they are not counted as divergence in their own right. |
| 7 | failure/recovery path | **differs materially** | A: the failed row reddens in place and holds its grid position, next step naming an L3 escalation. B: two-level failure — the rail item carries "Evidence failed to load · retry" while the pane retains evidence so the retry needs no re-reading; only a two-level product can fail that way. C: an unresolved beat *gates later beats* — 09:47 sits DISABLED, "Locked — waiting on NeoKirana (09:02) to resolve first". Neither A nor B blocks anything downstream. |

Director call: A/B/C differ materially on 5 of 7 dimensions — the day surface, the single approval opened to evidence depth, and the day traversed in order are three different primary objects reached by three different navigation models, carrying three different disclosure rules and three different failure models, and the KPI rows added in round 2 are a non-interactive floor surface in all three rather than a shared product region.

The call stands. The explore proceeds to blind ranking. No reassignment round is called, and
the `guided workflow` reserve stays unspent.

## Weakest link in the call

**Dimension 3, info before action.** The brief mandates the same three facts on the card in
all three variants, so the difference here is one of granularity and depth rather than of
which facts appear — and it is the dimension a sceptical reader is most likely to dismiss as a
rendering choice rather than a product choice. It survives because B genuinely carries
information the other two do not (four decomposed kill criteria with their floors, the
council-score trend across prior receipts), but it is the thinnest of the five counted. If any
counted dimension is argued down later, this is the one; the call would then rest on 4 of 7 —
still standing, with less room.

## Note carried forward to the blind ranking

Closing the A.5 VIOLATION narrowed the *visual* distance between the three without narrowing
the structural distance: all three now open with a dark header above a horizontal KPI strip.
Blind rankers work from renders, so that shared opening band may read as sameness at a glance.
That is a hazard for the ranking instrument, not evidence of convergence — these products
diverge below the fold, and the ranking should not end up scoring the floor.
