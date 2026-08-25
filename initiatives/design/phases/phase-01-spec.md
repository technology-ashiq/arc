# Phase 01 — eyes + viewports + canvas gate

**Goal (one line):** the composer renders its own variant, reads the PNG back with vision and
revises it up to three times with immutable receipts — and every surface the brief declares is
rendered and correctly classified as product canvas or documentation.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**Implements:** ADR-1401 · ADR-1403 · ADR-1407 · ADR-1415

## Exit criteria (Definition of Done)

**REQ-02 — the composer sees its own work**

- [ ] `ui-composer` gains exactly one scoped Bash entry point — `design-render.sh` and nothing
      else. It has `tools: Read, Glob, Grep, Write` today and no Bash at all
- [ ] Iron law 1 gains the enumerated read allowlist of
      [ADR-1415](../../../docs/adr/1415-the-composer-iron-law-gains-a-read-path-allowlist.md):
      its own session's renders and the brief's refpack. Every existing prohibition survives
      verbatim — another variant's dir, the matrix, the brief file, product files
- [ ] That allowlist is enforced by a **named technical mechanism** — a PreToolUse Read hook or
      a permissions path rule — **not by prompt prose alone**. `ui-composer` today declares
      `tools: Read, Glob, Grep, Write`, which is unscoped Read: iron law 1 is currently obeyed
      only because the agent chooses to. Without a mechanism the negative control below tests
      compliance, not refusal, and a stated control is not a control
- [ ] Loop runs compose → render → read own PNG with vision → revise, capped at **3 iterations**;
      a 4th refuses. An `unchanged: true` iteration **still consumes a slot** — stated, not left
      implicit, because a composer that no-ops once has 2 real attempts left and the assumptions
      ledger's catch-rate trigger must be read against that reduced budget
- [ ] Iteration outputs are immutable at `self-review/iter-N/{render.png, meta.json}`, with a
      per-variant manifest carrying input sha · output sha · defect claim · revision reason
- [ ] ≥1 self-caught defect is visibly fixed across iteration receipts on a real run — provable
      from the shas, not narrated
- [ ] A no-op revision records `unchanged: true` (Phase 00's discriminator) rather than refusing

**REQ-03 — declared-surface fidelity**

- [ ] Viewport set derives from the brief's platform contract: desktop 1440×900 always, mobile
      390×844 when the contract declares mobile `yes`
- [ ] The critic judges every rendered viewport; a **declared-but-unrendered surface blocks PASS**
- [ ] Per-explore surface manifest + `data-arc-doc-surface` markers classify each surface
- [ ] A planted docs-on-canvas page (state matrix + keyboard tables) returns a deterministic ERR
- [ ] A legitimate product page containing the word "Reference" **passes** — the ₹-entity
      over-refusal precedent
- [ ] An **unmarked** surface fails closed

**Both**

- [ ] Negative control: a composer attempting to read a **sibling** variant's render is refused
- [ ] Two-surface adversarial pass by fresh agents on the doc-surface gate and the allowlist,
      holes fixed and pinned as fixtures
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked
- [ ] contract tests green against fakes
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/design-composer-eyes.bats tests/design-surface-gate.bats`
- **Expected failure first:** in `design-surface-gate.bats`, `doc_surface_on_product_canvas_errs`
  fails RED with `expected ERR, got PASS` — no marker vocabulary exists yet, so the planted page
  is indistinguishable from product work; and `page_saying_reference_passes` must be RED-then-green
  as the paired negative control, since a gate that only proves it refuses has not proved it
  discriminates. In `design-composer-eyes.bats`, `sibling_render_is_refused` fails RED with
  `expected refusal, got file contents`, because until the allowlist exists the composer's Read
  tool has no path restriction at all. Observing all three RED is the phase's entry condition.
- **Live demo scenario:** run one explore on the `lexos-case-workspace` brief with mobile
  declared `yes`. Expect per variant: 2 viewports rendered per iteration, up to 3 iteration
  directories, a manifest whose iteration-2 entry names the defect iteration-1's PNG showed.
  Open iteration-1 and iteration-2 PNGs **by hand** and confirm the named defect is visibly
  fixed — the verdict is not taken from the manifest's own prose.
- **Real-system check:** confirm `.claude/state/design/renders/` holds one session per variant,
  and that `self-review/iter-2/meta.json` references `iter-1`'s output sha as its input.
- **Expected evidence:** CI bats output per JOB, the iteration manifests, the two hand-opened
  PNGs, and the refused sibling-read transcript, to `initiatives/design/evidence/phase-01/`.

## Rabbit holes in this phase

- **Relaxing iron law 1 to "do not read another variant".** That silently re-permits the brief
  file and product files. Detour: enumerate the two allowed paths, change nothing else.
- **Perfecting the marker vocabulary.** Detour: two markers, fail closed on unmarked, let the
  first real explore report what is missing.
- **Letting the manifest narrate the fix.** A prose claim is not evidence. Detour: input sha,
  output sha, and a human opening both images.

## Out of scope for this phase

Reference packs and the curator (Phase 02) — the composer's pack-read path is built here but has
nothing to read until Phase 02 · pack-anchored BELOW-BAR (Phase 03) · any live external source.

## Your-setup / pending

None — the renderer and agent-browser are already installed.

## Non-negotiables (verbatim from PLAN)

- **Look at the artifact before carrying its verdict.** No ranking, score, receipt or package
  is produced from a report about pixels that nobody in the session opened.
- **Zero new spine event kinds.** This cycle rides `review.completed {lens:design}`,
  `decision.recorded` and `note.logged` only.
- **Agents judge, scripts measure — ADR-0048.** A gate never asks an agent for a number it
  can compute.
- **Every new gate, lint and parser gets a two-surface adversarial pass by fresh agents that
  did not write it** — one on decision logic, one on the shell/OS boundary — and that pass runs
  against the PR THAT SHIPS THE GATE, never batched into the phase-close PR that comes after
  all of them. The attacker prompt carries this lane's running list of already-fixed defects.
- **A test that passes proves the assertion held, not that the code ran.** Every gate ships with
  a negative control that actually fails.
- **No reference image, rival draft or third-party screenshot is ever committed to git or
  placed in an outbound package.**
- **A `model:` frontmatter change is a governed tier change** citing ADR-0069 in a reviewed
  diff, never a quiet edit.
- **Shared organs are edited under the shared-file protocol.** Agent contracts under
  `.claude/agents/`, `.mcp.json`, `hq.policy.yaml` and `tests/**` belong to no lane:
  `git log origin/main -5` on the file runs BEFORE the edit, the stronger version is taken at
  merge, and a change to a contract another LIVE lane reads gets a cross-lane note first.
- **Closing a phase moves the lane's bookkeeping in the same commit as the merge, or the one
  right after it.** PROGRESS.md's row, its `## Now`, and `docs/HISTORY.md` move together — a
  lane whose HISTORY says CLOSED while PROGRESS still says LIVE is a failure, not a follow-up.
- **Tests are green on CI, per JOB, at the branch head SHA** — never on this box.
