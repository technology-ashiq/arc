# A decision surface must carry every fact the decision needs on the row itself

- type: Pattern
- domain: solo-operator venture dashboard
- user: owner clearing a daily decision queue under time pressure
- platform: desktop, keyboard-first
- problem: reviewing a queue of pending decisions without opening each one to find out what it is
- confidence: medium
- outcome: the variant that hid the triad finished last on all three independent ballots
- source: arc explore run `hq-dashboard-v1`; jurors 1–3 (`docs/design/explore/hq-dashboard-v1/ranking-{1,2,3}.md`), unanimous variant-a > variant-c > variant-b

## Principle

When the job is *clear the queue*, the cost that matters is not how good any single detail view
is — it is how many items the user must open before they can decide anything. A row that shows
a name and an amount forces one click per item just to learn whether the item is interesting.
Multiply that by the queue length and the surface has quietly converted a scanning task into a
navigation task.

The transferable rule: identify the smallest set of facts the decision actually turns on, and
put all of them on every row at once. Everything else — evidence, history, the reasoning behind
a threshold — belongs to on-demand disclosure. The split is not "important vs unimportant", it
is "needed to triage vs needed to act".

This showed up as the single clearest separator in a three-way comparison. The losing variant
was not ugly and not wrong; it was calm, factual and well made, and it showed the full triad
for exactly one item at a time. Three jurors reaching independently for different vocabulary
all landed on the same gap.

## Do not copy

Do not lift the specific triad (verdict, amount, kill-criteria state) — that set belongs to
this product's decision, and it was chosen by the brief, not discovered here. On a different
surface the triad is a different three things, and it may be two or five. Copying the columns
instead of re-deriving them is how a dashboard ends up displaying facts nobody uses while the
one that matters stays behind a click.
