<!-- facts: agents=4f53cda1 commands=2e4720f6 docs=4f53cda1 faceRing=785b1405 faceRoom=ee12d4c2 files=4f53cda1 requires=d7a6ddaf scripts=4f53cda1 version=39fe4a40 -->

## In plain words

**`git` runs four commands and owns no script of its own.** <!-- src: products/git/manifest.json -->
`/arc-commit` stages related changes and writes a conventional commit — splitting unrelated changes into separate commits — and never pushes. <!-- src: .claude/commands/arc-commit.md --> `/arc-pr` opens a pull request for the current branch. <!-- src: .claude/commands/arc-pr.md --> `/arc-fix-issue` reads a GitHub issue, finds the root cause, and proposes a conventional commit message. <!-- src: .claude/commands/arc-fix-issue.md --> `/arc-ship` lints, builds and tests, then deploys — in one shot. <!-- src: .claude/commands/arc-ship.md -->

It requires only `core` — nothing else in arc. <!-- src: products/git/manifest.json -->

### Why this needs to be a product at all

If arc only ever ran inside arc's own repository, these four habits could just live in one big
pile of instructions with everything else. <!-- plain -->

Instead, `git` is one entry in the same catalogue of installable products as `core`, `qa` and
`review`. <!-- src: .claude/scripts/core/arc-products.mjs#CATALOG -->
The install tool that reads that catalogue can be pointed at exactly `core` plus one named
product; a dedicated test proves this works by installing `council` and checking that `core`
rides along while `plan`, `review`, `qa`, and this product's own `/arc-commit` all stay absent. <!-- src: sync-to-project.sh; tests/sync.bats#REQ-01 -->

## arc words → normal words

| arc calls it | It really means |
|---|---|
| process | The single YAML job description one of these commands is compiled from — here, the file behind `/arc-commit`. <!-- src: processes/commit-msg-draft.process.yaml; .claude/commands/arc-commit.md --> |
| class | The name that same job goes by on engine's staffing rota, used to look up who should do it. <!-- src: engine/router.yaml --> |
| tier | The pay grade the rota assigns to that class. The commit job sits at `balanced-workhorse`: bounded, structured production inside a frame someone else already set. <!-- src: engine/router.yaml; docs/adr/0069-balanced-model-policy.md --> |
| driver / fallback | The worker engine reaches first for a job, and the workers it tries next, in order, if that one reports a driver-fault — never if it reports a process-fault, so a broken schema is not retried down the chain. The commit job's order is `claude-code`, then `codex`, then `generic-api`. <!-- src: engine/router.yaml#commit-msg-draft --> |
| baseline | The hand-written command file a process replaced, pinned by the exact commit and file hash it matched on the day it was migrated. <!-- src: processes/commit-msg-draft.process.yaml --> |
| GENERATED FILE header | The warning at the top of `arc-commit.md` saying a hand-edit there is deleted the next time the process is recompiled. <!-- src: .claude/commands/arc-commit.md --> |
| receipt / the spine | The append-only logbook a commit or a ship writes one line to. The active day's file is append-only, a closed day is immutable, and a correction is only ever a new event that supersedes the old one — nothing is edited or deleted. <!-- src: docs/adr/0029-spine-f-immutability-windows-supersedes.md; .claude/commands/arc-commit.md; .claude/commands/arc-ship.md --> |
| kind | The fixed name a receipt is filed under, out of a closed list of eighteen. `/arc-commit` writes `commit.done`; `/arc-ship` writes `ship.done`. <!-- src: docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md; .claude/commands/arc-commit.md; .claude/commands/arc-ship.md --> |
| face room | Named in a product's manifest as `face.room`. This product's is `review-ship`. <!-- src: products/git/manifest.json --> |
| proposal branch | A branch a piece of arc's own tooling writes on a human's behalf, so a machine can offer a change without ever being the one who accepts it. <!-- src: .claude/scripts/core/proposal-branch.mjs --> |

## How a job flows

`git` has four commands: `/arc-commit`, `/arc-pr`, `/arc-fix-issue` and `/arc-ship`. <!-- src: products/git/manifest.json -->

1. You change files on a branch, checked before every commit. <!-- src: CLAUDE.md -->
2. `/arc-commit` groups related changes into a conventional commit — splitting unrelated changes
   into separate commits — never a push. <!-- src: .claude/commands/arc-commit.md -->
3. Either `/arc-pr` turns that branch into a pull request, or `/arc-ship` deploys straight from
   the current branch once its own checks pass. <!-- src: .claude/commands/arc-pr.md; .claude/commands/arc-ship.md -->
4. If the work instead started from a reported bug, `/arc-fix-issue` is the other entry point:
   it reads the issue, finds the root cause, and proposes a conventional commit message rather
   than typing one. <!-- src: .claude/commands/arc-fix-issue.md -->

### Why main is never written directly

Under the Constitution, an irreversible action — publishing under the owner's name among them —
belongs to the human alone, whatever autonomy a session otherwise has: no level of proven autonomy
ever includes it. <!-- src: CONSTITUTION.md -->

The rule is written down directly, not left to be inferred: work happens on a branch, and a pull
request gets opened for it — a commit never lands straight on `main`. <!-- src: CLAUDE.md --> Because
a session's branch can change between one turn and the next without anyone saying so, the rule
also names exactly when to check: immediately before every commit, by running
`git branch --show-current`, and stopping to move the work onto a `feat/*` branch if the answer
is `main`. <!-- src: CLAUDE.md -->

This is not only a typed instruction — it is built into what each command is even allowed to run.
`/arc-commit`'s own tool grant lists `git status`, `git diff`, `git log`, `git add`, `git commit`,
and one script call to leave the receipt; there is no `git push` in it anywhere. <!-- src: .claude/commands/arc-commit.md --> `/arc-pr`'s
grant is narrower still — `git status`, `git diff`, `git log` and `gh pr` — and it does not
pre-authorize a push either: the command asks for the exact `git push -u origin <branch>` to be
approved by name before it runs, every time. <!-- src: .claude/commands/arc-pr.md -->

The same boundary shows up one level below the four commands, too. When a piece of arc's own
tooling needs to change a file on its own — with no person typing the words — it still never
edits `main`. It writes a brand-new branch by raw git plumbing, based on `main` as it stood the
moment the edit was read, and it can move nothing else: no checkout, no merge, no push, no reset.
A human merges that branch, or does not. <!-- src: .claude/scripts/core/proposal-branch.mjs --> The
same discipline is named as a rule for the whole company, not just for this one file: publishing
under the owner's name is one of a short list of irreversible acts that belong to the human alone,
at the strictest tier arc has — the one tier nothing is ever allowed to amend away. <!-- src: CONSTITUTION.md -->
A sibling product enforces that exact boundary in code rather than by asking: its publish command
can create a branch and a pull request, but has no merge path and no default-branch push path at
all, proven by a test that tries all three and requires every one of them to be refused. <!-- src: docs/adr/1102-publish-is-a-pull-request-and-the-machine-never-merges.md -->

## The stages, one by one

1. **Stay off `main`.**
   Before any commit, the branch is checked. `main` is never the place work happens. <!-- src: CLAUDE.md -->

2. **`/arc-commit` — write the commit.**
   `git status` and `git diff` first, so nothing is committed blind. Unrelated changes are split
   into separate commits. The message is a conventional commit — `feat:`, `fix:`, `chore:`,
   `docs:` or `refactor:`, subject under 72 characters, imperative — and untracked junk is never
   swept in with a blanket `git add .`. The command commits and stops; it does not push. <!-- src: .claude/commands/arc-commit.md -->
   It then leaves a receipt: a `commit.done` line on the spine, in hook mode, so a telemetry
   problem can never block the commit that already happened. <!-- src: .claude/commands/arc-commit.md; docs/adr/0031-spine-h-emitter-dual-mode.md -->

3. **`/arc-pr` — offer the branch.**
   It first confirms the branch is not `main` and nothing is uncommitted, then summarises the
   branch against its base (`main` by default) with `git log` and `git diff --stat`. Pushing is
   gated here explicitly: the command asks for approval of the exact `git push -u origin` call
   before it creates anything. Only then does it run `gh pr create`, with a conventional-commit
   style title and a body carrying a Summary and a Test plan. <!-- src: .claude/commands/arc-pr.md -->

4. **`/arc-fix-issue` — the other way in.**
   Given an issue number, it reads the issue with `gh issue view`, finds the root cause rather
   than patching the symptom, writes a failing test that reproduces the bug, then makes it pass,
   and runs the project's own test and lint commands. It ends by proposing a conventional commit
   message rather than typing one. <!-- src: .claude/commands/arc-fix-issue.md -->

5. **`/arc-ship` — lint, build, test, then deploy.**
   The four checks run in a fixed order, and the command stops at the first failure rather than
   continuing past it: lint, build, test, and only if every one of those passed, a production
   deploy. <!-- src: .claude/commands/arc-ship.md --> The deploy step is watched by a second, independent
   check outside the command itself: any shell command shaped like a Vercel production deploy is
   intercepted, the project's tests are rerun from scratch, and arc's own gates are run again —
   and either one failing blocks the deploy outright rather than merely warning about it. <!-- src: .claude/hooks/PreToolUse.d/50-deploy.sh -->
   A successful ship leaves its own receipt — a `ship.done` line carrying the production URL and
   a one-line summary. <!-- src: .claude/commands/arc-ship.md -->

## Every part, explained

### Commands

- `/arc-commit` — stages related changes and writes one conventional commit; never pushes; leaves
  a `commit.done` receipt. Reach for it every time work is ready to be committed. <!-- src: .claude/commands/arc-commit.md -->
- `/arc-pr` — turns the current branch into a GitHub pull request, with a gated push and a
  summary-plus-test-plan body. Reach for it once a branch is ready to be reviewed. <!-- src: .claude/commands/arc-pr.md -->
- `/arc-fix-issue` — investigates one numbered GitHub issue end to end, from root cause to a
  failing test to a passing fix. Reach for it when the work starts from a filed bug rather than
  from a change already in hand. <!-- src: .claude/commands/arc-fix-issue.md -->
- `/arc-ship` — lints, builds and tests the branch, then deploys to production and records the
  ship. Reach for it to take a finished branch live in one pass. <!-- src: .claude/commands/arc-ship.md -->

### Agents

None. `products/git/manifest.json` lists no `agents` array, unlike `review` (`code-reviewer`,
`security-auditor`) and `qa` (`qa-tester`, `design-reviewer`), which each list two. All four of
this product's entries sit under `commands`, not `agents`. <!-- src: products/git/manifest.json; products/review/manifest.json; products/qa/manifest.json -->

### Processes

Exactly one of the four commands is compiled rather than hand-written: `/arc-commit` is generated
from `commit-msg-draft`, a job description with its own version, a required output shape (a list
of commit `sha`/`subject` pairs), six worked examples, and a baseline pinned to the commit and
sha256 hash of the hand-written file it replaced. <!-- src: processes/commit-msg-draft.process.yaml --> The
same job description is also a live row on engine's rota. <!-- src: engine/router.yaml#commit-msg-draft -->
Separately, the identical commit-writing job can be handed to a different model for a one-off
trial without touching anything this product owns: a `--trial-model` flag names a model for that
one run only, writes no router row, and changes no tier. <!-- src: .claude/scripts/engine/arc-run.mjs --> `/arc-pr`, `/arc-fix-issue` and `/arc-ship` are not
compiled from anything; they are plain hand-written command files. <!-- src: .claude/commands/arc-pr.md; .claude/commands/arc-fix-issue.md; .claude/commands/arc-ship.md -->

### Scripts

None owned. `products/git/manifest.json` has no `scripts` array. <!-- src: products/git/manifest.json -->
Two of the four commands still call out to one script that belongs to a different product,
though: both `/arc-commit` and `/arc-ship` end by running `bash .claude/scripts/hq/arc-event.sh
emit ...` to leave their receipt, and that script is listed in `hq`'s manifest, not this one's. <!-- src: .claude/commands/arc-commit.md; .claude/commands/arc-ship.md; products/hq/manifest.json -->

### Gates and rules

- **The branch check, before every commit.** `git branch --show-current` is required immediately
  before committing, because the branch can change between turns without anyone announcing it. <!-- src: CLAUDE.md -->
- **The deploy guard.** Any Bash command shaped like a Vercel production deploy is intercepted;
  it reruns the tests and arc's own gates before letting the deploy through, and blocks outright
  — exit code 2 — if either one fails. <!-- src: .claude/hooks/PreToolUse.d/50-deploy.sh -->
- **The closed receipt vocabulary.** A receipt can only be filed under one of eighteen fixed
  kinds; an unknown kind is refused outright in strict mode and quarantined in hook mode. `commit.done`
  and `ship.done` are two of the eighteen. <!-- src: docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md -->
- **Selective install is tested.** A dedicated test installs one product (`council`) together
  with `core` and checks that its files land, `core` rides along, and specific files from other
  products — `plan`, `review`, `qa`, and this product's own `/arc-commit` — are confirmed absent. <!-- src: tests/sync.bats#REQ-01 -->

## The bigger loop

### One change, from a branch to a ship

A branch is checked out; work happens on it, never on `main`. <!-- src: CLAUDE.md --> When a piece of it
is ready, `/arc-commit` groups it into one conventional commit and writes a `commit.done` line to
the spine — the commit exists, and so does the record that it happened. <!-- src: .claude/commands/arc-commit.md -->

From there the branch can go either of two ways. `/arc-pr` can turn it into a pull request: it
checks the branch is clean and off `main`, asks for the push to be approved by name, and only
then opens the PR with a summary and a test plan. <!-- src: .claude/commands/arc-pr.md -->
Whatever reviews that pull request afterward — a person, or a sibling product's own review
command — is grading a specific commit, not the branch in general: a new commit is a new review,
and a review stamp from an earlier commit does not carry over to it. <!-- src: face/src/modules/factory/review-ship/View.tsx -->
No command's own written steps in this product ever run that merge: `/arc-commit`, `/arc-fix-issue`
and `/arc-ship` carry no `gh pr` or merge call in their tool grants at all, and `/arc-pr`'s own
instructions never call `gh pr merge` either — though its grant, `Bash(gh pr:*)`, is a wildcard
broad enough to also permit that call. <!-- src: .claude/commands/arc-pr.md; .claude/commands/arc-commit.md; .claude/commands/arc-fix-issue.md; .claude/commands/arc-ship.md -->

Or the branch goes straight to `/arc-ship`: lint, then build, then test, stopping at the first
failure, and only past all three does the deploy step run — itself rechecked from outside the
command by the deploy guard before it is allowed to reach production. <!-- src: .claude/commands/arc-ship.md; .claude/hooks/PreToolUse.d/50-deploy.sh -->
A successful ship writes its own line to the spine: `ship.done`, carrying the production URL. <!-- src: .claude/commands/arc-ship.md -->

If the work started from a filed bug instead of a change already in hand, `/arc-fix-issue` is
where it begins — reading the issue, finding the root cause, proving it with a failing test —
and it ends by proposing a conventional commit message rather than typing one. <!-- src: .claude/commands/arc-fix-issue.md -->

### How it connects to the rest of arc

This product's receipts do not stand alone. They land in `review-ship`, a room two other
products also write into: `review` (`/arc-review`, `/arc-audit`, `/arc-second-opinion`,
`/arc-docs`) and `qa` (`/arc-qa`, `/arc-design`, `/arc-canary`). <!-- src: products/git/manifest.json; products/review/manifest.json; products/qa/manifest.json -->
All four receipt kinds this room is built around — `commit.done`, `review.completed`,
`qa.completed` and `ship.done` — are named identically in all three products' manifests. <!-- src: products/git/manifest.json; products/review/manifest.json; products/qa/manifest.json -->

The same job can also be run once, for a single trial, against a different model, independent of
that rota row: a `--trial-model` flag names a model for that one run only, writing no router row
and changing no tier. <!-- src: .claude/scripts/engine/arc-run.mjs -->

The rule this product enforces by asking — never push, never merge, without a person saying so —
is enforced elsewhere in arc by code instead. A tool that edits a file on its own writes a fresh
branch by git plumbing and stops there: no checkout, no merge, no push, no reset; a human merges
that branch, or does not. <!-- src: .claude/scripts/core/proposal-branch.mjs --> `/arc-pr`'s own tool
grant is looser than that: `Bash(gh pr:*)` is a wildcard that would also permit `gh pr merge`,
even though `/arc-pr`'s own written steps never call it. <!-- src: .claude/commands/arc-pr.md -->
And because `git` requires only `core`, the same install tool that installs this whole product
can also be pointed at just `core` plus one other named product — proven, for a sibling product,
by a dedicated test. <!-- src: products/git/manifest.json; sync-to-project.sh; tests/sync.bats#REQ-01 -->

## Glossary

- **branch** — a separate line of work, not `main`, where changes happen before anyone else has
  to see them; work never happens on `main` directly. <!-- src: CLAUDE.md -->
- **commit** — one saved, named snapshot of a set of changes, written with `/arc-commit`. <!-- src: .claude/commands/arc-commit.md -->
- **conventional commit** — a commit message starting `feat:`, `fix:`, `chore:`, `docs:` or
  `refactor:`, subject under 72 characters, written in the imperative. <!-- src: .claude/commands/arc-commit.md -->
- **push** — sending committed work to the shared remote. Never automatic in this product;
  always a separately approved step. <!-- src: .claude/commands/arc-pr.md -->
- **pull request (PR)** — a named, reviewable offer to merge one branch into another, opened by
  `/arc-pr` and carrying a summary and a test plan. <!-- src: .claude/commands/arc-pr.md -->
- **merge** — accepting a pull request's changes into its base branch. No command's own written
  steps in this product perform one; `/arc-commit`, `/arc-fix-issue` and `/arc-ship` have no
  `gh pr` grant at all, and `/arc-pr`'s instructions never call `gh pr merge` either, though its
  grant (`Bash(gh pr:*)`) is a wildcard that would also allow it. <!-- src: .claude/commands/arc-pr.md; .claude/commands/arc-commit.md; .claude/commands/arc-fix-issue.md; .claude/commands/arc-ship.md -->
- **receipt / spine** — the append-only logbook a commit or a ship is recorded to; lines are
  added, never edited. <!-- src: docs/adr/0029-spine-f-immutability-windows-supersedes.md; .claude/commands/arc-commit.md; .claude/commands/arc-ship.md -->
- **process** — the YAML job description a compiled command is generated from. <!-- src: processes/commit-msg-draft.process.yaml; .claude/commands/arc-commit.md; docs/adr/0201-eng-b-adapters-are-pure-functions-and-a-generated-file-is-never-hand-edited.md -->
- **baseline** — the hand-written command file a process replaced, pinned by the exact commit and
  file hash it matched on the day it was migrated. <!-- src: processes/commit-msg-draft.process.yaml; docs/adr/0201-eng-b-adapters-are-pure-functions-and-a-generated-file-is-never-hand-edited.md -->
- **GENERATED FILE** — the header marking a command file as compiled, meaning a hand-edit to it
  is deleted the next time it is regenerated. <!-- src: .claude/commands/arc-commit.md -->
- **face room** — named in a product's manifest as `face.room`; this product's is `review-ship`. <!-- src: products/git/manifest.json -->
