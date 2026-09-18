# Phase 05 — live sources

**Goal (one line):** reference packs are built from live sources rather than fixtures, and every
run says out loud which sources answered and which did not.
**Appetite:** 1.5 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-02, phase-03
**Implements:** ADR-1408 · ADR-1412

## Exit criteria (Definition of Done)

- [ ] shadcn MCP wired and answering (already installed on the owner's machine, ₹0)
- [ ] 21st.dev MCP wired in **search mode only** — hosted `https://21st.dev/api/mcp` with the
      `x-api-key` header, or the legacy stdio proxy reading `API_KEY_21ST`. `credential_ref`
      maps arc's secret name to the upstream one; arc's internal name is never sent upstream
- [ ] 21st.dev's credit-gated `generate` mode stays **out of scope** — free tier is search plus
      2 installs/day, and generation is paid
- [ ] Mobbin wired **only if** the owner has opted into Pro by now; otherwise its row stays `off`
      and nothing references it
- [ ] `.mcp.json` edited under the shared-file protocol: `git log origin/main -5 -- .mcp.json`
      run **before** the edit, and the stronger version taken at merge
- [ ] A real pack built from **≥2 live sources**, each with a per-run `availability` line
- [ ] `availability` is observed per run and **never hand-set**; `status` and `availability`
      stay separate fields so a network failure cannot look like a policy decision
- [ ] A robots.txt `Disallow` produces a **recorded refusal**, never a silent skip — a scanner
      that cannot tell CLEAN from COULD-NOT-SCAN is the failure this repo has already logged
- [ ] No silent caps: if a source returned fewer screens than asked, the run says so with a count
- [ ] Two-surface adversarial pass by fresh agents on the availability reporting path
- [ ] tests added & green **on CI, read per JOB at the branch head SHA**
- [ ] live demo run + output checked
- [ ] contract tests green against the **real** implementations for every dep this phase wires
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. Availability reporting is proved by
running with one source deliberately unreachable and asserting the run degrades with a printed
status line rather than a shorter pack and no sign anything was dropped. Credential mapping is
proved by asserting the upstream request carries the upstream header name, never arc's internal
one. The `.mcp.json` edit is proved by the pre-edit `git log` appearing in the phase record.

## Rabbit holes in this phase

- **Turning on 21st.dev's generator because the key is already there.** It is credit-gated.
  Detour: search only this cycle; generation is a registry `status` change the owner makes.
- **Editing `.mcp.json` without the pre-edit check.** Two lanes have already collided on shared
  files. Detour: run the `git log` first, every time.
- **Letting an empty result mean "clean".** Detour: COULD-NOT-SCAN is its own named outcome.

## Out of scope for this phase

Rival providers (Phases 06–07) · Figma and Refero · any paid source the owner has not elected.

## Your-setup / pending

**Owner decisions due by this phase** (design source §13): whether to pay for Mobbin Pro, and
which rival goes first — the latter now carrying the evidence in
[ADR-1413](../../../docs/adr/1413-a-rival-is-not-called-until-its-terms-clear.md). A 21st.dev
API key is needed if its row is to move past `search`.

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
