<!-- facts: agents=bea0dfb1 commands=84990f7e docs=4f53cda1 faceRing=785b1405 faceRoom=ee12d4c2 files=4f53cda1 requires=d7a6ddaf scripts=f4973c7e version=39fe4a40 -->
```tagline
The security desk and the sign-off book. Machines scan every change, a careful reviewer reads it, and
nothing leaves the building until each check is stamped for that exact version.
```

# Start here

## In plain words

Think of arc as a small company whose staff are AI models. Every so often that staff finishes a piece of
work and wants to send it out the door.

**review is the security desk at that door.** It does not build anything. Its only job is to ask, before
work leaves: was this checked, by whom, and does the proof match *this* version of the work?

```panel big
review has three kinds of checker and one book:

- **A metal detector** (`arc-scan`). A script that runs every scanner it can find over the files you changed and merges what they find into one report. It is free, fast and never gets tired, but it only knows patterns.
- **A careful inspector** (`code-reviewer`). An AI reviewer that reads the change in its own quiet room, looks at the code around it, and answers one thing: ship it, fix it first, or let's talk.
- **A specialist for risky goods** (`security-auditor`). Called in only for sensitive changes: logins, payments, the API, the database. It does not repeat what the metal detector already did. It thinks like a burglar.
- **The sign-off book** (the review ledger). Each check that passes gets a stamp, and the stamp is written against one exact version of the work. Change the work, and every stamp is wiped.

The book itself lives in the `core` product. review is what fills it.
```

### Why this needs to be a product at all

Without a desk like this, three things go wrong quietly.

| What you lose | What it looks like when it bites | review's answer |
|---|---|---|
| **Checks that really stop things** | The rules exist, but they only warn, and the list of required checks is empty, so nothing ever blocks a release. | Checks block by default. Loosening them is a visible setting, never a silent default (ADR-0008). |
| **A scanner people can live with** | On day one the scanner reports a mountain of old problems, so the team switches it off just to get work done. | Old problems are frozen into a list once. Only **new** problems can block (ADR-0002). |
| **One language for every tool** | Ten scanners mean ten report styles, and every later step has to understand all of them. | Every tool is translated into one shared report shape before anything else happens (ADR-0001). |

> A guard who is told to watch the door but is never allowed to stop anyone is decoration. The whole
> product is about making the stop real.

## arc words → normal words

```lede
Some arc jargon, translated into things you would see at a real security desk.
```

```rosetta
`arc-scan` | the metal detector | runs all the scanners and merges one report
`code-reviewer` | the careful inspector | reads the change and gives a verdict
`security-auditor` | the specialist for risky goods | looks for what scanners cannot see
`/arc-review` | "send in the inspector" | the everyday review
`/arc-audit` | "call the specialist" | the deep security pass
`/arc-second-opinion` | "ask a stranger to look too" | a different AI model reads the same change
`/arc-docs` | "update the instruction leaflet" | fixes docs that no longer match the change
baseline | the "we already knew about that" list | old problems, reported but never blocking
suppression | a written excuse | a waiver that only counts if it has a date and a reason
review ledger | the sign-off book | stamps per check, per exact version
strictness profile | how strict the desk is today | one switch for every check at once
verdict | the day's decision | pass, block or skipped
```

## How a job flows

```lede
Checks run from cheap and mechanical to careful and human. Each pass stamps the book, and the last
gate reads the book.
```

```flow
source: the changed files
box: ① Scan | metal detector
box: ② Review | inspector reads
box: ③ Deep audit | only if risky
box*: ④ Sign-off book | stamps per version
labels: report, verdict, stamp
out: new problem | blocked
out: fix first | no stamp
out: -
out+: all stamped | the door opens
divider: 3 | checks | decision
note: Nothing is pushed by review itself. A new commit means an empty book again.
caption: Figure 1 — the review desk. | The book is only stamped for the exact version that was checked.
```

## The stages, one by one

```lede
Each stage is written twice: first what it does in ordinary words, then what actually happens.
```

```steps
t: The metal detector runs
plain: It looks only at what you changed. Whatever scanners are installed each take a turn, and a missing scanner is skipped out loud, never faked. Old problems are set aside, waived ones are set aside, and what is left decides pass or block.
d: `arc-scan.sh` scopes to the changed files, runs each adapter, translates the output to the shared report shape, splits new from baseline, applies justified suppressions, then a downgrade-only triage step that can soften a shaky finding but never invent a blocking one. The result stamps or unstamps the `scan` kind in the book.
f: `.claude/scripts/review/arc-scan/arc-scan.sh`

t: The inspector reads the change
plain: A machine can say a pattern matched. It cannot say whether the change is safe. So the inspector reads the surrounding code and the callers, and sums up in one verdict.
d: `/arc-review` calls the `code-reviewer` agent. First it fetches what arc already learned about those files, labelled as history and not as orders. The agent runs its own scanner sweep, then judges security, correctness, speed and upkeep. The findings are filed, and a clean verdict stamps `code`.
f: `.claude/commands/arc-review.md` · `.claude/agents/code-reviewer.md`

t: The specialist, only when it is risky
plain: For logins, payments, the API or data access, a second and deeper look. The specialist starts from what the scanners already found and spends its time on what they cannot: broken permissions, business-logic tricks, who can trick whom.
d: `/arc-audit` calls `security-auditor`. A claim only counts as a finding once the exact line behind it is quoted. What cannot be quoted goes to an appendix, not the bin, and still counts against the gate. Every verified high or critical finding opens a tracked issue.
f: `.claude/commands/arc-audit.md` · `.claude/agents/security-auditor.md` · `docs/playbooks/finding-verification.md`

t: A stranger reads it too
plain: Two reviewers who are the same mind twice give you one opinion. So a different model reads the same change, and the two answers are compared.
d: `/arc-second-opinion` uses the Codex CLI if it is there, else a second profile. If they disagree on a critical finding, shipping is treated as blocked until a person decides. If no second model is reachable it says so instead of pretending.
f: `.claude/commands/arc-second-opinion.md`

t: The leaflet matches the product
plain: If you changed something people rely on and touched no documentation, the desk notices.
d: `docs-drift.sh` compares changed files against the documentation files. `/arc-docs` reads what could be affected, fixes what drifted, and stamps `docs`.
f: `.claude/scripts/review/docs-drift.sh` · `.claude/commands/arc-docs.md`

t: The book is read at the door
plain: The last question is simple: has everything that was meant to run actually run, on this exact version?
d: The `reviews` gate asks the ledger whether every check the current profile requires is stamped for HEAD, and blocks if not.
f: `.claude/scripts/core/review-ledger.sh` · `arc.gates.yaml`
```

# The bigger loop

## Before push and after push

```lede
Two more checks bracket the push. One is before it, and one is after, and neither trusts the author.
```

```flow
source: a finished local commit
box: Attackers | two fresh, blind
box: Fix | same session
box: Push once | one CI run
box*: Read CI | per job, this commit
labels: holes, fixed, results
out: -
out: -
out: red job | fix and repeat
out+: green | ready to merge
caption: Figure 2 — the loop around the push. | The attackers see only the diff, and CI is read job by job.
```

- **Attack.** `/arc-attack` runs two attackers who have never seen how the work was built, one on the decision logic and one on the shell and operating-system edge. They report; they never fix (ADR-0226).
- **CI read.** `ci-digest.mjs` lists the runs for your exact commit, checks each run really belongs to it, and prints every job's result. A rolled-up green tick can hide one red job, and a CI log is untrusted text, so it is cleaned before printing.

## A change, from saved file to merged commit

1. You finish a change and commit it locally.
2. The metal detector scans only the changed files. Two old problems are ignored, one new one is found.
3. The new one is real. The verdict is **block**, and the `scan` stamp is removed.
4. You fix it and commit again. That is a new version, so the book is empty again.
5. The scan is clean and stamps `scan`. `/arc-review` runs, the inspector says ship, and `code` is stamped.
6. The change touched login code, so `/arc-audit` runs too, and `security` is stamped.
7. The two attackers try to break it. You fix what they find and push once.
8. CI is read per job. All green, and the reviews gate finds every stamp in the book for this version.

*This walk-through is an illustration of how the desk runs, not a real incident.*

## The doors and the job descriptions

Each check the desk runs is wired to a door, called a gate. A gate is a small rule that says "stop here unless this passes".

- `scan` is the metal detector's door. `docs` is the leaflet door. `reviews` is the door that reads the sign-off book.
- `coverage` blocks a release when too little of the code is exercised by tests. `rls` blocks when a database table is left open to everyone.
- `spine-api` is still on trial. It only warns when a script reads arc's logbook the wrong way.
- The rule `security-sensitive` is what tells you to call the specialist with `/arc-audit` before shipping login, payment or API changes. When a risky change is also broken, `/arc-fix-issue` is where the tracked issue goes.
- `/arc-design` belongs to qa, but its `design` verdict is stamped in the same book.
- `review-diff` and `attack-diff` are the written job descriptions behind `/arc-review` and `/arc-attack`. If you want to change how they work, you change the job description, not the generated command.

## How it connects to the rest of arc

- **Needs `core`.** The sign-off book and the strictness switch live there. The chips at the top of this page name the room and the ring.
- **Shares a room.** In the face, review sits in the review-and-ship room, next to git and qa. All three write into the same book.
- **Borrows memory.** The recall script that tells `/arc-review` what arc already learned about a file belongs to the memory product.
- **Shipping.** `/arc-ship` runs the checks and deploys, and the deploy guard runs the reviews gate first.

# Meta

## Glossary

```gloss
SARIF: the shared report format every scanner is translated into, so later steps speak one language.
STRIDE: a checklist for imagining how a system can be attacked: spoofing, tampering, denial and so on.
OWASP Top 10: the well-known list of the most common ways web software gets broken.
HEAD: the newest saved version of the work. The book is keyed to it.
Pass 0: the security specialist's name for the scanner evidence it inherits instead of redoing.
```
