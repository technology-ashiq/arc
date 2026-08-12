# Phase 04 — The law, and proof the hands exist

**Goal (one line):** Merge the policy that makes a runtime legible, then prove on this machine that the chosen runtime actually runs headlessly and returns something arc can parse — or fire the STOP here, at 1 day burned.
**Appetite:** 1 day — blown appetite means cut or kill, never a silent extension.
**Depends on:** phase-00

This is the cycle's steel thread. It is deliberately **not** a paper phase. The design source's Phase 0
was law only; this lane's previous cycle then closed with its central claim unproven because nothing
runnable was installed and no credential existed — discovered at Phase 03, after the whole cycle had
been spent. REQ-00 exists to move that discovery to day 1.

**"The owner" throughout this spec means Ashiq.** Every step below that says *the owner* is a human
act arc does not perform.

## Exit criteria (Definition of Done)

- [ ] **The mandate is on the spine, as TWO events, in this order.** `decision.recorded` cannot stand
      alone: its payload shape is **closed to `decides` / `verdict` / `reason`**, `decides` must be the
      ULID of the `approval.requested` it decides, `verdict` is exactly `approve` or `reject`, and
      `reason` is a non-empty string. A standalone `decision.recorded` naming the mandate in free text
      would be rejected and **silently quarantined while the emitter still exits 0** — this lane's own
      recorded failure. So:
      1. `bash .claude/scripts/hq/arc-event.sh emit approval.requested --payload JSON` — the request
         carries the Build-out Mandate of 2026-08-09 as what is being authorised. `approval.requested`
         is generic except for a few reserved `subject:` values, so a plain descriptive payload is
         accepted. Capture the printed ULID.
      2. `node .claude/scripts/hq/arc-inbox.mjs approve THAT_ULID --reason "..."` — **not** the raw
         emitter. Beyond the closed payload shape, the validator enforces
         `decision.idem == sha256("decision.recorded|" + decides)`: the idem is **welded** to the
         approval it decides, and `arc-event.sh emit` does not compute it. A raw emit is rejected
         `BAD_DECISION` and quarantined. `arc-inbox approve` computes the welded idem and is the only
         supported path.
      **Then verify both landed**: each ULID must appear in a file under `.claude/state/hq/events/`
      and **not** under `.claude/state/hq/events/_quarantine/`. Exit 0 from the emitter is not
      evidence. Record both ULIDs in the evidence bundle as `mandate-ulid.txt` — Phase 07's router-row
      comment cites the decision one.
- [ ] **ADR-0212 is merged to `main`.** The file already exists at
      `docs/adr/0212-exe-e-an-agent-runtime-occupies-the-model-seat-amending-adr-0069.md` and its
      `**Status:**` line already reads `accepted` — *accepted* is the decision's status, recorded at
      kickoff; *merged* is this phase's act of landing it on `main` through a reviewed PR. The two are
      not the same and neither implies the other. **This is the cycle's first act: it lands before any
      `router.yaml` row exists**, because a routing row for a runtime is meaningless until the policy
      says what a runtime is.
- [ ] **The owner starts Docker Desktop** and the daemon reports healthy (`docker info` returns a
      server version rather than the pipe error it returns today).
- [ ] **Hermes Agent is obtained as a CONTAINER IMAGE, pinned by digest — never via the host
      installer.** Tag `v2026.8.3` carries **no release assets**, its npm and PyPI channels were
      retired in that very release, and the `install.ps1` / `install.sh` scripts are not tracked files
      at that tag — they are served live from the docs site and default to *latest*. So a
      `curl`-piped host install would be both unpinnable and the riskiest available shape for a
      runtime with a contested security record. The image digest is the one content-addressable handle
      the vendor offers (ADR-0209 amendment). The **exact image reference and the resolved digest** are
      read from the vendor's current documentation at
      `https://hermes-agent.nousresearch.com/docs` / `https://github.com/NousResearch/hermes-agent`
      and **recorded** in the evidence bundle as `install-method.md`, together with the exact command
      run. Guessing an install command into a spec is how a fabricated artifact enters a repository;
      reading it from the vendor and writing down what was run is the honest form. **If no container
      channel exists, that is an EXE-A finding and the STOP fires** — an unpinnable runtime is refused
      by a pin-required class.
- [ ] **A container-backed execution backend is configured, and the bare `local` backend is not
      used.** Which backends exist and how one is selected is likewise read from the vendor docs
      above; the chosen backend, the exact config file path, and its content hash are recorded in the
      evidence bundle as `backend-config.md`. That file also states, in one line, that the `local`
      backend is not in use — the record ADR-0208 requires.
- [ ] **The runtime and every skill it needs are admitted through the existing vetting path**, never a
      parallel one: `bash .claude/scripts/develop/capability-vet.sh` (the same gate `/arc-capability
      --vet` drives), which BLOCKs unless the candidate is on
      `.claude/scripts/develop/capability-allowlist.txt` — today a **one-line file containing only
      `madge`**, so admitting anything here is a visible, reviewed act. Both files change: the
      allowlist gains the entry, and `.claude/scripts/develop/capability-lock.json` gains a row in the
      shape already there, carrying `name`, `registry`, `version`, `hash`, `publisher-auth`,
      `build-attestation`, `checked`, `source` and `class`. **The owner's OK for anything
      write-capable is recorded in that row's `class` field**, in the existing format —
      `write-capable (human OK recorded: ashiq YYYY-MM-DD)` (ADR-0209, extending ADR-0110). The OK is
      **asked for at vetting time**, not inherited from the plan approval — approving a plan is not
      approving a specific artifact's hash — and `YYYY-MM-DD` is **the date vetting actually ran**,
      never the mandate date.
- [ ] **One live headless invocation** returns stdout that `JSON.parse` accepts. The prompt is a
      committed fixture at `tests/fixtures/engine/hermes/smoke-prompt.txt` — one short deterministic
      instruction whose answer is a small JSON object, pinned so the run is repeatable and so nobody
      re-types it. **The run targets the local `ollama` endpoint already serving on
      `http://localhost:11434`** — zero spend, no credential, and no uncapped key is ever used. The
      documented config is `model.provider: custom` with
      `model.base_url: http://localhost:11434/v1` — **the `/v1` suffix is required** — and from inside
      a container the host endpoint is reached as `host.docker.internal` rather than `localhost`.
      **Ollama must also be restarted with `OLLAMA_CONTEXT_LENGTH=64000`**: it defaults to as little
      as 4,096 tokens while this runtime expects ≥64,000, and the failure mode is silent truncation
      rather than an error — a smoke run that looks green while the model never saw its whole prompt.
      All of it is confirmed against the vendor docs at run time and recorded in `backend-config.md`. **If the runtime cannot target a local
      endpoint**, this criterion instead names the credential it does use, and that credential is the
      capped key provisioned below — never an uncapped one.
- [ ] **The invocation's exit code is recorded as observed** and compared against the real three-code
      driver map, `0` ok / `1` driver-fail / `2` budget-declined (ADR-0219,
      `docs/adr/0219-the-data-boundary-is-refused-above-the-driver-and-eng-ds-exit-map-stands.md`).
      Any divergence is written down rather than reconciled by hand. A process that writes its answer
      and then **fails to exit** is a divergence of the most serious kind and is recorded as one.
- [ ] **The OpenRouter capped key is provisioned here, not in Phase 07.** Certification fixtures 4 and
      10 need a live capped credential — an env audit needs a key to audit, an exhaustion test needs a
      key to exhaust — and a Phase-06 certification that STOPped for want of a credential would fire
      the kill criterion for a scheduling bug rather than a real isolation gap. REQ-05 still closes in
      Phase 07; only the issuance moves. **The ceiling figure is the owner's and is not invented**
      (ADR-0213, assumption A-05): it is recorded on the spine before the key is issued, as the **same
      two-event pair** the mandate uses — `approval.requested` carrying the proposed ceiling, then
      `decision.recorded` citing that ULID with `verdict: approve` — and both ULIDs go in the evidence
      bundle as `key-ceiling-ulid.txt`. Until the owner names the figure, this criterion blocks and
      says so.
- [ ] **`.env.example` gains five rows**: the runtime's capped key as `ARC_HERMES_API_KEY`, plus the
      four `ARC_LLM_*` rows the existing `generic-api` driver already reads but which the file has
      never documented — `ARC_LLM_ENDPOINT`, `ARC_LLM_API_KEY`, `ARC_LLM_MODEL`, `ARC_LLM_TIMEOUT_MS`
      (ADR-0211). No key value is ever printed or committed.
- [ ] **The enforcement layer for each of REQ-02's twelve certification fixtures is named on paper**
      and written to the evidence bundle as `fixture-enforcement-map.md`, one line per fixture, each
      naming exactly one of: `container` · `arc-run` · `shim` · `provider` · `config`. The twelve, so
      this phase needs no other file to do it: **1** repo write from the runtime workspace blocked ·
      **2** `internal-only` input refused before the runtime starts · **3** `internal-only` input
      against a `hosted: cloud` row refused at routing · **4** env audit inside the workspace shows
      only the runtime's own capped key · **5** planted fake key absent from every artifact · **6**
      path traversal and symlink escape blocked · **7** live egress config matches its pinned hash,
      plus a behavioural arm where a disallowed outbound connection actually fails · **8** marker
      planted in run N unrecallable in run N+1 · **9** hostile output produces schema-fail, one
      same-tier retry, then a proposal receipt · **10** exhausted capped key produces `fail`/`budget` ·
      **11** wall-clock overrun stops at the budget line · **12** unpinned runtime refused by a
      pin-required class. **Any fixture whose only honest layer is "would need netns, seccomp or a VM"
      is written down as UNPROVABLE here**, on day 1, rather than discovered at day 4.5 inside the
      STOP-gated phase. This is a half-hour exercise and it is the cheapest tripwire in the cycle.
- [ ] tests added & green **on CI, read per-JOB** (`gh run view <ID> --json jobs`), with the run's head
      SHA confirmed equal to local HEAD. A new `tests/*.bats` file is **auto-discovered** by CI's
      `find tests -name '*.bats'`, so no workflow edit is needed. Two bookkeeping acts are still owed,
      and both have exact mechanics:
      - **`tests/shard-timings.json`** — its `timings` object maps `"NAME.bats"` to an integer of
        **windows-runner wall-clock seconds**. A file with no entry silently rides `_default_weight`
        (16) and the shard plan then reads as balanced while it is not. Get the real number by
        re-running the `weigh-tests.yml` workflow and pasting its emitted block; a hand-picked weight
        is a guess wearing a measurement. If it stays unmeasured, it **must** be named and counted in
        the file's `_known_gap` string, because a missing entry is a default rather than an error.
      - **The test-count floor** in `.github/workflows/ci.yml` — derive the new number with
        `grep -rhc '^@test ' tests/ --include='*.bats' | awk '{s+=$1} END{print s}'` and raise the
        `[ "$n" -ge NNN ]` comparison to match. Raise it to reality; never lower it to make a red
        build green, and never hand-type a count without re-deriving it.
- [ ] tracker updated: the Phase 04 row in `initiatives/engine/PROGRESS.md`'s phase table flips to ✅,
      a dated entry is appended to its `## Done log` section, and its `## Now` block is rewritten to
      point at Phase 05.
- [ ] **STOP condition, one clock.** The clock **starts when the phase opens** —
      `/arc-develop start 4 --lane engine` — and one day means **one working day of burn as recorded
      in `initiatives/engine/PROGRESS.md`**, the same unit every appetite in this repo uses, not 24
      wall-clock hours. If the live headless invocation has not succeeded by the end of it — for any
      reason: the daemon never started, the runtime would not install, the container backend would not
      configure, or it will not return parseable output — record **"no eligible runtime yet"** per
      ADR-0208 (`docs/adr/0208-exe-a-the-runtime-is-hermes-agent-pinned-and-container-backed.md`),
      close the cycle, and the build-out moves to the next module. This is a designed outcome, not a
      failure. **The evaluation is recorded either way**, as a line reading
      `STOP evaluated: fired` or `STOP evaluated: did not fire, because X`, written into **both**
      `smoke-result.md` and the `## Done log` entry in `PROGRESS.md`.
- [ ] **What happens if the smoke run succeeds but an owner act is still outstanding.** The capped-key
      criterion depends on the owner naming a ceiling figure, and a missing keystroke is **not** "no
      eligible runtime" — it is not an EXE-A signal and must never fire the STOP. So: if the live
      invocation has succeeded, **Phase 04 closes**, and the key criterion is carried forward as
      **Phase 06's entry gate**, because fixtures 4 and 10 are the first things that actually need the
      credential. The carry is written into the done-log rather than left implied. Phase 04 does not
      sit open waiting on a human, and the cycle does not stall on one.

## Verification plan

- **Test command:** `npx bats tests/engine-hermes-smoke.bats`
- **Expected failure first:** the test `phase-04 smoke evidence parses as JSON` fails with
  `initiatives/engine/evidence/phase-04/smoke-run.json: no such file` before the runtime is installed
  and invoked. It must fail for *that* reason — the test asserts the file exists, asserts it is
  **non-empty**, and asserts `JSON.parse` succeeded on its contents. It never asserts merely that some
  string is absent, because an assertion shaped "output does not contain X" is satisfied by a crash.
- **Live demo scenario:** with the Docker daemon up, invoke the runtime headlessly on
  `tests/fixtures/engine/hermes/smoke-prompt.txt` from a clean shell. Observe JSON on stdout, a written
  usage sidecar, and a process that **exits on its own** rather than hanging. Print the exit code.
  (A runtime that must be force-killed cannot honour any exit contract — that is precisely why the
  alternative candidate was rejected.)
- **Real-system check:** after emitting the mandate, list **both** `.claude/state/hq/events/` and
  `.claude/state/hq/events/_quarantine/` and confirm which one holds the ULID.
- **Expected evidence:** `initiatives/engine/evidence/phase-04/` holding exactly —
  `smoke-run.json` (the captured stdout) · `smoke-usage.json` (the runtime's usage sidecar, copied) ·
  `smoke-result.md` (wall-clock in seconds, observed exit code, and the ADR-0219 comparison) ·
  `mandate-ulid.txt` · `key-ceiling-ulid.txt` · `install-method.md` · `backend-config.md` ·
  `fixture-enforcement-map.md` · `capability-lock.diff` (the vetting diff).

## Rabbit holes in this phase

- **Making the runtime do something useful.** The smoke prompt is fixed and trivial on purpose. Draft quality is Phase 08's question; this phase asks only whether the process starts, answers and exits.
- **Building sandbox infrastructure.** This phase *configures* a container backend. If it turns out to need netns or seccomp engineering, that is the A-04 trigger and it belongs to Phase 06's STOP, not to a heroic day here.
- **Getting the amendment perfect.** ADR-0212 is one paragraph. It is already written; this phase merges it.
- **Widening the allowlist.** One entry goes in for the runtime and one per skill it genuinely needs. An allowlist that grows to make an install convenient has stopped being a control.

## Out of scope for this phase

The shim itself (Phase 05) · the certification suite's fixtures, which are only *classified* here, never built (Phase 06) · the router row and policy row (Phase 07) · the draft process and any real job (Phase 08). No adversarial pass is owed by this phase: it ships no parser, gate or shim of its own.

## Your-setup / pending

- **The owner must start Docker Desktop.** Docker is installed on this machine and its daemon is currently down. Nothing in this phase can be certified without it, and on a GUI-launched daemon this human step is the likely time sink inside a hard-STOP phase.
- **Hermes Agent must be installed** at tag `v2026.8.3`. Neither it nor the alternative candidate is on this machine today.
- **The owner must name the OpenRouter capped-key ceiling figure, and the owner issues the key** — key issuance stays a human act in v1 (ADR-0211) and arc never vends one. It is deliberately not invented (ADR-0213, assumption A-05).
- **The wait protocol for all three owner acts is the same, and it is the appetite itself.** There is no polling loop and no separate timeout: work continues on everything that does not depend on the outstanding act, and the phase's 1-day clock keeps running. Starting Docker and installing the runtime gate the smoke run, so if they do not happen the STOP fires on schedule. The ceiling figure gates only the key, which by the criterion above carries to Phase 06 rather than holding Phase 04 open.

## Non-negotiables (verbatim from PLAN)

- ENG-D's **driver-level** contract is untouched and the runtime adapts to arc, never the reverse — `common.mjs`'s exit map stays `0` ok, `1` driver-fail, `2` budget-declined, and this cycle adds nothing to it (ADR-0219).
- The data boundary is refused **above** the driver, at the arc-run layer, exit `5`, before the runtime process starts (ADR-0219). The arc-run exit space is separate from the driver's and already uses `0`/`1`/`2` for its own failures, so ADR-0219 publishes the full arc-run table before any fixture asserts `5`. The mechanism is built in Phase 06 because REQ-02's fixtures 2 and 3 assert it; specs for earlier phases carry this bullet as a forward commitment, not a claim already true.
- Certification means the REAL runtime, human-started, with receipts attached; a mock-green run is labelled regression and never certification, and that label is asserted by a test rather than written by hand. No green suite, no dispatch.
- Every gate, parser and shim this cycle ships gets an adversarial construct-a-breaking-input pass **before the PR that ships it merges** — never deferred to the phase close, because a rule only the close can enforce gets skipped for a whole phase. TWO fresh agents on different surfaces (decision logic, and the shell/OS boundary), neither having seen the implementation, attacking the **fixtures and tests as well as the code** — a green suite the author wrote is evidence about the author. Every hole is pinned as a fixture, and the attacker's prompt carries this cycle's running list of already-fixed defects with the instruction to check each one in every OTHER file. This binds REQ-04's router loader, REQ-06's boundary refusal and the POL-I birth-lint exactly as it binds REQ-01's parser.
- Every gate ships with a negative control that actually runs and proves the check can fail; a pass condition that is only an absence is not a pass, and a probe that shells out asserts it RAN before asserting what it printed.
- No component changes a model tier at run time; every production routing change is a reviewed `router.yaml` diff citing ADR-0069, and escalation ends in a proposal receipt (ADR-0204). Runtimes never self-register.
- The L1-drafts ceiling and the human publish gate are absolute. A draft that publishes itself is an incident, and publishing is a human copying it out — always.
- arc constrains boundaries (data in, actions out, money, time) and verifies outcomes; it never prescribes the runtime's method, model choice, or reasoning style. Review is accept/reject plus one line, never a line-edit (ADR-0218).
- Zero new event kinds; the closed vocabulary is derived by query, never by a remembered count. Every emit is VERIFIED to have landed in `events/` and not in `_quarantine/` — exit 0 from a fire-and-forget writer is not evidence anything was written.
- An unavailable cost, duration or fingerprint field stays absent — never estimated, never inferred, never interpolated (ADR-0069 b5, Constitution E3). Budgets are calibrated from recorded receipts, never guessed.
- Money is capped at the credential, and the honest claim is that the request crossing the ceiling completes while every later one is refused — no zero-overshoot claim is made anywhere.
- Human-started runs only this cycle. No daemon, no runtime-side cron or webhook pointed at arc, no unattended execution.
- The 3 pilot processes' pinned baselines are another cycle's evidence and are never regenerated; any file the sync-golden manifest hashes gets a named regeneration step that diffs the delta first and confirms only intended paths moved.
- Before editing any shared root organ this cycle touches — `hq.policy.yaml`, `engine/router.yaml`, `docs/adr/`, `tests/`, `.github/` — run `git log origin/main --oneline -5 -- PATH`. A hit since this branch's point means the collision is already in flight, and at the merge take the STRONGER version, never the earlier one. This is not hypothetical here: another live lane already took ADR-0207 inside engine's own band.
- Zero-dep Node plus POSIX is inherited: no vendor SDK in the shim, plain process invocation — checked by `package.json` carrying no new runtime dependency.
- A program embedded in a shell string carries no apostrophes and no single quotes, in code OR in comments — enforced by a grep check inside the adversarial pass this cycle already requires, never by vigilance, because this rule was written down and then broken three times anyway.
- All new lint ships WARN-first in TRIAL; evidence bundles are lane-scoped (ADR-0055); the mandate accelerates SEQUENCING, never QUALITY.
