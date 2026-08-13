---
description: Testing conventions — pure logic, deterministic fakes, no network.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
  - "e2e/**"
---

# Testing Rules

- Unit tests never touch the network, disk, or a real DB — use the fake impl behind each
  adapter interface (build playbook §3.2/§3.4).
- Test pure functions directly. If logic is hard to test, extract it from the I/O first —
  don't mock your way around bad structure.
- Every bugfix starts with a failing test that reproduces it. Fix, then watch it pass.
- Fakes are deterministic: derive stable values from the input, never random.
- e2e (Playwright) tests user flows, not implementation details; runs against the local stack.
- A test per feature — the test is the contract for "done" (playbook §5).
- Never pipe a test runner into `tail`/`head`/`grep` — the pipeline's exit code comes from the
  LAST stage, so a failing suite reports success. Redirect to a file and read it, or check
  `${PIPESTATUS[0]}`. A masked red suite is worse than no suite.

- **Before editing any file, check for a `GENERATED FILE` header.** Three command bodies are
  compiled from `processes/*.process.yaml`; a hand-edit there is deleted by the next `arc-compile`.
  A change that survives until the next regeneration and then vanishes — while the tracker still
  claims it landed — is worse than one that fails immediately.

## Where tests run — CI, never this box

**Do not run `bats`, the full suite, or a suite shard locally.** It clogs the machine, and a green
local run proves nothing about the three-OS matrix that actually gates: the failures that matter
here have been Windows path resolution, BSD-vs-GNU `sed`, filesystem case-folding and locale
collation — every one of them invisible on the box that wrote the code. Node for a parse check or
to generate an artifact is fine; a test RUN is not.

CI is the only gate, so make each push buy a full cycle: batch related work into one commit rather
than pushing per-fix.

**Read the per-JOB conclusions, never the watcher's exit code.** `gh run watch --exit-status` has
returned **0 on a run whose conclusion was `failure`** — the same shape as an emitter exiting 0
while every receipt it wrote was quarantined. Use `gh run view <id> --json jobs` and assert on the
conclusions themselves.

**And first confirm a run EXISTS for your SHA.** A push does not always create one: on 2026-08-12
a commit pushed to an open **draft** PR became the PR head with **no run ever created for it**,
while every earlier push on the same branch had fired one. Nothing appears in any log; the only
signal is that `gh run list --branch` still shows the *previous* SHA on top. Waiting on a run that
was never created is indistinguishable from waiting on a slow one, and costs more than a red does.

```bash
gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId,headSha
# headSha is not your HEAD -> create one; do not wait for one that will never come:
gh workflow run arc-ci --ref "$(git branch --show-current)"
```

**If it happens twice on the same branch, stop dispatching and find the cause.** It is not
intermittent — it is every push until the cause is fixed, and dispatching each time hides that
behind a minute of waiting per cycle. The ledger lane paid that toll five times before checking.

```bash
gh pr view --json isDraft,mergeable --jq '.'
```

**`mergeable: CONFLICTING` is the usual answer, and it is the one worth knowing.** The
`pull_request` trigger runs against `refs/pull/N/merge`, and git cannot build that ref while the
branch conflicts with base — so GitHub creates no run at all and reports nothing. The signal looks
identical to a slow queue. A conflict means another lane has landed on a file you also touched, so
the fix is the merge you already owe (`.claude/rules/lanes.md`, shared organs), not a dispatch.

`isDraft: true` blocks a run only where the workflow filters on `pull_request` types; this repo's
`on: pull_request` has no `types:` filter, so a draft still fires. Check both, and believe the one
that is actually true rather than the first plausible story — this note originally named the draft
as the cause and was wrong.

"Pushed" and "a run exists" are two separate facts, exactly as "merged" and "verified" are.

### Regenerating the sync-golden manifest

`tests/fixtures/sync-golden/tree-manifest.txt` records the **SYNCED tree**, never the repo. Hashing
repo files instead once clobbered `.env.example`'s row, and only CI could see it. Regenerate by
running the real sync and the suite's own helper — then check the row COUNT is unchanged and that
**only** the files you touched moved:

```bash
bash sync-to-project.sh "$SCRATCH" >/dev/null
source tests/test_helper.bash && _arc_tree_manifest "$SCRATCH" > tests/fixtures/sync-golden/tree-manifest.txt
git diff -U0 tests/fixtures/sync-golden/tree-manifest.txt | grep "^+[^+]" | cut -f1
```

Do it **last**, after every code edit. A manifest regenerated mid-change is stale by the next
commit, and its staleness is invisible until CI.

## The vacuous pass — a test that passes while executing nothing

A green test proves the assertion held. It does not prove the code ran. Cycle 6 shipped this
failure **three separate times**, twice inside suites written to prevent exactly it:

- nine bats probes imported a path Git Bash resolves and node does not — three of them PASSED,
  on the stack trace
- a heredoc never reached a helper's stdin, so every fixture it built was empty and two
  "no findings" tests passed on nothing at all
- a probe read `process.argv[1]`, which for a node SCRIPT is the script itself, so a validator
  spent the entire suite parsing its own source

Three rules, and they are cheap:

- **Assert it RAN before asserting what it printed.** Any probe that shells out checks the exit
  status, or asserts on a marker the code emits only when it reaches the end.
- **A fixture builder asserts its own fixture is non-empty.** An empty fixture is a silent pass
  generator, and it looks identical to a clean run.
- **An assertion shaped "output does not contain X" never stands alone.** A crash satisfies it.
  Pair it with a positive assertion that the run produced its expected output.

The general form: **prefer an assertion that fails when the code is deleted.** If ripping out the
implementation would leave the test green, the test is measuring nothing.

### The test that was never there

Cycle 7 found the worse sibling: **bats silently DROPS a `@test` whose name contains a non-ASCII
character.** Five tests written with em-dashes in their titles were never registered, never ran and
never failed. The file was green. The only signal was the test count falling on CI.

- **`@test` names are ASCII-only.** No em-dashes, no smart quotes, no arrows. Put the nuance in the
  body, not the title.
- **A suite that IS the proof of a rule asserts its own count** — an explicit final test that fails
  when the registered total changes unnoticed.
- A suite running fewer tests than it declares is indistinguishable from a suite that passes.
