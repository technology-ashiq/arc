# Phase 03 — governance drop

**Goal (one line):** an owner judgement becomes a sealed, blind, mandatory-reason receipt on the
existing event kinds, nothing can adopt or retire itself, and develop's team leader learns to use
the toolbox in this cycle rather than a later one.
**Appetite:** 1 day — blown appetite means cut scope or kill, never extend silently
**Depends on:** phase-02

## Exit criteria (Definition of Done)

- [ ] **ADR-0603 payload profile live:** `approval.requested` carrying
      `subject: "absorb.ab-judgement"` with candidate id, fixture list, blind labels, evidence path
      and correlation. **Unknown keys are rejected AND every required key's absence is rejected by
      name**, `assertDecision`-style — a lenient reader is a silent hole in both directions, and a
      required key missing from a programmatically assembled payload is the likelier real slip. Two
      fixtures: one feeds an unknown key and asserts the refusal names it; one omits each required
      key in turn and asserts the refusal names the missing one.
- [ ] **Zero new event kinds** — proven by a fixture that diffs the live kind set before and after
      this phase and fails on any addition.
- [ ] **Blind-mapping mechanics live, sealed by hash commitment rather than by good manners:**
      variant labels randomized; before the decision the evidence bundle carries **only a hash
      commitment** of the label-to-variant mapping (`crypto.createHash` — Node stdlib, so zero new
      deps and A2 holds). The plaintext mapping is written to the bundle **only after**
      `decision.recorded` lands, and a fixture asserts the revealed mapping hashes to the
      pre-decision commitment. **A fixture asserts that no file under the evidence bundle contains
      the plaintext mapping before the decision, checked by reading the files directly** — not only
      through the proposal surface — and a positive control asserts it IS present and hash-matched
      after, so the test cannot pass on a mapping that was never written at all.
      **Why this is not the refused "cryptographic seal":** a plaintext mapping on disk guarded only
      by one code path that declines to display it is an honour system, and the owner doing the
      judging has a filesystem. A commit-and-reveal hash is the minimum mechanism that makes
      "sealed" true no matter which door is used to look, and it is stdlib, not signatures.
- [ ] **`decision.recorded` requires both `pick` and `reason`** — a missing reason is a refused
      write, asserted by fixture, not a blank field that passes.
- [ ] **Inbox chain fixtures green (REQ-06, REQ-07):** request appears as an OPEN approval, the
      owner's pick records with its reason, and the registry transition **requires** that decision
      ref. A transition attempted without one warns per Phase 2's lint, and **no harness code path
      writes `adopted` or `retired` directly** — proven by a fixture that greps for such a path and
      by a mutant that tries.
- [ ] **REQ-05 lands: the `PLAN-develop` §7.1 team-leader addendum** as this cycle's reviewed diff
      plus a **freeze-log line** in `PLAN-develop` (EVO-H0 precedent). Content: consult registry and
      lockfile at brief time · receipted use per slice · cap 12 with displacement · a retro
      retire-review row (unused 2 cycles proposes retire) · adopt and retire stay propose-only.
      **Every duty is a harness step, never a standing daemon.**
- [ ] **The Capability-Proposal verdict set gains `technique → refer to absorb`**, and this is **two
      edits, not one** — Phase 0's audit confirms the current set is `worth vetting` / `refused here`
      / `unknown` with no `technique` value, so ADR-0604's referral rule has nothing to hook into
      until both land: (a) the `PLAN-develop` addendum documents the new verdict, and (b)
      **`.claude/agents/capability-scout.md`** actually gains it in its verdict list and its table
      contract. **(b) is cycle work, not a rebuild, so the ADR-0602 allowlist does not apply and is
      not being widened** — the allowlist governs where an ABSORB verdict may land, and this is
      enablement for another lane. Stated explicitly because an agent-definition edit that looks like
      an allowlist breach would otherwise be argued about in review instead of understood.
- [ ] **A reusable Toolbox template block** ships for future lane plans, in `docs/templates/`.
- [ ] **Before editing `PLAN-develop`, run `git log origin/main --oneline -5` on it** — develop is
      IDLE, but the shared-file rule is checked rather than assumed, and at the merge the stronger
      version wins, not the earlier one.
- [ ] **Adversarial pass on the profile and the inbox chain** — a fresh agent, unanchored, prompt
      carrying the lane's running list of already-fixed defects. Holes fixed and pinned.
- [ ] tests added and **green on CI**, per-JOB conclusions read; test counts asserted; `@test` names
      ASCII-only
- [ ] tracker updated (PROGRESS.md row and done-log)

## Verification plan

One coarse line at kickoff, refined via `/arc-change` when the phase starts: bats coverage over the
payload profile (including unknown-key refusal), the seal-before-decision property with its positive
control, the mandatory-reason refusal, and the no-self-adoption mutant — plus a live demo running one
synthetic judgement end to end through the real inbox and showing the sealed mapping revealed only
after the decision.

## Rabbit holes in this phase

- **Building a judgement UI.** The inbox already exists and already folds these kinds. A second
  surface is a second thing to keep correct.
- **Rewriting `PLAN-develop` while in there.** REQ-05's scope is the addendum and its freeze-log
  line. Anything else found in that file is `/arc-change` input, not an edit.
- **Signatures, keys or a real crypto scheme.** The seal is a stdlib hash commitment and nothing
  more: unreadable before the decision, auditable after. Key management is a bigger promise than the
  property needs — but note the exit criterion, because a *plaintext* mapping guarded by one polite
  code path is the opposite error and is not the cheap option, it is the broken one.

## Out of scope for this phase

Any real study, rebuild, A/B or adoption (Phase 4) · bench's inheritance of this grammar, which is
one line added at bench's own kickoff and not now (ADR-0603) · evolve's experiment machinery, which
this cycle does not touch (ADR-0605).

## Your-setup / pending

Nothing for the build. **One owner action is required to close REQ-06's live demo:** the owner picks
the synthetic blind A/B through the inbox so a real `decision.recorded` exists with a reason. It is
one inbox pick, and the phase cannot prove the chain without it.

## Non-negotiables (verbatim from PLAN)

- Study is read-only and injection-aware: studied READMEs, prompts and transcripts are hostile input, so parser-class discipline applies from birth with pinned red fixtures and an adversarial pass before any FAIL promotion.
- Studied code never executes during study — no install, no import, no eval; execution happens only through vetted paths after a rebuild.
- Zero new event kinds; ADR-0603 is a payload profile only, and the closed spine vocabulary is not extended by this cycle.
- License hygiene: re-express ideas, refuse incompatible copies and record the refusal, attribute permissive copies in both the registry row and the rebuilt file.
- Propose-only in both directions: adoption and retirement each end in the inbox, and no self-adoption path exists.
- Rebuilds land only on the ADR-0602 allowlist; arbitrary paths are never a rebuild target.
- Zero-dep Node and POSIX (A2); tests stay centralised at `tests/` (ADR-0021); every new lint ships WARN-first in TRIAL and is promoted only by `/arc-retro`.
- Never delete: SKIPped sources and retired techniques keep their registry rows and reports (A10).
- A gate, lint or parser is not done until a fresh adversarial pass has attacked it and the found holes are fixed and pinned as fixtures — and the pass attacks the TEST that protects the rule, not only the rule.
- Constitution articles upheld: E3, A2, A5, A9, A10. **A8 is the exception and is not claimed as upheld** — this cycle runs under ADR-0074's recorded reading that lexos, running a root-mode arc install, pulls arc's completion; that tension is flagged for the owner and only he may resolve it.
