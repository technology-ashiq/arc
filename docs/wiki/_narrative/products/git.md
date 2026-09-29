<!-- facts: agents=4f53cda1 commands=2e4720f6 docs=4f53cda1 faceRing=785b1405 faceRoom=ee12d4c2 files=4f53cda1 requires=d7a6ddaf scripts=4f53cda1 version=39fe4a40 -->
```tagline
The shipping clerk. It packs your finished work into neat labelled boxes, prepares the paperwork to send
them out, and never puts anything on the truck until you say so.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Making the work is one job. Getting it out
of the building safely is another.

**git is the shipping clerk.** It does not build anything. It takes what is already done and moves it
along, and it has a few strict habits:

```panel big
- **The packer** (`/arc-commit`). Looks at everything that changed, sorts it into piles that belong together, and seals each pile in a box with a clear label on the outside. It never loads the truck.
- **The dispatcher** (`/arc-pr`). Fills in the paperwork that says "these boxes are ready for someone to inspect", and asks you before anything leaves the building.
- **The complaint handler** (`/arc-fix-issue`). Someone reports a fault. This clerk reads the complaint, hunts for the real cause instead of patching what shows, writes a test that catches it, and suggests the label for the box.
- **The delivery driver** (`/arc-ship`). Checks the goods one last time, and only if every check passes, drives them to the public.

The rule they all share: the main shelf (`main`) is never touched directly. Work goes on its own side shelf first.
```

### Why this needs to be a product at all

Without a clerk, the same three slips happen again and again:

| What you lose | What it looks like when it bites | git's answer |
|---|---|---|
| **A readable history** | One giant box marked "stuff", holding five unrelated changes nobody can undo separately. | The packer splits unrelated changes and labels each box in a fixed style. |
| **Control over what goes out** | An assistant pushes work to the world before you have looked at it. | Nothing here pushes on its own. The dispatcher asks for your yes on the exact push each time. |
| **Safe goods on the truck** | Something half-broken gets deployed because "it worked yesterday". | The driver runs the checks in order and stops at the first failure. |

> The second row is the one that matters most. Sending work outward cannot be taken back, so arc keeps
> that decision with you, not with the assistant.

## arc words → normal words

```lede
Nine pieces of arc jargon. Each is an ordinary shop-floor thing wearing a technical name.
```

```rosetta
commit | one sealed, labelled box of changes | the unit of saved work
conventional commit | a label in a fixed style: `feat:`, `fix:`, `docs:` and so on | so anyone can read the history at a glance
branch | a side shelf for work in progress | keeps `main` clean
`main` | the master shelf everyone trusts | never written directly
push | putting the box on the truck to leave the building | always needs your explicit yes
PR (pull request) | the paperwork asking for an inspection before goods join `main` | opened by `/arc-pr`
deploy | delivering the goods to the public | the last thing `/arc-ship` does
receipt / the spine | one line in arc's logbook saying "this happened" | `/arc-commit` and `/arc-ship` each write one
proposal branch | a side shelf a machine writes for you to accept or refuse | the machine never edits `main` itself
```

## How a job flows

```lede
Most days the road is short: pack, then dispatch. Shipping is its own road, and it has stops where it
refuses to go on.
```

```flow
source: work on a side shelf
box: ① Pack | /arc-commit
box: ② Ask to send | /arc-pr
box*: ③ You inspect | you merge
box: ④ Ship | /arc-ship
labels: boxed, approved, checked
out: mixed pile | split into separate boxes
out: on main | stop, move to a side shelf
out: no yes from you | nothing is pushed
out: a check fails | stop, nothing delivered
divider: 3 | reversible | irreversible
note: Sending outward cannot be undone, so the yes at the dashed line is always yours.
caption: Figure 1 — from finished work to delivered work. | The dashed line marks where things stop being easy to take back.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: The packer seals the boxes
plain: It looks at exactly what changed before anything else, so it never packs blind. If two changes have nothing to do with each other, they go in separate boxes.
d: Reads the status and the diff, stages explicit paths rather than everything at once when stray files are lying around, writes a conventional message (short, imperative, explaining why), commits, and does not push. Then it leaves a `commit.done` receipt.
f: `.claude/commands/arc-commit.md`

t: The dispatcher asks first
plain: It checks you are not on the master shelf and that everything is boxed. Then it stops and asks you to approve the push, by name, before it does anything.
d: Summarises the branch against `main`, asks for approval of the exact `git push -u origin <branch>`, then opens the pull request with a short title, a summary and a test plan, and replies with the link only.
f: `.claude/commands/arc-pr.md`

t: The complaint handler finds the real cause
plain: It reads the reported problem, looks for the root cause rather than the symptom, and proves it with a test that fails first and then passes.
d: Reads the issue, finds the root cause, writes a failing test, makes it pass, runs the test suite and the linter, then proposes a commit message. It does not push.
f: `.claude/commands/arc-fix-issue.md`

t: The driver checks, then delivers
plain: Three checks in a row: tidy, builds, tests. The first one that fails stops the whole trip, and you see the error.
d: Runs lint, build and test in that order, deploys only if all pass, records a `ship.done` receipt, and replies with the address and a one-line summary.
f: `.claude/commands/arc-ship.md`
```

# The bigger loop

## Why main is never written directly

```lede
The same rule is written down three times, at three levels, so it survives a tired session.
```

1. **In the house rules.** Work happens on a branch, and a pull request is opened for it. A commit never
   lands straight on `main`. Before every commit the session must check which branch it is on, and if the
   answer is `main`, stop and move the work to a `feat/*` branch (`CLAUDE.md`).
2. **In what each command may run.** The packer's permission list has status, diff, log, add and commit and
   the logbook script. There is no push in it anywhere. The dispatcher may only look and open the request,
   and it asks before the push.
3. **In arc's own tooling.** When a tool has to change a file with nobody typing, it does not touch `main`.
   It writes a brand-new side branch based on `main` as it stood when the edit was read, and it cannot
   check out, merge, push or reset anything. A human accepts that branch or does not
   (`.claude/scripts/core/proposal-branch.mjs`).

Underneath all three sits the company constitution: an irreversible action, such as publishing under the
owner's name, belongs to the human alone, however much freedom a session otherwise has (`CONSTITUTION.md`).

## The logbook

The packer and the driver each write one line to arc's logbook, the spine, so that later anyone can prove
the commit or the ship really happened. The book is append-only: nothing is edited or deleted, and a
correction is only ever a new line that replaces the old one (ADR-0029). Every line is filed under one
fixed name from a closed list (ADR-0026). `/arc-commit` writes `commit.done` and `/arc-ship` writes
`ship.done`.

## Who does the commit wording

The commit-message job is one of the commands arc builds from a single job description, and the engine
staffs it at the balanced tier: steady, structured production inside a frame someone else already set
(ADR-0069). That is why the file at the top of `arc-commit.md` warns that hand edits are thrown away the next
time it is rebuilt.

## Where git sits in arc

- **Under everything.** It only needs `core`, nothing else in arc, so it can be installed on its own.
- **After qa and review.** `/arc-ship` is where the goods that passed those checks finally leave the
  building.
- **In the face.** git lives in the review-and-ship room. The chips at the top of this page name the room
  and the ring.

# Meta

## Glossary

```gloss
conventional commit: a commit message that starts with a fixed word (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) so the history reads like a tidy ledger.
diff: the list of exactly what changed between two versions.
lint: an automatic tidiness check on the code.
deploy: making the new version live for real visitors.
append-only: a record you can add to but never rewrite.
```
