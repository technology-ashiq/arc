<!-- facts: agents=4f53cda1 commands=a5ce5ab4 docs=4f53cda1 faceRing=015216f4 faceRoom=4f0f1d7c files=9f098559 requires=d7a6ddaf scripts=dafadc61 version=39fe4a40 -->

## In plain words

Think of a small company where nobody trusts memory. Every decision, every payment, every
finished piece of work gets written into one book, in ink, in the order it happened, and nobody
is ever allowed to tear a page out or write over an old line. Anyone in the company can read the
book. One person alone holds the pen that turns a request into a decision, and every morning
there is a single sheet of paper that already says what happened yesterday and what is waiting
for a signature today. <!-- plain -->

**hq is that book, that pen, and that sheet of paper.** It is the product that holds several
different parts of arc's own record-keeping, named in its own manifest: <!-- src: products/hq/manifest.json -->

- the spine, arc's append-only log of receipts <!-- src: docs/adr/0024-spine-a-append-only-canonical-jsonl-is-truth.md -->
- the inbox, where the owner approves or rejects a request <!-- src: .claude/scripts/hq/arc-inbox.mjs -->
- the brief, one day rendered in a single screen <!-- src: .claude/scripts/hq/arc-brief.mjs -->
- the ledger and P&L, the company's money derived from the spine at render time rather than
  stored a second time <!-- src: docs/adr/1000-led-a-ledger-is-a-reader-only-derivation-layer.md -->
- the job scheduler, whose jobs fire on a daily or weekday cadence, or by hand <!-- src: .claude/scripts/hq/lib/jobs/cadence.mjs; .claude/scripts/hq/arc-jobs.mjs -->
- the policy engine, whose one decision function decides whether an action is denied, merely
  proposed, or allowed to execute <!-- src: .claude/scripts/hq/lib/policy/authorize.mjs -->
- the face's one read door and one decision door (L2, `arc dash`), which the browser app talks
  to instead of ever touching the spine's files itself <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md; .claude/scripts/hq/arc-dash.mjs -->

### Why this needs to be a product at all

If arc were one person doing one job, none of this would need to exist -- a person remembers
what they did. But arc is built from many separate products, and the orchestrator initiative's
closing lesson was that a module survives by coupling to a stable contract, not to another
module's internals -- engine, evolve, dashboard and policy are named as needing to plug into
exactly that kind of API. The chosen answer was one shared reader that every consumer polls
with its own cursor, declared in its own manifest, rather than a message bus between products.
<!-- src: docs/adr/0030-spine-g-spine-is-the-only-public-api.md -->

Ten other products in arc -- `absorb`, `design`, `develop`, `docs`, `engine`, `evolve`, `growth`,
`leads`, `legal` and `memory` -- declare hq as something they require, and hq itself requires
only `core`.
<!-- src: fact:products/absorb.requires; fact:products/design.requires; fact:products/develop.requires; fact:products/docs.requires; fact:products/engine.requires; fact:products/evolve.requires; fact:products/growth.requires; fact:products/leads.requires; fact:products/legal.requires; fact:products/memory.requires; fact:products/hq.requires -->

| What you lose | What it looks like when it bites | hq's answer |
| --- | --- | --- |
| You stop knowing what actually happened | Two products disagree about whether a decision was ever made, or a payment ever landed | Every fact is one line on the spine, appended once, checked against a closed schema, never edited afterward <!-- src: docs/adr/0024-spine-a-append-only-canonical-jsonl-is-truth.md; docs/adr/0029-spine-f-immutability-windows-supersedes.md; .claude/scripts/hq/lib/validate.mjs#validateEvent --> |
| You stop knowing what still needs a human | A separately stored copy of "what's open" could go stale, or vanish if wiped | The inbox holds no state of its own -- every run recomputes what's still open by folding decisions onto requests, straight from the spine <!-- src: .claude/scripts/hq/arc-inbox.mjs#loadApprovals --> |
| You stop trusting the money number | A stored roll-up and a corrected spine input could quietly disagree with each other | The P&L is derived at render time from spine receipts only, and keeps no cache of its own <!-- src: docs/adr/1000-led-a-ledger-is-a-reader-only-derivation-layer.md --> |
| A write grant could disarm the rule that constrains it | A write grant that reaches `.claude/` could delete the deny rule that binds it, then proceed -- or delete a hook script, since a missing hook fails open | A handful of files -- including `hq.policy.yaml` itself and the hook scripts under `.claude/hooks/` -- are excluded from every write grant, at any level, regardless of ceiling or cap <!-- src: docs/adr/0502-un-grantable-resources.md --> |

## arc words → normal words

| arc calls it | it is really | meaning |
| --- | --- | --- |
| the spine | the logbook | An append-only file of every fact arc has recorded: one line per fact, added in order, never edited. <!-- src: docs/adr/0024-spine-a-append-only-canonical-jsonl-is-truth.md --> |
| event / receipt | one logbook entry | One JSON line: what happened, who did it, which model, which venture, what it cost, and whether it worked. <!-- src: .claude/scripts/hq/lib/validate.mjs#REQUIRED_KEYS; .claude/scripts/hq/arc-event.mjs#seal --> |
| kind | the type of entry | The word naming what sort of fact a receipt is -- `idea.captured`, `revenue.received`, `decision.recorded` and so on. <!-- src: .claude/scripts/hq/lib/validate.mjs#KINDS --> |
| idem | the "already logged this" fingerprint | A key derived from an event's own identity fields; for four kind families (leads, experiment, policy, content) a caller-supplied idem is refused outright as an anti-preclaim guard, while other kinds may still take one from the caller. Either way, the same fact submitted twice collides on this key and is refused rather than recorded twice. <!-- src: .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/lib/spine-io.mjs#appendEventUnlocked --> |
| ULID | the receipt's serial number | Every event's own id: 10 characters built from the moment it was minted plus 16 characters of randomness -- but two ULIDs minted in the same millisecond by different processes are not ordered relative to each other, which is why the spine reads by append order instead. <!-- src: .claude/scripts/hq/lib/canonical.mjs#newUlid; .claude/scripts/hq/spine.mjs --> |
| quarantine | the reject pile | Where an event that fails validation goes instead of the logbook, one record per rejection carrying its refusal code -- and when the failure could involve a secret, only a stub-only record is kept, never the secret bytes themselves. <!-- src: .claude/scripts/hq/lib/spine-io.mjs#quarantine; docs/adr/0028-spine-e-secret-redaction-at-emit-fail-safe.md --> |
| day.closed | sealing yesterday's page | Once a day is closed its bytes are pinned by a hash forever; a correction after that has to be a new line on a later day, not an edit. <!-- src: docs/adr/0029-spine-f-immutability-windows-supersedes.md --> |
| inbox | the tray of things waiting for a signature | The list of requests (`approval.requested`) that have no matching decision yet. <!-- src: .claude/scripts/hq/arc-inbox.mjs --> |
| brief | the one-screen morning read | A single deterministic render of one day, built only from what the spine holds, for whichever date you ask. <!-- src: .claude/scripts/hq/arc-brief.mjs --> |
| ledger / P&L | the company's money, counted honestly | Revenue and cost, derived from the spine at the moment you ask, plus a reconciliation gate at month-close; `arc pnl` may not memoise across calls in v1. <!-- src: docs/adr/1000-led-a-ledger-is-a-reader-only-derivation-layer.md; docs/adr/1005-led-f-reconciliation-is-a-blocking-close-gate.md --> |
| kill line | the line that says "stop funding this" | A threshold in `ventures.yaml` -- days without revenue, a traffic floor -- that a venture is measured against. <!-- src: docs/adr/1008-led-i-ventures-yaml-is-a-root-organ-whose-edits-need-a-receipt.md --> |
| policy | the company's rulebook for what a session may do | `hq.policy.yaml`: which capability, at which level, for which kind of work -- read, write, shell, network, spend, and more. <!-- src: .claude/scripts/hq/lib/policy/model.mjs#CAPABILITIES --> |
| L2 / arc dash | the back-office window | The one server that reads the spine and the sanctioned files, and the one place a decision is written from the face. <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md --> |
| L3 / the face | the browser app | The React and TypeScript web app the owner actually opens; it only ever talks to L2, never to the spine directly. <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md; docs/strategy/plans/PLAN-face.md; .claude/scripts/hq/arc-face.mjs --> |
| work door / session door | the two doors | One plans an op the door itself can plan, in two phases -- plan, then apply; the other starts judgement work -- a council, a review, a phase close -- that no CLI can plan the way the work door plans an op. <!-- src: docs/adr/1326-fv2-i-work-door-two-phase-no-logic-of-its-own.md; .claude/scripts/hq/face-sessions.mjs --> |

## How a job flows

A fact reaches the spine and later reaches a human in two different directions, and hq owns
both of them. <!-- src: docs/adr/0030-spine-g-spine-is-the-only-public-api.md; docs/adr/1301-face-b-three-layers-one-read-door.md; products/hq/manifest.json -->

**Direction one -- something happens, and it gets written down.** A commit, a payment settling,
an idea, or a finished phase -- among the closed vocabulary's other kinds -- reaches the spine by
calling its only writer, `arc-event`, which validates it, seals it, and appends it. <!-- src: .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/lib/spine-io.mjs#appendEventUnlocked; .claude/scripts/hq/lib/validate.mjs#KINDS -->

**Direction two -- a human needs to decide something.** The owner opens the face; the browser
asks arc dash (L2) to read the spine and render it, and when he approves or rejects a request,
arc dash is the one place that decision gets written. <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md; docs/adr/1302-face-c-one-write-path-api-decide.md; .claude/scripts/hq/arc-face.mjs -->

## The stages, one by one

**Writing a fact onto the spine**, through the one writer and the storage library beneath it. <!-- src: .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/lib/spine-io.mjs -->

1. **Something happens.** A process calls `arc-event emit <kind>` with a payload -- a payment, a
   decision, a finished run. In an interactive session this runs in hook mode, which never
   blocks; in CI, revenue ingest, or a test it runs `--strict`, which exits non-zero on a refusal.
   <!-- src: docs/adr/0031-spine-h-emitter-dual-mode.md; .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/lib/validate.mjs#KINDS -->
2. **It is scanned for secrets, fail-safe.** A hit refuses the event outright; a scanner failure
   drops the raw payload rather than risk writing a secret onto a log nothing can ever delete.
   <!-- src: docs/adr/0028-spine-e-secret-redaction-at-emit-fail-safe.md -->
3. **It is validated against the closed schema.** Fifteen required top-level keys plus one
   optional one (`sha`), a kind from a closed list, and a shape specific to that kind if one is
   defined -- `decision.recorded` and `constitution.adopted` are two examples with their own
   closed payload rules. <!-- src: .claude/scripts/hq/lib/validate.mjs#validateEvent; .claude/scripts/hq/lib/validate.mjs#KINDS -->
4. **The day must still be open.** A closed day refuses every new line; a correction goes on a
   new day and names what it supersedes. <!-- src: .claude/scripts/hq/lib/spine-io.mjs#appendEventUnlocked -->
5. **A lock is taken and one line is written to disk.** The write itself is synchronous -- every
   byte lands, or the call throws -- and a flush is attempted right after; but if that flush
   fails, the caller is still told the append succeeded, since the line already sits in the file
   and every reader can see it. The lock is a token, not just a file's existence, so a stale lock
   cannot be handed to two writers at once. <!-- src: .claude/scripts/hq/lib/spine-io.mjs#withLock; .claude/scripts/hq/lib/spine-io.mjs#appendLine -->
6. **The duplicate index is updated.** The same fact submitted twice collides on its idem key and
   is refused, not recorded twice -- and if the index write itself fails, `arc-replay` can always
   rebuild it whole from the log. <!-- src: .claude/scripts/hq/lib/spine-io.mjs#appendEventUnlocked; .claude/scripts/hq/arc-replay.mjs -->
7. **It becomes visible.** `spine.mjs` is the reader every consumer -- the brief, the inbox, and
   every later module -- goes through, and it hands events back in the order the lines were
   actually written, not by sorting the id. <!-- src: .claude/scripts/hq/spine.mjs -->

**Acting on a request through the face's work door.** <!-- src: .claude/scripts/hq/lib/face/work-door.mjs -->

1. **Plan.** The owner fills in a form for one op (say, closing the month's books); the door
   validates the fields and runs that op's own dry run, which writes nothing. <!-- src: .claude/scripts/hq/face-ops.mjs -->
2. **Apply.** One click claims the plan and runs the exact command the plan already showed --
   never a second guess at what it should do -- and the door finds the receipt by reading the
   spine, never by trusting an exit code. <!-- src: docs/adr/1326-fv2-i-work-door-two-phase-no-logic-of-its-own.md; .claude/scripts/hq/lib/face/work-door.mjs -->
3. **Read.** The face can watch the run's own output while it is still writing, and a repeated
   click on an already-claimed plan replays that run instead of starting a second one. <!-- src: .claude/scripts/hq/lib/face/work-door.mjs -->

## Every part, explained

### Commands

- `/arc-face-module` -- scaffolds one face module (its four files) for a room the face already
  serves, and proves it green before it exits. This is the one command hq's own manifest lists.
  <!-- src: .claude/commands/arc-face-module.md; products/hq/manifest.json -->

### Agents

hq declares no dedicated subagent of its own -- its manifest's `agents` list is empty. <!-- src: fact:products/hq.agents -->

### Processes

- `adr-record` -- records one owner decision as an ADR at the next free number of the lane's
  century, and ends on its own `note.logged` receipt. <!-- src: processes/adr-record.process.yaml -->
- `brief-materialize` -- renders the day's brief into instance state, so the morning read costs
  nothing. <!-- src: processes/brief-materialize.process.yaml -->
- `day-close-roll` -- seals every unsealed day up to yesterday, oldest first, and idempotently.
  <!-- src: processes/day-close-roll.process.yaml -->

### Scripts

hq's manifest lists more than seventy of them. <!-- src: products/hq/manifest.json -->

- **The spine core.** `spine.mjs` (the reader every consumer goes through; only this file and
  `arc-replay.mjs` may open the raw log directly), `arc-event.mjs` and `arc-event.sh` (the
  spine's only writer, dual-mode), `arc-replay.mjs` (rebuilds every derived thing from nothing
  but the log), and the shared library underneath them -- `lib/canonical.mjs` (canonical
  serialization, hashing, ULIDs, the strict JSON reader), `lib/spine-io.mjs` (the lock, the
  append, the quarantine, the day-close markers), `lib/validate.mjs` plus the six
  the `validate-*` modules in hq's lib kind-specific modules it imports (experiment, leads, content, policy,
  absorb, ledger), and `lib/redact.mjs` (secret scanning at emit, fail-safe). <!-- src: .claude/scripts/hq/spine.mjs; .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/arc-event.sh; .claude/scripts/hq/arc-replay.mjs; .claude/scripts/hq/lib/canonical.mjs; .claude/scripts/hq/lib/spine-io.mjs; .claude/scripts/hq/lib/validate.mjs; .claude/scripts/hq/lib/redact.mjs -->
- **Reading the spine like a person would.** `arc-brief.mjs` is the day rendered in one screen --
  today's minimal renderer; the noise-budget grouping is Phase 2's work, not shipped yet.
  `arc-inbox.mjs` folds decisions onto requests to find what is still open, and writes a decision
  only through `arc-event`, the one writer. <!-- src: .claude/scripts/hq/arc-brief.mjs; .claude/scripts/hq/arc-inbox.mjs -->
- **The company's money.** `arc-pnl.mjs` derives the P&L at render time; `ledger-ingest.mjs` turns
  a settlement export into revenue receipts on the owner's click; `venture-register.mjs` seats a
  new venture with its kill lines written before its first launch. Underneath: `lib/ledger/money.mjs`
  (integer minor units, never a float), `lib/ledger/costs.mjs`, `lib/ledger/pnl.mjs`,
  `lib/ledger/reconcile.mjs` (the month-close gate), `lib/ledger/kill-panel.mjs` and
  `lib/ledger/kill-distance.mjs` (how far a venture sits from its kill lines), `lib/ledger/ventures.mjs`
  (the strict reader for `ventures.yaml`), and the two provider parsers under `lib/ledger/parsers/`.
  <!-- src: .claude/scripts/hq/arc-pnl.mjs; .claude/scripts/hq/ledger-ingest.mjs; .claude/scripts/hq/venture-register.mjs; .claude/scripts/hq/lib/ledger/money.mjs; .claude/scripts/hq/lib/ledger/costs.mjs; .claude/scripts/hq/lib/ledger/pnl.mjs; .claude/scripts/hq/lib/ledger/reconcile.mjs; .claude/scripts/hq/lib/ledger/kill-panel.mjs; .claude/scripts/hq/lib/ledger/kill-distance.mjs; .claude/scripts/hq/lib/ledger/ventures.mjs; .claude/scripts/hq/lib/ledger/parsers/mor.mjs; .claude/scripts/hq/lib/ledger/parsers/razorpay.mjs -->
- **Jobs that run themselves.** `arc-jobs.mjs` is the one wrapper every scheduled or manual run
  goes through -- lock, then guards, then execute, then receipt, with no second path.
  `jobs-lint.mjs` validates the schedule file before anything may run from it. `brief-materialize`
  and `day-close-roll` are the two jobs that actually fire through it. Underneath: `lib/jobs/cadence.mjs` (the closed cadence grammar),
  `lib/jobs/panel.mjs` (turns silence -- a job that should have fired and did not -- into
  something visible), `lib/jobs/policy-gate.mjs` (refuses to run unattended if policy enforcement
  cannot be proven live), and `lib/jobs/scheduler-os.mjs` plus `lib/jobs/scheduler-task.ps1` (the
  Windows Task Scheduler binding). <!-- src: .claude/scripts/hq/arc-jobs.mjs; .claude/scripts/hq/jobs-lint.mjs; hq.jobs.yaml; .claude/scripts/hq/lib/jobs/panel.mjs; .claude/scripts/hq/lib/jobs/cadence.mjs; .claude/scripts/hq/lib/jobs/policy-gate.mjs; .claude/scripts/hq/lib/jobs/scheduler-os.mjs; .claude/scripts/hq/lib/jobs/scheduler-task.ps1 -->
- **Guarding what a session or a job may do.** `policy-hook.mjs` is the bridge a live session's
  tool call goes through; `policy-lint.mjs` fails from birth on any illegal rulebook;
  `policy-matrix.mjs` derives, from `.mcp.json` itself, which tool a hook can actually intercept;
  `policy-promote.mjs` plans a request to raise one capability's level, inside the ceiling a human
  already set. Underneath: `lib/policy/authorize.mjs` (the one decision function), `lib/policy/reduce.mjs`
  (ceiling and cap folded into one effective level), `lib/policy/resources.mjs` (the files that can
  never be granted as a write target), `lib/policy/constitution.mjs` (checks the rulebook still
  quotes the Constitution correctly), and `lib/policy/spend.mjs` (the money guard). <!-- src: .claude/scripts/hq/policy-hook.mjs; .claude/scripts/hq/policy-lint.mjs; .claude/scripts/hq/policy-matrix.mjs; .claude/scripts/hq/policy-promote.mjs; .claude/scripts/hq/lib/policy/authorize.mjs; .claude/scripts/hq/lib/policy/reduce.mjs; .claude/scripts/hq/lib/policy/resources.mjs; .claude/scripts/hq/lib/policy/constitution.mjs; .claude/scripts/hq/lib/policy/spend.mjs -->
- **The face's shared doors.** `arc-dash.mjs` is L2: one read door and one decision door over the
  spine and the sanctioned files, serving the money model from `lib/ledger` and lane headers from
  `lane-resolve.mjs` as well as hq's own data. `arc-face.mjs` starts the door and the browser app
  together with one generated token, so the owner never hand-copies a secret. `face-ops.mjs` is
  the work door's op registry and `face-sessions.mjs` is the session door's verb registry -- one
  row per short op, one row per longer session. `face-module.mjs` scaffolds a module's four files
  (`module.mjs`, `fold.mjs`, `ops.mjs`, `View.tsx`) for a room the face already serves;
  `face-modules-contract.mjs` derives the contract those files are checked against, from the
  files that already hold the facts. Underneath, `lib/face/reads.mjs` holds the read handlers for
  the rooms the door could not otherwise fill, `lib/face/work-door.mjs` and
  `lib/face/session-door.mjs` are the two doors themselves, `lib/face/ask-offline.mjs` is the half
  of Ask arc that needs no model at all because questions about live state have exact answers,
  and `lib/face/reference/route.mjs` serves the wiki's own extract to the Reference room. <!-- src: .claude/scripts/hq/arc-dash.mjs; .claude/scripts/hq/arc-face.mjs; .claude/scripts/hq/face-ops.mjs; .claude/scripts/hq/face-sessions.mjs; .claude/scripts/hq/face-module.mjs; .claude/scripts/hq/face-modules-contract.mjs; .claude/scripts/hq/lib/face/reads.mjs; .claude/scripts/hq/lib/face/work-door.mjs; .claude/scripts/hq/lib/face/session-door.mjs; .claude/scripts/hq/lib/face/ask-offline.mjs; .claude/scripts/hq/lib/face/reference/route.mjs -->
- **Recording a decision as law.** `adr-record.mjs` is the one writer of `docs/adr/` for the
  strategy room's "record an ADR" verb -- it picks the next free number in the lane's own
  century, and refuses if that number was already claimed anywhere this repository can see.
  <!-- src: .claude/scripts/hq/adr-record.mjs -->
- **The session hooks.** `SessionStart.d/90-emit.sh`, `SessionEnd.d/90-emit.sh` and
  `PostToolUse.d/90-emit.sh` leave advisory receipts as a session starts, ends, and edits a file;
  `PreToolUse.d/40-policy.sh` and `PreToolUse-edit.d/40-policy.sh` both call the same
  `policy-decide.sh`, so an interactive tool call and an edit are judged by one shared body, never
  two copies that could drift apart. <!-- src: .claude/hooks/SessionStart.d/90-emit.sh; .claude/hooks/SessionEnd.d/90-emit.sh; .claude/hooks/PostToolUse.d/90-emit.sh; .claude/hooks/PreToolUse.d/40-policy.sh; .claude/hooks/PreToolUse-edit.d/40-policy.sh; .claude/hooks/policy-decide.sh -->

### Gates and rules

- **`spine-api`** -- a repo-wide gate that runs `spine-reader-lint.sh`: outside `spine.mjs`,
  `arc-replay.mjs` and the flat `lib/` implementation files, only one named exception may open
  the raw log files directly -- `lib/policy/run-gate.mjs`, exempted because it belongs to the
  policy lane's own reducer, not this one. <!-- src: arc.gates.yaml; .claude/scripts/review/spine-reader-lint.sh -->
- **The spine's own suite** -- `tests/spine-emit.bats`, `tests/spine-reader.bats`,
  `tests/spine-replay.bats`, `tests/spine-concurrency.bats`, `tests/spine-worktree-guard.bats` and
  `tests/spine-equivalence.bats` prove the write, the read, the rebuild, the lock under
  contention, the worktree refusal, and that the JSONL scan and the sqlite index agree. <!-- src: tests/spine-emit.bats; tests/spine-reader.bats; tests/spine-replay.bats; tests/spine-concurrency.bats; tests/spine-worktree-guard.bats; tests/spine-equivalence.bats -->
- **The jobs suite** -- `tests/jobs-lint.bats`, `tests/jobs-run.bats`, `tests/jobs-panel.bats` and
  `tests/jobs-audit.bats` prove the schedule validator, the job-stub guard, the
  silence-made-visible panel, and the proving week's own instrument. <!-- src: tests/jobs-lint.bats; tests/jobs-run.bats; tests/jobs-panel.bats; tests/jobs-audit.bats -->
- **The policy suite** -- `tests/policy-lint.bats`, `tests/policy-hook.bats`,
  `tests/policy-authorize.bats`, `tests/policy-reducer.bats`, `tests/policy-promotion.bats` and
  `tests/policy-hostile.bats` prove the rulebook validator, the interactive bridge, the decision
  function, the ceiling-and-cap fold, the promotion chain, and -- in two families, static fixtures
  against `policy-lint` and runtime fixtures against `authorizeAction` -- an adversarial corpus.
  <!-- src: tests/policy-lint.bats; tests/policy-hook.bats; tests/policy-authorize.bats; tests/policy-reducer.bats; tests/policy-promotion.bats; tests/policy-hostile.bats -->
- **The ledger suite** -- `tests/ledger-close.bats`, `tests/ledger-determinism.bats`,
  `tests/ledger-money-math.bats`, `tests/ledger-parsers.bats` and `tests/ledger-pii-validator.bats`
  prove the month-close gate, that a rebuild is byte-identical, that money never touches a float,
  the two provider parsers, and that no PII reaches the spine. <!-- src: tests/ledger-close.bats; tests/ledger-determinism.bats; tests/ledger-money-math.bats; tests/ledger-parsers.bats; tests/ledger-pii-validator.bats -->
- **The face-door suite** -- `tests/face/work-door.mjs`, `tests/face/session-door.mjs`,
  `tests/face/dash-doors.mjs` and `tests/face/dash-parity.mjs` prove the two doors have no logic
  of their own and that a decision written through the face is byte-identical to one written from
  the command line. <!-- src: tests/face/work-door.mjs; tests/face/session-door.mjs; tests/face/dash-doors.mjs; tests/face/dash-parity.mjs -->
- Two of hq's own governing rules live in ADRs: the closed event-kind vocabulary, and the rule
  that a closed day cannot be edited. <!-- src: docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md; docs/adr/0029-spine-f-immutability-windows-supersedes.md -->

## The bigger loop

### A day in hq's life

1. Overnight, `day-close-roll` seals every day up to yesterday that is still open, oldest first,
   and idempotently -- running it twice on an already-sealed day changes nothing. <!-- src: .claude/scripts/hq/jobs/day-close-roll.mjs -->
2. `brief-materialize` renders today's brief into instance state, so the morning read costs
   the owner nothing to open. <!-- src: .claude/scripts/hq/jobs/brief-materialize.mjs -->
3. The owner opens the face. Every room he looks at -- Today, Inbox, Money, Spine -- is served by
   arc dash reading through the same one door, and that door keeps a local request journal (method,
   path, status; evidence, never truth) matched against the spine's own `decision.recorded`
   receipts to prove the day's use. <!-- src: .claude/scripts/hq/arc-dash.mjs; docs/strategy/plans/PLAN-face.md -->
4. He drags the playhead back to an earlier date: rooms built from the spine re-render as the
   spine stood at the end of that day, while a room built from a sanctioned file keeps showing
   that file's current content, marked "file, not log" -- a file has no usable history to replay.
   <!-- src: docs/strategy/plans/PLAN-face.md; docs/adr/1301-face-b-three-layers-one-read-door.md; .claude/scripts/hq/arc-inbox.mjs#cutToDay -->
5. He sees a request waiting in the inbox and approves or rejects it with a reason -- through
   the face's decision door, or through `arc-inbox approve`/`reject` from the command line;
   either path writes the identical receipt. <!-- src: docs/adr/1302-face-c-one-write-path-api-decide.md; .claude/scripts/hq/arc-inbox.mjs; tests/face/dash-parity.mjs -->
6. Through the day, other products keep writing their own facts onto the same spine -- a
   `commit.done`, a `review.completed`, a `revenue.received` -- each checked by the one writer and
   appended in order. <!-- src: .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/spine.mjs; .claude/scripts/hq/lib/validate.mjs#KINDS -->
7. At month's end, `arc pnl --close` requires, for each rail, either a provider export sum or a
   manually entered provider total, and blocks the close in either direction -- the spine short of
   that number, or the spine over it -- until a green reconciliation lets a `month.closed` receipt
   be written. <!-- src: docs/adr/1005-led-f-reconciliation-is-a-blocking-close-gate.md -->

Every pipeline in the company is drawn as a line on the face's own map, every human gate is drawn
as a stamp station, the inbox is the map's central interchange, and the spine itself is the ring
line that every other line joins -- a receipt landing lights the station it corresponds to and
moves that item's dot to the next one. <!-- src: docs/adr/1304-face-e-map-lines-declared-in-manifests.md; docs/strategy/plans/PLAN-face.md -->

### How it connects to the rest of arc

## Glossary

- **spine** -- the append-only log every fact in arc is recorded to; one reader, one writer, no
  bus in between. <!-- src: docs/adr/0030-spine-g-spine-is-the-only-public-api.md; docs/adr/0024-spine-a-append-only-canonical-jsonl-is-truth.md; .claude/scripts/hq/arc-event.mjs -->
- **event / receipt** -- one line on the spine: a fixed envelope of fifteen keys, one of which
  names its kind. <!-- src: .claude/scripts/hq/lib/validate.mjs#REQUIRED_KEYS -->
- **kind** -- the closed vocabulary of fact types a receipt may claim to be; 46 today, starting
  from 18, extended only by a new ADR each time. <!-- src: docs/adr/0026-spine-c-closed-event-kind-vocabulary-v1.md; .claude/scripts/hq/lib/validate.mjs#KINDS -->
- **idem** -- the fingerprint of an event's own content, used to refuse a duplicate rather than
  record it twice. <!-- src: .claude/scripts/hq/arc-event.mjs; .claude/scripts/hq/lib/spine-io.mjs#appendEventUnlocked -->
- **ULID** -- the value assigned to a receipt's own `id` field, built from the moment the event
  is written plus randomness. <!-- src: .claude/scripts/hq/lib/canonical.mjs#newUlid; .claude/scripts/hq/arc-event.mjs -->
- **quarantine** -- where a refused event goes instead of the log, counted by its refusal code.
  <!-- src: .claude/scripts/hq/lib/spine-io.mjs#quarantine; docs/strategy/plans/PLAN-face.md -->
- **supersedes** -- the field a correction uses to point at the earlier receipt it replaces,
  since nothing on a closed day may be edited. <!-- src: docs/adr/0029-spine-f-immutability-windows-supersedes.md -->
- **as-of** -- reading the spine as it stood at the end of a named day, rather than as it stands
  right now. <!-- src: .claude/scripts/hq/arc-inbox.mjs#cutToDay -->
- **playhead** -- the face's own name for that same as-of cursor: drag it back and the whole face
  becomes as-of that day. <!-- src: docs/strategy/plans/PLAN-face.md -->
- **brief** -- the deterministic one-screen render of a day, built only from the spine. <!-- src: .claude/scripts/hq/arc-brief.mjs -->
- **inbox** -- the set of `approval.requested` receipts with no matching `decision.recorded` yet,
  recomputed on every read. <!-- src: .claude/scripts/hq/arc-inbox.mjs#loadApprovals -->
- **ledger / P&L** -- money derived from spine receipts at the moment it is asked for, cached
  nowhere. <!-- src: docs/adr/1000-led-a-ledger-is-a-reader-only-derivation-layer.md -->
- **kill line / kill distance** -- a threshold a venture is measured against, and how far its own
  numbers currently sit from crossing it. <!-- src: .claude/scripts/hq/lib/ledger/kill-distance.mjs -->
- **rail** -- one payment provider account settling into one currency; each rail reconciles
  against its own total separately. <!-- src: docs/adr/1005-led-f-reconciliation-is-a-blocking-close-gate.md -->
- **policy ceiling / cap** -- the ceiling: declared by a human in `hq.policy.yaml`, changed only
  by a reviewed repo edit; the cap: derived by folding transition events in spine append order;
  the effective level is the smaller of the two, recomputed at every authorization.
  <!-- src: .claude/scripts/hq/lib/policy/reduce.mjs -->
- **L2 / arc dash** -- the one read door and one decision door standing between the spine and the
  browser app. <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md; .claude/scripts/hq/arc-dash.mjs -->
- **L3 / the face** -- a React and TypeScript web app; it never touches files or reads the spine
  directly. <!-- src: docs/adr/1301-face-b-three-layers-one-read-door.md; docs/strategy/plans/PLAN-face.md -->
- **work door** -- plans an op, then applies exactly what the plan showed: what the owner reads
  on the plan card is exactly what the click runs. <!-- src: docs/adr/1326-fv2-i-work-door-two-phase-no-logic-of-its-own.md; .claude/scripts/hq/lib/face/work-door.mjs -->
- **session door** -- starts a judgement session (a council, a review, a phase close) and lets the
  face attach to its output while it runs. <!-- src: .claude/scripts/hq/lib/face/session-door.mjs; .claude/scripts/hq/face-sessions.mjs -->
- **request journal** -- the door's own local record of method, path and status for most calls --
  a successful pulse or run-poll read is not journalled, though its refusal still is -- matched
  against spine receipts to prove the dogfood requirement, never treated as the truth the spine
  already holds. <!-- src: docs/strategy/plans/PLAN-face.md; .claude/scripts/hq/arc-dash.mjs -->
- **ring / room** -- the face groups every room into one of five rings -- the command ring, the
  kernel ring, the factory ring, the money ring, and the company ring; hq's own room, `spine`,
  sits in the command ring. <!-- src: initiatives/face/evidence/phase-03/not-served-command.md; docs/adr/1340-fv2-kernel-ring-effects-proposal-branches-and-evolve-wiring.md; docs/adr/1341-fv2-factory-ring-the-owners-own-tree-and-the-law-files.md; docs/adr/1342-fv2-money-ring-revenue-by-hand-kill-as-a-question-venture-as-a-branch.md; docs/adr/1343-fv2-company-ring-a-status-is-a-header-a-word-is-a-contract-edit.md; initiatives/face/contracts/rooms.generated.json; products/hq/manifest.json -->
