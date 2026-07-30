# Ranking — juror 1

- ranked: variant-b > variant-a > variant-c

## Why variant-b over variant-a

The case name is the first thing on the page in b; in a, the very top of the render is a
grey explanatory caption about the board's width token, sitting above the case name and
parties. The brief's one-sentence job is "opens a case and knows, without hunting, what has
happened on it" — b's header (name, O.S. number, court, client, claim, then status/next
hearing/overdue) delivers that in the first glance, a delivers a design annotation first.

b answers both named debts with a stated reason on the page itself. The width debt gets an
explicit "Measure note" callout naming the 56rem choice and why the actions panel is dropped
for this route. The actions-panel debt is dissolved outright: one "+ Add entry" button plus
per-row "Edit" / "Remove ___ — cannot be undone" links, replacing the four-identical-buttons
problem the brief names verbatim. a solves the same debt well (one Add button per section
card) but a's width answer — dropping max-w-shell to a 96rem board — reopens the tension the
brief flags at item 5: hearing history, documents, tasks and notes are declared "on demand,"
and a makes all four always-visible at once rather than reached.

b's destructive-language and status-badge handling matches the content contract closest to
word-for-word: "Remove document — cannot be undone" (never a bare Confirm), object-type pills
(Hearing/Document/Task/Note) carrying meaning in text before any colour does, and the
highlighted "Held 14 Jul 2026 · Unrecorded · Record outcome" row demonstrates the primary
action (record what happened, see next-due recompute) directly in place — exactly item 6's
success behaviour. a demonstrates the same content rules cleanly across four parallel cards
but without that in-context "why this needs your attention" tie-in.

Both show a thorough five-state reference block; b's "records-first instrument" framing (a
chronological ledger with month groupings, a "new since last opened" marker, and a
jump-to-next-due link) reads as the closer match to the brief's own art-direction language for
this system than a's four-column board, which is calmer to scan but denser at first glance.

## Why variant-a over variant-c

a keeps every product noun the brief requires — hearings, documents, tasks, notes — visibly
present with real rows, counts, and a single relevant add action per section. c's main view
only ever shows hearing and document content; nothing on the page names or lists a task or a
note (the two collapsed accordions "Full hearing history" and "Recent record" might contain
them, but that is not visible in this render, and a case-workspace brief that lists "task" and
"note" as product nouns is not honoured by a page where neither object is ever seen).

a's keyboard reference answers both halves of the expert-path requirement in item 7: number
keys to jump between sections, and "n" to "show the next case due this week" — the exact
capability the brief says does not exist yet. c's keyboard list only fires the current step
and steps forward/back through a locked sequence; there is no way shown to reach another case,
and no way to reach a section out of order.

c does not visibly resolve the width debt the brief names — the wizard content sits in a
narrow-ish column with a large unused margin on the right of a 1440-wide canvas, without any
on-page rationale, the same shape of problem the brief describes, just uncommented. a and b
both state and defend a width decision on the page itself.

c's step-locking ("Cannot add the next hearing until…", "Cannot determine which documents are
due until…") is a genuinely disciplined reading of "advance the case" as a forced sequence,
and it does keep status/next-hearing/overdue visible above the fold before any action — but
the repeated "Cannot…" blocking language reads closer to the anti-word "chatty" than the
brief's "unhurried," where b and a both state disabled reasons in a single flat sentence.

## What would change my mind

a is the only variant whose keyboard reference names a way to move to "the next case due this
week" without the mouse — the exact gap the brief calls out in item 7 as not existing yet in
the shipped product. b's keyboard set is thorough within one case's record (next-due entry,
filter cycling, unread marker) but never shows a way to leave the case for another one due
soon. If b's reference block had that same cross-case shortcut, its lead over a would be much
harder to argue against; as it stands, that single capability is the strongest thing a has
that the winner lacks.
