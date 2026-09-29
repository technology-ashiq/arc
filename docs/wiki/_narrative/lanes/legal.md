<!-- facts: appetite=cefdf849 blocked-on=a68c9074 burn=cffcdb64 cycle=1d67b294 depends-on=a68c9074 hasPlan=b5bea41b phase=8875c0e8 status=8ddd7aee title=d25ea005 -->
```tagline
The shop-window paperwork for every venture arc builds: terms, privacy, refunds and the rest. Written
from real facts, checked by fixed tests, and published only when a person signs.
```

# Start here

## In plain words

Think of arc as a company that will open shops. Before a payment provider lets a shop take money, it
asks: where are your terms, your privacy notice, your refund rules? A shop with none of these is
turned away at the door. A shop with invented ones is worse off, because a wrong legal promise is
still a promise.

**The legal lane is the sign-writer.** You give it one facts file per shop: the real business
facts. It writes the policy pages from those facts, and only those.

```panel big
**The sign-writer never invents and never hangs a sign alone.** Every line on a page comes from a fact you stated. Every page is checked by tests that read the finished text. And putting the pages live is always a person's decision, made through the approval inbox. The plan says it plainly: not legal advice, a template engine with receipts, not a lawyer.
```

### What this lane is for

Its goal, from its plan (`initiatives/legal/PLAN.md`), is a command that turns a facts file plus one
pinned set of templates into seven policy pages and a launch checklist. The plan names the command
`arc-legal`, and the code for it is `.claude/scripts/legal/arc-legal.mjs`. The aim is that no venture
ever publishes an invented legal claim, and none is stuck at a provider's policy-pages gate.

The seven pages are terms, privacy, refund and cancellation, shipping and delivery, contact, pricing,
and about. Seven, not six: the plan checked the provider's own documentation and found the real list
was longer than the design note had assumed (ADR-1201).

### Why the first phase was so careful

The lane was opened with a hard five-day appetite (its time budget), and phase 00 was a thin
"steel thread": three pages, start to finish, before building the rest. Then fresh reviewers were
sent at the finished text, not at the code. They found a page that listed other people's records
and promised nothing about them. That is the reason the checks read what a customer would read.

## arc words → normal words

```lede
Eight pieces of arc jargon. Each is an ordinary sign-writing thing wearing a technical name.
```

```rosetta
facts file | the shop's fact sheet | one file per venture; every clause is drawn from it
clause | one pre-approved paragraph | switched on only when the facts call for it
template set | the sign-writer's kit | versioned; a venture pins the version it is approved against
lint | a proofreader with one job | reads the finished page, not the code
receipt | a stamp on the sign | ties the exact wording to the facts and to the person's approval
hash chain | stamps that must match in order | facts, then pages, then template kit; any mismatch is refused
launch checklist | the walk round the real shop | checks the live site, and a row may say NOT-CHECKED
payment_model | who takes the money | a fact that switches whole paragraphs; a third value, none, was added for LexOS (ADR-1211)
```

## How one set of pages is made

```lede
Facts go in, seven pages come out, proofreaders read the result, and a person signs before anything
goes live.
```

```flow
source: facts file + pinned template set
box: ① Render | pages from facts only
box: ② Proofread | four lints on the text
box*: ③ Receipt | the wording is stamped
box: ④ Ask a person | via the approval inbox
labels: pages, checked, stamped
out: bad facts | refused with a reason
out: lint fails | stopped, page not shown
out: -
out+: signed | pages go into the venture
divider: 3 | nothing leaves arc | a person decides
note: Publishing stays human. The lane adds no new kinds of event to arc's log (ADR-1203).
caption: Figure 1 — one venture, facts to signed pages. | The dashed line is where a person has to say yes.
```

## The stages, one by one

```lede
Each stage is written twice: first in ordinary words, then what actually happens.
```

```steps
t: Read the facts safely
plain: The fact sheet is read by a strict reader that refuses anything odd, and turned into one fixed form so the same facts always give the same result. Anything it cannot represent exactly is refused, never guessed.
d: A bounded YAML parser and a canonicaliser (ADR-1204). Facts are sorted into three risk tiers, and free text is allowed only where unavoidable (ADR-1202).
f: `.claude/scripts/legal/arc-legal.mjs`

t: Write the pages
plain: The fact sheet switches paragraphs on and off. Whole branches follow from a choice such as who takes the payment. The same facts always produce the same words.
d: Templates and data files live under the product; a venture pins one set by name.
f: `products/legal/manifest.json`

t: Proofread the finished text
plain: Four proofreaders read each page. One checks that no stray badge or markup rode in on a free-text answer. One checks every paragraph traces back to a real fact. One checks nothing required is missing. The fourth compares two pages of the same venture with each other.
d: Value, trace, completeness and consistency lints. The fourth exists because the worst defects sat between pages, not on them (ADR-1213).
f: `tests/legal-lints.bats`, `tests/legal-consistency.bats`

t: Stamp and ask
plain: The exact wording is stamped, and a person is asked to approve exactly those words. If the facts or the pages change after approval, the stamps no longer match and publishing is refused.
d: Receipts attest to the bytes and the hash preimage carries its own version (ADR-1204). The approval rides the existing strict profile (ADR-1203).
f: `.claude/scripts/legal/publish-gate.mjs`
```

# The bigger loop

## A venture, as a story

```loop
top: 1 | a new venture
top: 5 | live pages
stage: 1 · Facts are written | real values only
stage: 2 · Pages are rendered | seven of them
stage: 3 · Proofreaders run | four lints
stage*: 4 · A person is asked | reads the exact words
stage!: 5 · Signed | drift is caught later
labels: facts, pages, verdict, signature
back: last -> 1 | a change to the facts starts the loop again
caption: Figure 2 — the life of one venture's pages. | A change after signing needs a new signature.
```

1. A shop owner states the real facts: how they get paid, what the refund window is, where the grievance mailbox is.
2. The lane renders the seven pages.
3. The four proofreaders read the text and stop on anything unsound.
4. A person reads the pages and approves or rejects, and gives a reason.
5. Later, a check re-renders the committed pages and reports if they drifted.

*This story is an illustration of how the loop runs. It is not a real venture.*

## Where it stands

The live numbers (phase, burn, blockers) are in the generated sections from `initiatives/legal/PROGRESS.md`.
In words, as that tracker records it: phase 00 is closed. Its evidence bundle is
`initiatives/legal/evidence/phase-00/bundle.md`. The seven pages, four lints and scenario fixtures
are built, and a fourth lint was added that no plan had predicted.

The tracker also states an honest gap. Its own closing notes list the receipts and approval half,
the drift check (`--verify`), per-venture template pinning and the real LexOS render as still to do,
and say the receipts half had not been built at the time it was written. The code has since gained
propose and publish steps, so the tracker may lag the code. Check the tracker before quoting a phase.

What waits on the owner: the real render for LexOS, the first venture to go through the whole
path, needs one answer. Is the operator registered for GST? Both answers are already built and tested.

## What next

1. Check the tracker against the code and bring it up to date.
2. Per-venture template pinning, so one venture can stay on an older kit while another moves.
3. A drift check that runs inside the venture's own repository, generated from the same comparison code, never hand-copied.
4. The real LexOS render, once the GST answer is given.
