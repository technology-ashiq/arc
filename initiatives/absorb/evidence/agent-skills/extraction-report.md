# Extraction report -- (outside this repo) agent-skills

<!-- Scaffolded by study.mjs --scaffold. The Source and Study scope sections below are DERIVED
     from a read-only walk and are not hand-written. The technique inventory is filled by the
     studying agent from content obtained through `study.mjs --read`, which is the only path
     that reads studied bytes -- and it never executes them.
     Every value interpolated here is sanitised: newlines folded, pipes escaped, backticks
     replaced. A REFUSED pathname is third-party input, and an unsanitised one fabricated a
     heading and an ABSORB row into this very section during the Phase 01 adversarial pass. -->

## Source

- **Identity:** (outside this repo) agent-skills
- **Pin:** git aeac41d4d005999432bb7312f7ff06383a91d59d (https://github.com/addyosmani/agent-skills, local clone read 2026-10-18)
- **License:** MIT, Copyright (c) 2025 Addy Osmani -- read in LICENSE at the repo root via study.mjs --read (sha256 6f202f8b...c9fd7)

## Study scope

- **Read:** 217 readable text file(s), enumerated by a confined recursive walk of the
  study root.
- **Not read:** 0 path(s), each logged with its outcome and reason in the refusal
  log below. `.git`, `node_modules`, `.svn` and `.hg` are skipped by design.
- **Actually opened (hand-written note, not derived):** 13 of the 217, each through
  `study.mjs --read`, the envelope saved whole to the session scratchpad and read back from
  there with its nonce markers intact (the Bash output layer compresses stop-words out of
  long output, which would have corrupted quoted text). Envelope line N is source line N-9;
  every citation below is the **source** line. Opened: `LICENSE`,
  `skills/constraint-driven-development/SKILL.md` (1-60, 186-250),
  `skills/constraint-driven-development/references/floor-guard.md` (1-25),
  `skills/doubt-driven-development/SKILL.md` (49-207), `skills/interview-me/SKILL.md` (40-150),
  `evals/README.md` (whole), `evals/skill-impact.md` (whole), `docs/skill-anatomy.md` (159-182),
  `references/orchestration-patterns.md` (291-343), `hooks/SDD-CACHE.md` and
  `hooks/SIMPLIFY-IGNORE.md` (slices), plus the heading index of
  `skills/context-engineering`, `skills/source-driven-development` and `skills/using-agent-skills`.
- **Deliberately not opened:** the other 20 skills (TDD, debugging, code review, security,
  git workflow, CI/CD, performance, frontend, API design, ADRs, shipping...). arc already carries
  each of these practices -- superpowers skills, the code-reviewer and security-auditor agents,
  the build playbook -- and a 24-skill general-practice pack is a mine, not ore. Also not opened:
  every `scripts/*.js` (code, and code is never the question here), `evals/fixtures/**`, the
  per-host setup docs and the duplicated `.gemini/` / `commands/` TOML copies.
- **Archaeology budget spent:** ~1.2 hours, inside the 1-day SKIP threshold.

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-05 | bar-lowering diff guard | At review time, reads the diff from the branch point for five named moves that LOWER the bar: a threshold moved, a test made easier (`.skip`, deleted file, assertion removed from a surviving test), a checker silenced (`@ts-ignore`, `eslint-disable`, `istanbul ignore`, `nosemgrep`, `gitleaks:allow`), unfinished work (throwing stub, empty catch, TODO in place of code), an undiscussed exception row. Tightening is silent; loosening is loud. The input contract counts untracked and staged files, and exit 2 (could not run) must never read as 0 | arc's only pieces of this are the CI test-count floor and the `gitleaks:allow` counter in `secret-diff-scan.sh`. Nothing names the other moves, and arc's own history (the vacuous pass, three times in Cycle 6) is the "test got easier" move. Agents take the cheapest road to green; this names the road | `skills/constraint-driven-development/SKILL.md:202` heading, `206-212` the five moves, `214` the asymmetry rule; `skills/constraint-driven-development/references/floor-guard.md:7-13` the input and exit-code contract | ABSORB | Re-expressible as `docs/playbooks/bar-guard.md` with a hand-written command as its caller (`.claude/commands/arc-phase-done.md` or `arc-audit.md`). NOT `arc-review.md`: it is GENERATED from `processes/review-diff.process.yaml`, so the edit would go to the process file, which is also allowlisted but is a compiled pilot -- the same trap the T-01 report fell into first | MIT permits copying, but nothing is copied: the five moves are re-expressed in arc's words. If any wording is lifted, the rebuilt file carries the attribution line `rebuild-lint` checks | The reference implementation is a regex guard; a playbook checklist is weaker than a lint. A later lint would be `.claude/scripts/**`, off the ADR-0602 allowlist |
| T-06 | check circularity ranking | Ranks every check by one question -- can the agent make it pass by writing code that does not work? External (a vulnerability DB, a real browser) beats project (rules a human owns) beats suite (the agent's own tests, the only truly circular kind). A bar with no external check is worth less | Gives a reason, not a vibe, for why arc's gitleaks/osv-scanner/opengrep rows are load-bearing and why a phase proven only by tests its author wrote is weak. It is the same idea as `gate-author-cannot-be-its-attacker`, applied to the gate inventory instead of the attacker | `skills/constraint-driven-development/SKILL.md:218-224` | ABSORB | Lands as one section of the T-05 playbook; no second file | Re-expressed, nothing copied | Low. It is a classification aid; it can be misread as "suite checks are worthless", which the source does not say |
| T-07 | ratchet with tolerance | With no agreed number, record today's value and refuse to get worse, with a 0.5% tolerance so an unrelated file moving the number does not go red | Avoids the permanent red build that teaches a team to ignore red | `skills/constraint-driven-development/SKILL.md:226-232`, tolerance default at `248` | SKIP | arc already has the shape: the CI test-count floor (`.github/workflows/ci.yml`, floor 911). The landing site for anything more is `.github/**`, which is off the ADR-0602 allowlist AND write-denied to the agent. Recorded so it is not re-studied | Nothing copied | None -- nothing changes |
| T-08 | pairwise skill-routing evals | Each skill ships positive prompts that must rank it top-k and negative prompts that belong to a NAMED other skill, which must outrank it -- so a negative cannot pass vacuously by matching nothing. A deterministic lexical pass also errors at 75% and warns at 50% pairwise description similarity. Measured: one description clause took a skill from 7/27 fires to 21/27 with must-not-fire prompts held at 0/27 | arc has ~30 commands, dozens of agents and many skills whose descriptions nobody measures for collision; "the description is the lever" is a measured result, not advice | `evals/README.md:14-22` the three tiers, `93` the owner-outranks negative, `103` the collision thresholds, `53` the measured fire rates | UNBUCKETED | Fits no bucket honestly. Not ABSORB: the rebuild is a script, `.claude/scripts/**`, off the ADR-0602 allowlist. Not INTEGRATE: their runner (`scripts/run-evals.js`) is built around their own `skills/` and `evals/cases/` layout, so vetting it as an artifact buys nothing arc can call. Not ROUTE: it is not model quality. Per ADR-0604 the matrix is extended by an ADR, not by shoehorning; logged for the owner | Nothing copied | report-lint will warn on this verdict cell; that warning is the correct output, not a defect to suppress |
| T-09 | rejected-change ledger | An append-only table of skill changes rejected on eval evidence, so nobody re-proposes them | Stops re-litigating settled changes | `evals/skill-impact.md:3-5` | SKIP | arc already does this: the absorb registry plus this report's SKIP rows (T-02/T-03 of the gstack report are exactly "studied and rejected, do not re-open"), and ADRs record rejected options | Nothing copied | None |
| T-10 | withhold the claim; reconcile contract-misread first | The reviewer gets only ARTIFACT and CONTRACT, never the author's conclusion, because a conclusion handed over comes back validated. Findings are then classed in strict precedence: (1) contract misread -- fix the contract first, (2) valid and actionable, (3) valid trade-off, written down, (4) noise -- and for noise, ask whether adding that context to the contract would have prevented the false flag | arc's attackers already get only the diff. What arc lacks is the RECONCILE side: `docs/playbooks/finding-verification.md` verifies a finding before emission but has no class for "the reviewer was wrong because our contract was unclear", which is the class that improves the next round's prompt | `skills/doubt-driven-development/SKILL.md:83` strip reasoning, `106` do not pass the claim, `172-179` the precedence order | ABSORB | Lands as an extension of the existing allowlisted `docs/playbooks/finding-verification.md`. The 3-cycle bound (`183-191`) is NOT absorbed: arc's two-round attack cap is already tighter | Re-expressed, nothing copied | Contract-misread first can become an excuse to rewrite the contract until a real finding disappears. The playbook must say a contract change is itself reviewed |
| T-11 | external-reviewer CLI hygiene | When a second model reviews an artifact: write the prompt to a file and pipe it via stdin, never interpolate it into a shell argument; run the CLI in a read-only sandbox because the artifact may carry injected instructions; each invocation needs its own authorization; a skipped or failed cross-model pass is announced, never silent | `.claude/commands/arc-second-opinion.md` names no sandbox and no stdin route (checked by grep). arc's AGENTS.md shell-string rule was learned four times; this applies the same rule at the cross-model boundary, plus the injection angle | `skills/doubt-driven-development/SKILL.md:135` never interpolate, `151` read-only sandbox, `132` the full invocation checklist | ABSORB | Lands in `.claude/commands/arc-second-opinion.md`, hand-written (not one of the three generated commands), on the allowlist | Re-expressed, nothing copied | The exact read-only flags differ per CLI and version; the rebuild must name the capability ("read-only sandbox") and verify flags at run time rather than hard-code them -- T-13 says the same |
| T-12 | interview with a guess and a stop test | One question at a time, each with the agent's GUESS attached; a confidence number; an explicit list of replies that are not a yes ("whatever you think", "sounds good"); stop when the agent can predict the user's reaction to its next three questions | A checkable stop condition for an interview, not a feel | `skills/interview-me/SKILL.md:55-60` Q plus GUESS, `115-120` the not-a-yes list, `134-140` the stop test | SKIP | Conflicts with a standing owner ruling: kickoff forks with a falsifiable trigger go to the assumptions ledger, not to a blocking question (`prefer-assumptions-ledger-over-blocking-forks`), and arc's `question-planner` already caps fork questions at five with defaults. One-at-a-time interviewing multiplies the blocking the owner asked to remove | Nothing copied | None -- nothing changes |
| T-13 | write the procedure, not the workaround | A step that cannot be justified without naming a model, a model version or one agent's private tool name belongs in an issue, not in the skill. Describe the capability, not one runtime's mechanism. Cites a measurement that skills written against one model's failures can make a stronger model worse than no skill | arc compiles processes to several harnesses (`engine/harnesses.yaml`, `arc-compile.mjs --target`), so a harness-specific workaround in a process file is a defect on every other target | `docs/skill-anatomy.md:159-168` | ABSORB | Lands as an authoring rule in `docs/playbooks/` (a short command-and-process authoring note), referenced from the processes it governs | Re-expressed, nothing copied. The cited arXiv paper was not read, so the "worse than no skill" claim is the source's, not verified here | It can be over-applied: some arc steps exist BECAUSE of a measured harness defect (the MSYS `@file` expansion, the shell-string rule). Those are environment facts, not model workarounds, and the note must say so |
| T-14 | orchestration depth at most one | Names four anti-patterns: a router persona, a persona that calls another persona, a sequential orchestrator that paraphrases each hand-off, and deep persona trees. Keep depth at one (command to personas) and merge in the main agent | Each extra hop paraphrases context away and roughly doubles cost | `references/orchestration-patterns.md:302-312` persona calls persona, `316-326` paraphrasing orchestrator, `330-339` deep trees | ROUTE | Orchestration shape is engine/executor territory (arc-run, workflows, council), the same routing the gstack report gave its T-04. Referred, not absorbed | Nothing copied | arc's council and `arc-run` deliberately go deeper than one level; whether that is earned is engine's call, not absorb's |
| T-15 | revalidated WebFetch cache | Hook pair on WebFetch: after a fetch, store content with its ETag/Last-Modified; before the next identical fetch, send a conditional HEAD and serve the cache only on 304. Pages with no validator are never cached | Cuts repeated doc fetches without ever serving stale content on trust | `hooks/SDD-CACHE.md:65` the PreToolUse action, `70-71` the freshness rules | INTEGRATE | A service artifact (two shell hooks), not a technique to rebuild. If wanted, it goes through develop's vet and lock path. Its landing site is `.claude/hooks/**` and `.claude/settings.json`, and the latter is owner-only | MIT; integrating as-is would need the copyright notice kept with the files | Hooks run on every WebFetch; a hook bug blocks fetches session-wide |
| T-16 | hide annotated blocks from simplification | Comment markers wrap code the model must not simplify; a hook swaps each block for a hashed placeholder on read and restores it at Stop | Protects hand-tuned code from a simplifier | `hooks/SIMPLIFY-IGNORE.md:3` purpose, `73` crash recovery | SKIP | It rewrites working-tree files mid-session, and its own doc concedes a crash leaves placeholders on disk. arc runs parallel sessions and worktrees on one clone; a placeholder committed by another session is a silent code deletion | Nothing copied | None -- nothing changes |

## Verdict summary

| verdict | count |
|---|---|
| ABSORB | 5 |
| INTEGRATE | 1 |
| ROUTE | 1 |
| SKIP | 4 |
| UNBUCKETED | 1 |

## SKIP and refusal log

- **No refusals and no quarantines.** `study.mjs --inventory` returned 217 readable, 0 refused,
  0 quarantined. No symlink left the study root.
- **License: MIT, read, not assumed.** Copying is permitted with the notice; this study copies
  nothing and re-expresses every ABSORB row. Any rebuild that lifts wording must carry the
  attribution `rebuild-lint` checks for, in every rebuilt file.
- **T-07 SKIPped** -- arc already ratchets test count in CI, and the landing site is `.github/**`.
- **T-09 SKIPped** -- the absorb registry and SKIP rows already are this ledger.
- **T-12 SKIPped** -- conflicts with the owner's assumptions-ledger ruling for kickoff forks.
- **T-16 SKIPped** -- mutates tracked files mid-session; unsafe with parallel sessions on one clone.
- **T-08 is UNBUCKETED, on purpose.** It is the most valuable finding here and fits none of the
  four buckets: its rebuild is a script, off the ADR-0602 allowlist. ADR-0604 says the matrix is
  extended by an ADR, never mid-study. Owner decision: leave it, or open an ADR that either widens
  the allowlist for one eval script or adds a fifth bucket.
- **Nothing was executed.** No install, no import, no hook or script run. `scripts/*.js`,
  `hooks/*.sh` and `skills/idea-refine/scripts/idea-refine.sh` were never opened.
- **No rebuild was made in this study.** Step 8's `rebuild-lint` and `registry-ref` apply to a
  rebuild diff; there is none yet. The five ABSORB rows are registered as `candidate` only.
