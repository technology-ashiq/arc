# ADR 1341 — The factory ring: the owner's working state, the law files, and two verbs that only ask

**Status:** accepted
**Date:** 2026-09-19
**Product:** face (with additive changes in develop, design, engine, core and council, under ADR-1339 and ADR-1340)
**Reversibility:** two-way
**Revisit trigger:** an owning lane rejects one of the additive changes below → that verb becomes a residue row
(ADR-1339); `.claude/settings.json` stops being an un-grantable target (ADR-0502 amended) → the profile switch can
become a proposal branch instead of a request.
**Provenance:** Phase 05 PR 4 (ADR-1339) carries the factory ring's eight verbs:
- develop slice
- design open brief
- send-to-council
- record pick
- pin tool
- switch profile
- terminate
- add agent

ADR-1340 decided the kernel ring's effects. Four of these eight raised a question that ADR does not answer.

## Context

ADR-1340's rule is that a file change is a proposal branch, never an edit in place. That rule fits a change to a
law file the owner reviews, such as the router, a policy or a report. Four of the factory verbs do not fit it
cleanly:

1. **develop's slice ledger.** `phases/phase-NN-tasks.md` is the build session's own working state. The develop
   harness writes it, and the session reads it in the owner's checkout on every step. A branch the session is not
   on would fork the ledger from the tree that uses it.
2. **The design explore scaffold** "lives on the phase branch" by its own design (design-explore.sh). Nothing merges
   before the pick.
3. **The strictness profile** is `.arc.profile` in `.claude/settings.json`. That file is an un-grantable target
   (ADR-0502), so no machine path writes it, a proposal branch included.
4. **Terminating a hire** "is a repo edit citing this comment" (engine/router.yaml). Nothing terminates a hire at
   run time.

## Decision

Every verb below keeps ADR-1340's bound apply. The plan prints, as its LAST line, the digest of everything the apply
writes. The door appends `--expect <digest>` to the apply, and the tool re-derives the digest and refuses
`PLAN_STALE` on a mismatch. A tool refuses an apply that carries no `--expect`, by hand as by the door. The one
exception is develop's own unbound `next`, which is the harness's existing command (§1).

Every branch-writing tool:
- names its branch with `proposalBranch()`
- judges its approval, with the real commit, in `writeProposal({ beforeRef })` before the ref exists
- carries the writer's case, temp and config-hook refusals

That is the PR 3b fixed-defects set, applied here from the start.

### 1. A lane's own working state is written in place, by its own harness, on the owner's click

`develop.slice` runs `develop.mjs next --lane <lane>`. That is the harness handing out the next slice and recording
its Context Pack on the slice's `sources:` line, exactly as a hand-run does.
- **The plan** is `next --dry-run`. It reports the slice and the pack, writes nothing (no ledger, no receipt), and
  prints the digest.
- **The digest** covers the lane, the ledger's path, the phase, the slice, and the sha256 of the ledger before and
  after the write.
- **The apply** is `next --expect D`. It re-reads everything, refuses `PLAN_STALE` if the ledger moved, and writes
  exactly the planned text. It then emits the `slice.done` an unbound run emits, and its own receipt:
  `note.logged {note: "develop.next", lane, phase, slice, recorded}`.
- **With nothing left to hand out,** a bound run refuses (exit 2): a plan that would write nothing is not a plan. The
  unbound `next`, which is `/arc-develop next`, keeps its old behaviour.

The row declares `touchesTree: true`, which means an effect on the owner's working tree. It is human-run, and a sim
door refuses it (`SIM_EFFECT`); the work-door suite derives the flag from the apply script, both ways. This is the one
exception to "never in place". It applies only to a tracker file the lane's own harness owns and already writes by
hand. It is never a law file, never another lane's file, and never anything outside the lane's tracker.

### 2. The explore scaffold is a proposal branch: the explore's own branch

`design-studio.open-brief` runs `design-explore.sh init <id> --brief <path> --out-dir <scratch> --base <main12>`. It
scaffolds into a scratch directory, against main's commit, because the branch is cut from main. The script gains
`--out-dir` and `--base`, both additive and strictly checked, and its `init` now refuses an argument it does not know.
It used to skip unknown arguments, so a `--dry-run` would have scaffolded for real.

`design/open-brief.mjs`:
- reads the brief from MAIN, and refuses one main does not hold
- commits the scaffold to `feat/face-design-explore-<id>` through the proposal-branch writer: `explore.txt`,
  `base-revision.txt`, and one `tokens.css` for each of the three variants
- raises `approval.requested {gate: "design-explore", explore, brief, branch, base, commit}`

The director and the composers work on that branch; the pick decides it.

### 3. The profile switch asks, and the owner edits

`factory.switch-profile` is `core/profile-request.mjs --to T --why W`, bound. It reads the profile in force the way
every gate does (`arc-profile.sh`), refuses a switch to that same profile, and raises `approval.requested` with:
- gate `profile`
- `from` and `to`
- `why`, which is required
- ADR-0008

Nothing writes `.claude/settings.json`: ADR-0502 makes it un-grantable, and this ADR does not route around that. The
approval is the record that the owner asked. The edit is his.

### 4. Terminate and add agent are proposal branches, like driver switch

**`executor.terminate`** is `engine/propose.mjs retire --class C`.
- An ended hire goes back to the router's own DEFAULT driver, read from the file. Its tenure terms (`cap`, `hosted`,
  `judge`, `review_by`) leave its row, together with the comments written directly above them.
- The class itself stays: arc-run, its process and the policy still name it.
- It refuses a class that is not a hire, and takes no `--to`.
- The router's own loader is re-run over the result, and the approval's gate is `router-merge`.

**`agents.add-agent`** is `engine/agent-scaffold.mjs`. It lives in the engine product: it reads the router's `tiers`
and `models`, and core does not ship the YAML reader. It writes the FOUR files one agent needs, so main stays green
when the branch merges, each computed from main's own bytes:
- `.claude/agents/<name>.md`: frontmatter (name, description, tools, model) and a body stub that names the tier. The
  model is the tier's v1 claude-code mapping in the router's `models` table (ADR-0069), and a tier with no mapping is
  refused.
- `products/<product>/manifest.json`: the file appended to the product's `agents`. Only a product that already ships
  agents is offered, because those are the bare-install products the golden holds.
- `tests/fixtures/sync-golden/tree-manifest.txt`: its line, the sha256 of the bytes with CR stripped, in byte order.
- `initiatives/face/contracts/expected-set.json`: its room in `agents.map`, a room that already seats an agent, with
  the census in the `$comment` moved by one.

The approval is `{gate: "agent-roster", adr: "ADR-0069", agent, tier, model, room, product, ...}`.

The branch writer's allow-list is closed per tool:
- propose: `engine/router.yaml`
- agent-scaffold: the four files above
- open-brief: `docs/design/explore/<id>/**`, the files the scaffold makes

### 5. The rest are receipts

- **`toolbelt.pin-tool`** is `note.logged {note: "toolbelt.pin", tool, action}`, an emit whose dry run is the plan
  (the capture-idea shape).
  - The toolbelt module reads `/api/spine?kind=note.logged&note=toolbelt.pin`. The `note` filter is additive and
    needs `kind=note.logged`.
  - It replays pins and unpins in order and draws pinned tools first.
  - The pending card said exactly this: "a pin is a receipt, so the room remembers".
- **`council-chamber.send-to-council`** raises `approval.requested {gate: "council", question, why?}`. The question
  waits in the inbox for the council to convene, which is a SESSION verb (Phase 06), so the "Convene the council"
  card stays pending. The council's verdict answers the question.
- **`design-studio.record-pick`** is `design/pick.mjs --explore <id> --pick a|b|c --why W`, bound.
  - It checks the explore is on this checkout with its three variants, the picked one built.
  - It refuses a second pick: a PICK.md, or a design-pick approval already on the spine.
  - It raises `approval.requested {gate: "design-pick", explore, pick, why, variant_sha}`.
  - The digest binds every variant's bytes, so a variant rebuilt after the owner looked is a new plan.
  - The owner's stamp is the pick. It writes no file.

## Consequences

**Easier.** Every factory verb runs its lane's own tool. Only two families of effect remain: a proposal branch, or
the lane's own tracker in place. A sim door refuses both. Four verb-pending cards retire:
- Submit a surface
- Switch the profile
- Terminate a hire
- Add an agent

Convening, critique and the jury, hiring, dispatch, and closing a phase stay pending as session verbs (Phase 06).

**Harder.**
- The profile switch is a request, not a switch, and the owner still edits settings by hand. That is the cost of
  ADR-0502, and it is kept.
- develop.slice is the first op that writes the owner's tree, so its fixture holds the write to the ledger file
  alone: nothing else in the tree moves (tests/face/factory-ring.mjs, in a scratch tree).
- An agent added through the door carries a body stub. Its method is written on the branch before anything invokes
  it.

## Amendment, 2026-09-19: what PR 4's two attackers found

A fresh pair found 30 defects (15 logic and 15 shell, several of them the same). Every one is fixed and pinned. Four
change decisions above:
- **§1, the write in place:** develop's bound apply holds a per-ledger lock and re-reads the ledger immediately before
  an atomic write, refusing PLAN_STALE on any change. The ledger must resolve inside the repo and match the phase the
  lane's header names. The receipt is judged before the write, and a plan that would write nothing is refused.
- **§2, open-brief:** refuses an explore that main holds anywhere under its folder. `design-explore.sh --out-dir`
  consults neither the tree's brief nor its explore, and takes only a new folder outside the repo.
- **§4, add-agent:** the branch carries what the contract derives (`rooms.generated.json`, any face: section), made by
  `face-sections deriveFromContract`, so it is green when it merges. Its JSON edits are structural, over canonical
  files, and the description is written quoted.
- **The door:** a bound or emit-plan plan whose last line the page cannot show is not held (PLAN_HIDDEN, 422).

The rest are twins of fixed rows:
- pick and profile-request check and emit under `withExclusiveLock`
- the spine query reports unreadable day files
- payloads name agents and explores by file or folder
- retire compares the parsed router
- selects are read when asked
- the codegraph test doors are refused
- bash is run bounded
