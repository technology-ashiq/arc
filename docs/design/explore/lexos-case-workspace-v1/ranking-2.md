# Ranking — juror 2

- ranked: variant-c > variant-b > variant-a

## Why variant-c over variant-b

Both surface the blocking fact identically at the very top — "Waiting on: Hearing held 14
Jul 2026 · outcome not recorded" in c, "AHEAD — Next hearing — Not set. This is why the case
needs advancing." in b — so neither makes the lawyer hunt for what's overdue, that's a genuine
tie. Past that point c pulls ahead:

- c's whole page IS the primary action the brief names — "advance the case: record what just
  happened... and set what is due next" — built as a literal Step 1/2/3 (Hearing outcome →
  Next hearing → Documents), Step 1 live with a single "Record hearing outcome" button, Steps
  2 and 3 visibly disabled with the reason stated inline ("Cannot add the next hearing until
  the 14 Jul 2026 outcome is recorded"). b's primary CTA is a generic "Add entry"; the specific
  record-outcome action exists too, but it's one highlighted row inside a longer mixed stream,
  not the shape of the whole page.
- The brief is explicit that full hearing history, the document list, the task list and the
  notes are on demand, not always visible. c is the only variant that actually collapses them
  — "+ Full hearing history" and "+ Recent record" sit closed by default, only the current
  blocking step is open. b's current-month group ships fully expanded (two documents, a task,
  two notes, a hearing, all visible with no click), with only the older May group collapsed —
  real progressive disclosure exists as a mechanism (the "Show: All / Hearings / Documents /
  Tasks / Notes" filter, the collapse toggle) but the default view still shows the on-demand
  content up front.
- c is the only one of the three that builds the specific expert-path gap the brief names —
  going from "this case is done for today" to the next case that needs him — and shows it
  working: "once a run reaches this end state, the same Enter key advances to the next case
  awaiting action: Vishnu Menon v. Ashirvad Developers, next hearing 04 Aug 2026, 0 overdue."
  b's keyboard list (j/k/n/s/f) has nothing that crosses from one case to another.

This is not a wide gap — b's destructive-language handling and content-contract precision (see
below) are genuinely strong, strong enough that on a different weighting b could lead. But
section A of the brief is titled "interaction model" and is the longest, most detailed section;
c wins more of its numbered points more directly than b does.

## Why variant-b over variant-a

- b states the blocking fact in plain sentences at the top of the page. a instead flags it as
  a single red word — "Outcome not recorded" — inside the Hearings column, which a lawyer only
  reads once they've scanned into that specific column; the brief's own line is "a lawyer
  deciding what to do next cannot be made to open a tab to learn the case is overdue," and while
  a's board technically has no tabs to open, it still buries the fact rather than headlining it.
- b's destructive-action language reads "Remove document — cannot be undone," "Remove task —
  cannot be undone," "Remove note — cannot be undone," each in a colour visibly distinct from
  the neutral "Edit" beside it — this is close to a word-for-word match of the brief's named
  rule about destructive links never reading like a benign one nearby. a's board shows no
  remove affordance anywhere to compare against that rule.
- a's four columns (Hearings, Documents, Tasks, Notes) are open and complete at all times, with
  no collapse or filter control visible anywhere on the page — every one of the four content
  types the brief marks "on demand" is instead always-visible in a's board. b at least has a
  working filter and collapses its older month group, even if the current month still ships
  open.

Where a pulls ahead of b: a's reference section documents all five states (empty/loading/
error/success/disabled) for all four named sections plus the header — the most complete state-
matrix coverage of the three — while b only documents header and "period." a also states its
return behaviour explicitly ("returning to this case focuses the ledger carrying the overdue
count — Tasks, here"), where b never says what happens on return. Those are real strengths, but
they sit lower in the brief's own ordering (state matrix is in the art-direction section;
return behaviour is one of seven interaction-model points, and a loses more of the others) than
the points b wins.

## What would change my mind

a's state-matrix reference is the strongest thing either loser does that the winner doesn't
show: all four sections (hearings, documents, tasks, notes), five states each, fully rendered
and labelled — c only shows two surfaces (case header, "a step"). c's "+ Recent record"
accordion is collapsed in the render, so I cannot see whether it carries equivalent state
coverage for documents/tasks/notes once opened. If it turns out that content isn't there —
if c's on-demand areas are thinner than a's always-visible ones once you actually open them —
that gap would be enough to move c down.
