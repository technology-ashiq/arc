# Playbook — catch a lowered bar before a phase closes

**Where this is wired: `/arc-phase-done` step 5b.** Nowhere else. Grep for this filename to see the
whole coverage.

**Provenance.** Re-expressed from `addyosmani/agent-skills` @ `aeac41d4`
(`skills/constraint-driven-development/SKILL.md:202-224`, MIT, (c) 2025 Addy Osmani), techniques
**T-05** and **T-06** in `initiatives/absorb/evidence/agent-skills/extraction-report.md`. Nothing is
copied; this is arc's own wording. Landed by ADR-0607.

---

## Why this exists

A red check has two exits: make the code work, or make the check easier. An agent under pressure
takes the cheaper one, and the result reads green either way. arc has shipped this exact failure —
the vacuous pass, three times in Cycle 6 — and the only pieces of it any tool watches today are the
CI test-count floor and `secret-diff-scan`'s count of new `gitleaks:allow` lines.

**The asymmetry is the whole rule: tightening the bar is silent, loosening it is loud.**

## The five moves to look for

Read `git diff <branch point>...HEAD` — **plus untracked and staged files**, because a guard that reads
only committed changes misses a test deleted in the working tree. For each move, either name it as
deliberate and discussed (link the `/arc-change` entry or ADR), or it is a finding.

| # | Move | What it looks like in the diff |
|---|---|---|
| 1 | **A threshold moved down** | a floor lowered (`911` → `900`), a severity dropped, a check moved out of a blocking stage, a `WARN-first` flipped back from `BLOCK` |
| 2 | **A test got easier** | `skip` added, a test file deleted, an assertion removed from a test that stayed, an `expected` value edited to match new output, a `run` with no exit-status check |
| 3 | **A checker got silenced** | a new `gitleaks:allow`, `nosemgrep`, `eslint-disable`, `@ts-ignore`, `shellcheck disable`, `istanbul ignore`, or a path added to a scanner's ignore list |
| 4 | **Work left unfinished** | a function that only throws, an empty `catch`, `|| true` on a command whose failure matters, `2>/dev/null` on one, a `TODO` where the implementation should be |
| 5 | **An exception appeared** | a new waiver, `baseline waived`, allowlist row, or debt-ledger entry nobody routed through `/arc-change` |

A move that is present and undiscussed **blocks the close** the same way a failing exit criterion does:
say what it is, where, and stop.

## How much a green check is worth

Ask of every check the phase relies on: **can the agent make it pass by writing code that does not
work?**

| Kind | Example in arc | Can the author game it? |
|---|---|---|
| **External** | gitleaks, osv-scanner, opengrep, a real browser, a real provider API | No — it encodes someone else's knowledge |
| **Project** | `kickoff-lint`, `report-lint`, `gate-parity`, the allowlist | Only by editing a file a human owns — which is move 1 or 5 above |
| **Suite** | the bats tests written in this same phase | Yes — the only genuinely circular kind |

A phase whose proof is **only** the third kind has a weak close. Say so in the done-log, and prefer a
proof with at least one external or project check in it. This is `gate-author-cannot-be-its-attacker`
applied to the gate inventory: a suite its author wrote is a claim, not evidence.

**This does not say suite tests are worthless.** They are the most useful kind day to day. It says they
cannot be the only kind behind a close.

## What this is not

- **Not a lint.** Nothing runs it. The closing agent follows it, which is weaker than a script; a script
  would be `.claude/scripts/**`, off the ADR-0602 allowlist.
- **Not a ratchet.** Recording a number and refusing to fall below it is the CI test-count floor's job
  (`.github/workflows/ci.yml`), and widening it is out of this playbook's reach.
