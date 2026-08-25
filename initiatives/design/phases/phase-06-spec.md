# Phase 06 — rival spike

**Goal (one line):** prove one rival provider's real contract — auth, request model, output
retrieval, failure behaviour — on one fixture, before any adapter code exists to depend on it.
**Appetite:** 1 day — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-05
**Implements:** ADR-1409 · ADR-1413

## Exit criteria (Definition of Done)

- [ ] **Terms clearance recorded FIRST.** Per
      [ADR-1413](../../../docs/adr/1413-a-rival-is-not-called-until-its-terms-clear.md), no live
      call is made until that provider's terms position is recorded as a `decision.recorded`.
      v0's API Terms prohibit performance testing without express written permission; this is an
      owner ruling, not a lane judgment
- [ ] Spike covers **one provider, one fixture** — not both providers, not a matrix
- [ ] Spike receipts record **provider version + request + output schema**
- [ ] Output retrieval proved to yield source arc can render itself: for v0, `latestVersion.files[]`
      raw content; for Stitch, `fetch_screen_code`'s HTML download
- [ ] **Self-containment check:** the same fixture rendered with the network blocked produces the
      same hash as with it open. A CDN-dependent file cannot be rendered deterministically and
      that provider does not proceed to Phase 07 on a special-case render path
- [ ] Failure behaviour observed, not assumed: rate-limit shape, and the credit-exhaustion path
      (v0 returns HTTP 402)
- [ ] Any npm package pinned **only** after `npm view <pkg> version` is run — `v0-sdk@0.16.7`
      and `@google/stitch-sdk@0.3.5` are registry-verified, but `@v0-sdk/react` and
      `@v0-sdk/ai-tools` are **UNVERIFIED and must not be used**
- [ ] Spike code is **quarantined and never merged** — it produces receipts, not a dependency
- [ ] **No adapter file is committed** until the spike receipt exists
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse — refined via `/arc-change` when the phase starts. The ordering assertion is the phase's
real gate: the spike receipt's timestamp must precede the first adapter commit, and that is
checked in git, not asserted in prose. Self-containment is proved by the offline/online hash
pair. The terms clearance is proved by the `decision.recorded` receipt existing on the spine
before the first outbound request appears in any log.

## Rabbit holes in this phase

- **Spiking both providers "while we are here".** Rejected-row 8 of the design source: a
  half-built rival pipeline produces fake confidence. Detour: one provider, one fixture.
- **Reasoning our way to a terms conclusion in-lane.** Detour: quote the clause, route the
  decision to the owner, wait.
- **Pinning a package version from a research summary.** Detour: `npm view`, then pin.

## Out of scope for this phase

The blind jury (Phase 07) · a second rival · any adapter code · any comparison metric.

## Your-setup / pending

**Owner ruling required before the first live call**: whether an internal, unpublished
comparison is acceptable under v0's performance-testing clause, or whether Stitch goes first —
the evidence now points at Stitch, which is free and carries only a generic clause. Credentials:
`V0_API_KEY` or `STITCH_API_KEY` for whichever provider he picks.

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
