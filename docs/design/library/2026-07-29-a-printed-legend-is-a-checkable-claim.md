# A printed keyboard legend is a claim the interface makes about itself, and it can be checked

- type: Craft
- domain: solo-operator venture dashboard
- user: expert user learning the fast path
- platform: desktop, keyboard-first
- problem: teaching a keyboard-first surface without the legend itself becoming the thing that misleads
- confidence: high
- outcome: caught by two independent jurors; three rounds of contract critique had passed over it
- source: arc explore run `hq-dashboard-v1`; jurors 2 and 3 (`docs/design/explore/hq-dashboard-v1/ranking-{2,3}.md`) — variant-b's legend printed `j k rail` for moving between queue items and, on the same line, `k` for kill

## Principle

A keyboard legend is not decoration and not documentation. It is the interface asserting a
mapping, in public, in a place the user will trust before they trust anything else on the
screen. That makes it uniquely damaging when wrong: the user's first deliberate keystroke is
the one the legend taught them, and a destructive action sharing a letter with a navigation
action is the worst possible collision to learn by discovering.

The concrete defect: the same key printed twice, once for moving through a list and once for
killing an item. Nothing about the visual design flagged it, because visually it is a tidy row
of small type.

The transferable rule, and the reason this entry is `high` confidence on one observation: a
printed legend is *machine-checkable*. Every binding it claims can be extracted and tested for
uniqueness, and destructive bindings can be required to sit outside the navigation set. This is
a property most craft details do not have. Where a surface publishes its own contract in a
structured way, check it mechanically instead of trusting review to catch it.

## Do not copy

Do not take `j`/`k` as the navigation pair to standardise on — that convention comes from
elsewhere and carries its own baggage. And do not read "two jurors caught it" as evidence that
human review is sufficient here; the opposite is the lesson. Three rounds of contract critique
had already passed over the same legend, and it surfaced only because two more pairs of eyes
happened to read the small type. What must not be copied is the reliance on someone noticing.
