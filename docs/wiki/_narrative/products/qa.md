<!-- facts: agents=bc6c920b commands=5dd5d3c8 docs=4f53cda1 faceRing=785b1405 faceRoom=ee12d4c2 files=4f53cda1 requires=d7a6ddaf scripts=4f53cda1 version=39fe4a40 -->
```tagline
The people who use the thing before a customer does. They open the real app, press the real buttons,
fix what breaks with a test that keeps it fixed, and watch production after every deploy.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Some of them write code, some review it,
some plan the next piece of work.

Most of that staff works on **paper**. A reviewer reads the diff. A planner reads the plan. Nobody in
those rooms ever opens the app and presses a button.

```panel big
**qa is the department that does press the buttons.** It has three people:

- **A mystery shopper** (`qa-tester`). They open the running app in a real browser and use it like a customer would: sign up, fill the form, press back halfway through, type an emoji into the name field. Then they write down exactly what happened. Not what *should* have happened. What happened.
- **A shop-window designer** (`design-reviewer`). They look at a screen, give it marks out of ten on things like spacing, colour and readability, and then, unlike a critic, pick up the tools and fix it themselves.
- **A night watchman** (`/arc-canary`). After you open the doors, which means deploying to production, they walk the shop floor every couple of minutes for a while. If something breaks, they don't just ring a bell. They take the new version back down.

That is the whole product. Everything below is how those three do their jobs without lying about what they saw.
```

### Why this needs to be a product at all

If the only checks were people reading the code, three things would quietly go wrong, and each one is
expensive:

| What you lose | What it looks like when it bites | qa's answer |
|---|---|---|
| **Knowing the app actually works** | Every test passes, the review is clean, and the sign-up button does nothing on a real phone. | The mystery shopper uses the real app in a real browser, and may report only what they saw. |
| **Knowing a bug stays fixed** | A bug gets fixed, and three weeks later the same bug is back, because nothing was watching that spot. | A bug does not count as fixed unless the fix comes with a test that fails before it and passes after. |
| **Knowing the release is healthy** | A bad deploy keeps serving every visitor until someone happens to notice. | The night watchman compares production with the last good version, and rolls back or blocks the release. |

> The second row is the one most tools skip. A bug list tells you what was wrong today. A tripwire test
> left at the exact spot is what stops the same bug coming back next month.

## arc words → normal words

```lede
Thirteen pieces of arc jargon. Each is an ordinary shop-floor thing wearing a technical name.
```

```rosetta
`qa-tester` | the mystery shopper | the only one who opens the real app
`design-reviewer` | the shop-window designer | scores the screen, then fixes it
`/arc-canary` | the night watchman | watches production right after a deploy
`/arc-qa` | "send in the shopper, then fix what they found" | the main loop of this product
`/arc-design` | "send in the designer" | the design loop
flow | one thing a user does, start to finish | e.g. "sign up"; the unit the shopper tests
BUG vs BLOCKED | "the app is wrong" vs "I couldn't even test it" | the shopper must never mix these up
regression test | a tripwire at the exact spot a bug was | proves the bug can't quietly come back
atomic commit | one fix = one saved change | so any single fix can be undone on its own
baseline | a photo and measurements of the last good version | what the watchman compares against
ledger stamp | a tick in the register: "qa was done on this code" | `/arc-ship` checks the register
receipt | one line in arc's logbook, `qa.completed` | so later you can prove it happened
`--report-only` | "just look, don't touch" | the shopper reports; nobody fixes anything
```

## How a job flows

```lede
The shopper looks first, and looking is free. Only after the report does anyone touch code, and every
fix has to bring its own tripwire test.
```

```flow
source: /arc-qa [page or flow]
box: ① Shopper goes in | real browser, real app
box: ② Fix each bug | one commit + one test
box: ③ Check again | only the fixed flows
box*: ④ Paperwork | report · stamp · logbook
labels: bugs, fixed, green
out: --report-only | stops here, nothing fixed
out: no test | not counted as fixed
out: still red | back to step ②
out+: qa.completed | one line in the logbook
divider: 1 | only looks | changes code
note: Nothing is ever pushed. The report, the fixes and the stamp wait for you.
caption: Figure 1 — one /arc-qa run. | The dashed red line is where looking stops and code starts changing.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: The mystery shopper goes in
plain: They start the app if it isn't running and take the list of flows, from you or from the current phase's exit criteria. One iron law: never mark a flow done that they didn't actually complete.
d: In order: the happy path (and check the result where it matters, e.g. the saved thing is really there afterwards); the sad paths (wrong input, empty submit, double-click, back or refresh mid-flow, a logged-in page while logged out); the edges (zero, one, many, the maximum, very long text, emoji); quick tours (money, landmarks, garbage input); accessibility; loading speed.
f: `.claude/agents/qa-tester.md` · drives `agent-browser`, falls back to Playwright and says so

t: Every BUG becomes one commit with its own tripwire
plain: A BLOCKED flow is a problem with the test setup, so there is nothing in the app to fix. A BUG is fixed on its own, and the fix must bring a test that fails before it and passes after. No test, not fixed.
d: One bug, one atomic commit named `fix(qa): …`. This is the rule that makes arc's QA more than a bug list.
f: `.claude/commands/arc-qa.md` step 2

t: The shopper checks the fixed flows again
plain: Only the flows that were fixed, to confirm they are green now.
d: The same agent, sent back in on those flows.
f: `.claude/commands/arc-qa.md` step 3

t: The paperwork
plain: A report goes on file, the phase tracker is told the outcome, the register gets its tick, and the logbook gets one line saying how many bugs were found and fixed.
d: The report lands in docs/qa with flows, bugs, fixes and their commits, tests added and screenshots. The ledger is stamped `qa` (not with `--report-only`), and a `qa.completed` receipt is written. Nothing is pushed.
f: `.claude/commands/arc-qa.md` · "Always finish by"
```

The shopper's report always has the same shape: which browser tool was used, a table with every flow
marked ✅ worked, ❌ the app is wrong, or ⛔ couldn't test, exact repro steps with a screenshot for every
failure, and one verdict line: **demo-ready** or **not ready**, with one reason.

# The bigger loop

## The design loop

```lede
Same idea, a different expert: score the screen, name the one change that matters most, then make it.
```

`/arc-design` sends in the designer. They mark the screen on eight things, each out of ten, and say what
a ten would look like:

| Dimension | The question it asks |
|---|---|
| Visual hierarchy | Does your eye land on the right thing first? |
| Typography | Sizes, line length, weight: does the text read comfortably? |
| Spacing and alignment | Consistent gaps, nothing cramped or floating? |
| Colour and contrast | Colour used on purpose, and readable (WCAG AA)? |
| Consistency | Reuses the design system, no one-off pieces? |
| States | Hover, focus, disabled, loading, empty, error: all designed? |
| Responsiveness | Really reflows on a phone, touch targets at least 44px? |
| Motion | Fast, purposeful, respects "reduce motion"? |

They also hunt **AI slop**, the look of a screen nobody designed: a generic gradient hero, three
identical cards in a row, emoji used as icons, everything centred, the default purple-on-white,
placeholder text, shadows on everything, pale grey text you can't read.

Then they fix it in code, with the project's own design tokens. Each coherent fix is one commit, and a
before and after screenshot is saved. The verdict is `design: PASS` only if nothing critical is left;
otherwise `design: NEEDS-WORK` with the list of what blocks it. The register gets its `design` tick
**only** on a PASS.

```panel warn
title: one honest caveat
A reviewer who scores their own fixes is marking their own homework. arc's rules call that self-approval (ADR-0034), so the design lane built a separate critic that can read but cannot edit anything. The old designer still runs behind `/arc-design` while the replacement proves itself; retiring it waits on the owner's decision (ADR-0042).
```

## The night watch

```lede
After a deploy, someone keeps walking the floor. If the new version is worse than the last good one,
it is taken down; nobody has to notice first.
```

```flow
source: /arc-canary <production address>
box: Deploy lands | a new version is live
box: Walk the floor | every ~2 minutes, ~10 min
box: Compare | with the last good version
box*: Money flows | login, checkout
labels: watch, measure, then
out: -
out: -
out: regression | roll back or block
out+: green window | baseline refreshed
caption: Figure 2 — the night watch. | One owner per job: the shopper owns the money flows; the watchman owns errors, speed and pictures.
```

On every walk the watchman checks each key page, locked to your own domain so it can't wander off:
crashes in the page's code, errors in the browser console, failed requests (any 5xx on a key page
counts), loading speed, and a screenshot compared with the last good one.

**What counts as a regression:** a new crash or console error · any 5xx on a key page · speed falling
off a cliff (LCP or INP more than 1.5 times the baseline, or layout shift worse by more than 0.1) · a
large visual difference.

**The arc twist:** a failed canary *acts*. It rolls the deploy back, or blocks the release, and writes an
incident note saying what broke, the evidence, and what it did. A green window refreshes the baseline,
so the next deploy is compared with today. A phase that deploys can't be marked done without a green
canary.

## Life of a bug

```lede
One bug, from being found to being shut for good, and the day months later when it tries to come back.
```

```loop
top: 1 | the shopper
top: 5 | the tripwire
stage: 1 · Found | Save pressed twice, two records
stage: 2 · Reported | steps + screenshot
stage*: 3 · Fixed | code + a tripwire test
stage: 4 · Checked | the flow is green
stage!: 5 · Months later | a refactor brings it back
labels: report, fix, re-check, time
back: last -> 3 | the test goes red before it ships
caption: Figure 3 — the life of a bug. | The loop back is the whole reason the test is not optional.
```

1. The mystery shopper presses **Save** twice on the settings page. Two copies of the record appear.
2. The report says: *settings, double-submit, ❌, two records created*, with the steps and a screenshot.
3. The fix disables the button while saving. In the same commit goes a test that clicks twice and expects
   one record. It fails on the old code and passes on the new.
4. The shopper goes back in, only on that flow: ✅.
5. The report names the commit and the test. The register gets its `qa` tick, and the logbook gets
   *qa.completed, 1 bug, 1 fixed*.
6. Months later someone reworks the settings page and the double-save comes back. The tripwire test goes
   red before it ever ships. **That** is why the test is not optional.

*The settings-page bug is an illustration of how the loop runs, not a real incident.*

## Where qa sits in arc

- **Closing a phase.** `/arc-phase-done` needs a live demo, proof that the thing works when someone uses
  it and not only when it is tested. The mystery shopper is who provides that proof.
- **Shipping.** `/arc-ship` checks the register. For a phase with a screen, add `design` to
  `ARC_REQUIRED_REVIEWS` and shipping waits until the designer has stamped a PASS.
- **In the face.** qa lives in the review-and-ship room, where finished work gets checked and sent out.
  The chips at the top of this page name the room and the ring.

# Meta

## Glossary

```gloss
Core Web Vitals: Google's loading-speed numbers. LCP is how fast the main thing appears, CLS is how much the page jumps around, INP is how fast it reacts to a tap, and TTFB is how fast the server answers.
WCAG 2.1 AA: the accessibility bar most sites are held to.
axe-core: a free tool that scans a page for accessibility problems automatically. When a project doesn't have it, the scan is marked SKIPPED, never faked.
agent-browser: the command-line browser the agents drive. Playwright is the backup, and the report says when it was used.
5xx: the server's own error codes, meaning "something broke on our side".
regression: something that used to work and now doesn't.
```
