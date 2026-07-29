# IA-difference matrix — explore `hq-dashboard-v1`

> Written at **assignment time**, before any variant is composed. This is the contract the
> composers build against, not a description written after the fact. Brief:
> `docs/design/briefs/docs--strategy--arc-hq-mockup-html/brief.md` · base `7d42c2d` ·
> isolation: route-namespace fallback (ADR-0037), all three variants side by side in this dir.
>
> The `Director call:` line is **deliberately absent** until Phase 2 — it is appended only
> after all three variants exist and have been re-read against this table. `design-explore
> check` will fail on `director-call-missing` until then; that failure is the correct state
> of a run that has been assigned but not yet composed.

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
