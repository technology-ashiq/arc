# Phase 00 — Dual-mode machinery (steel thread)

**Goal (one line):** Prove PORT-E routing end-to-end — root-mode goldens pinned FIRST, then the seven surfaces resolve `--lane` / auto / ask against a tests-fixture lane, with kickoff-only creation, unknown-lane hard STOP, canonical output order, and an adversarial lane-name pass — repo layout unchanged so far.

**Appetite:** 1.25 days
**Depends on:** none

Work order is risk-first and fixed: (1) pin root-mode goldens for all seven surfaces
(kickoff-lint, arc-evidence, resume/statusline/SessionStart output, phase-done, retro,
change paths) BEFORE touching any of them — the safety net; (2) run the A2 grep
(manifests + sync-to-project must not ship root `PLAN.md`/`PROGRESS.md`/`phases/`) —
fires the assumption BEFORE any later move; (3) build the resolver seam (ADR-0054) and
teach the surfaces; (4) adversarial construct-a-breaking-input pass on lane-name
validation and flag parsing (ADR-0050 grammar), holes fixed + pinned as fixtures. A1's
0.5d tripwire applies to step 3.

## Exit criteria (Definition of Done)

- [ ] Capability works end-to-end: a fixture lane resolves on all 7 surfaces (explicit `--lane`, auto-single, ask-on-ambiguity) AND a bare root behaves byte-identically to the pinned goldens (REQ-01)
- [ ] Tests added & green: lane-resolver fixtures, adversarial lane-name fixtures (INCLUDING Windows reserved device names — `con`, `prn`, `aux`, `nul`, `com1`-`com9`, `lpt1`-`lpt9` — which pass the `[a-z][a-z0-9-]*` grammar but fail or misbehave on `mkdir` under windows-git-bash), unknown-lane STOP fixtures per non-kickoff surface, kickoff-only creation fixture, canonical-order assertion, bare-token fixtures (`/arc-change design ...` stays free text) — full bats green on 3 OS
- [ ] Live demo run + output checked (scenario below)
- [ ] Verified against the real system: THIS repo (still root layout in Phase 0) runs kickoff-lint / statusline / SessionStart with outputs unchanged vs goldens
- [ ] Contract tests green: not applicable — zero external dependencies (PLAN External dependencies)
- [ ] Tracker updated (PROGRESS.md row ✅ + done-log + appetite burn)

## Verification plan

- **Test command:** `bats tests/lane-resolver.bats tests/kickoff-lint.bats` locally (touched files only — CI runs the full 3-OS suite)
- **Expected failure first:** run the new lane-resolver fixture file BEFORE the resolver exists — every `--lane` / STOP / creation case is red while the pre-pinned root-mode goldens are already green; the file flips green only when the resolver lands. Goldens themselves must be pinned from a commit with zero resolver code, so any later diff is attributable.
- **Live demo scenario:** in a scratch copy with fixture lane `fixture-a`: `/arc-resume --lane fixture-a` prints `Selected lane: fixture-a (via arg)` → board summary → report; `/arc-resume --lane fixtur-a` (typo) hard-STOPs listing known lanes and creates 0 folders; `/arc-change --lane fixture-a something` echoes the lane and treats "something" as free text; in a bare-root copy (no `initiatives/`), output is byte-identical to the pinned golden.
- **Real-system check:** kickoff-lint + statusline + SessionStart hook in this repo, pre-migration — byte-identical to goldens.
- **Expected evidence:** empty bytediff vs a PER-OS golden set (ubuntu / macos / windows-git-bash each pin their own root-mode output — CRLF vs LF and `\` vs `/` in hook/CLI output are real platform differences, not refactor noise), with any normalization step the diff applies named in the evidence bundle; pinned adversarial fixture list (`../`, absolute path, empty, uppercase, leading-digit); STOP/creation fixture transcripts; phase-00 evidence bundle.

## Rabbit holes in this phase

- Generalizing the resolver beyond the seven PORT-E surfaces "while we're in there".
- Building board/lint machinery early — the board is Phase 1–2; Phase 0 is routing only.
- Perfecting hook output formatting; the golden defines done.

## Out of scope for this phase

- Any file move or migration (Phase 1). Any `PORTFOLIO.md` content (Phase 1). WIP info
  line, board lint, ownership lint, spool (Phase 2). Docs rewrite (Phase 3).

## Your-setup / pending

- None — offline, zero new packages, no keys.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).
