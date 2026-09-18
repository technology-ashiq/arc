# REHEARSAL — money ring

Phase 03, ring 4 of 5 (face v2 Cycle 16, ADR-1328). The flows v0.7 draws in the three PLANNED rooms -- `ops`,
`trader`, `discover` -- whose lanes are not born. A manifest is never invented for an unborn lane, so each flow is
drawn as a REHEARSAL card that writes nothing, and none of them is a work-door verb: nothing here will ever be sent
anywhere until `/arc-kickoff --lane` births the lane and its manifest takes over, in the same change that drops the
REHEARSAL marking (ADR-1328's revisit trigger).

Derived, never typed: `tests/face/module-frame.mjs` folds every money module and requires the rows below to EQUAL
the `rehearsal()` entries the folds return, both ways. The smoke counts the same cards (`data-rehearsal`) in the page
per room, and F3 holds each planned room to its dotted, REHEARSAL marking with no LIVE word anywhere on it.

| module | flow | what it rehearses |
|---|---|---|
| `discover` | Capture a pain | idea.captured, then normalised and de-duplicated: a pain in the customer's own words, refused at capture when it repeats one already held. Rehearsed; the discover lane is not born. |
| `discover` | Score it | The scoring file's four numbers, and a pain with too little distribution hard-flagged before it can reach a shortlist. Rehearsed, and no score is written. |
| `discover` | Send the top two to council | The shortlist is exactly two; the council debates them and you stamp one, and the one-pager comes before a separate venture kickoff. No council is convened from here. |
| `ops` | Raise an incident | incident.raised, then an acknowledgement, then a resolution typed by a person -- an incident is open until someone closes it in words. Rehearsed: the ops lane is not born, so nothing is raised. |
| `ops` | Drop a support file | A dropped message is classified, a template reply is drafted, and your stamp seals it for a person to send. The machine drafts; a person sends. Rehearsed, and never sent. |
| `ops` | Write the weekly ops report | One report a week and a drill, once two ventures are live and support stops being one person. Until then it is rehearsed, and no report is written. |
| `trader` | Open a question | question.opened: a strategy exists to answer a question, never the other way round. Rehearsed on paper; the trader lane is not born. |
| `trader` | Register a strategy in the playground | strategy.registered, exploratory: it can be thrown away without a retro, and it names a paper market only. |
| `trader` | Pin a snapshot and backtest it | A pinned snapshot, a backtest, and the honesty battery -- no lookahead, no survivorship, costs included. Paper numbers, and a failed check keeps a strategy on paper. |
| `trader` | Record a verdict | CONTINUE or DORMANT, each with a typed reason, and thirty paper days before either. No verdict places an order. |

Phase 05's flows harness runs these as REHEARSAL assertions only (ADR-1328): they bind to no receipt kind, because
the kinds they would write belong to lanes that do not exist.
