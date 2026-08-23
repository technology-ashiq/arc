---
description: Close a phase per the build playbook's Definition of Done — or refuse.
argument-hint: [phase-number]
allowed-tools: Bash(npm run test:*), Bash(npm run lint), Bash(npm run build), Bash(git log:*), Bash(git diff:*), Bash(graphify:*), Bash(bash .claude/scripts/plan/arc-evidence.sh:*), Bash(node .claude/scripts/plan/kickoff-lint.mjs:*), Bash(bash .claude/scripts/hq/arc-event.sh:*), Bash(bash .claude/scripts/core/lane-resolve.sh:*)
---

**Lane first** (`.claude/rules/lanes.md`): run
`bash .claude/scripts/core/lane-resolve.sh --for phase-done --print human` (add
`--lane <name>` if I gave one). Non-zero exit → print it and STOP. `$1` is the PHASE
NUMBER, never a lane. Closing a phase is destructive, so **name the selected lane in
your confirmation before touching anything**: "Closing phase NN in lane `<lane>`."
In lane-mode every tracker path below (`phases/`, `PROGRESS.md`, `PLAN.md`) reads
`initiatives/<lane>/…` and `arc-evidence.sh` takes the same `--lane`; root-mode is unchanged.

Verify phase $1 against its spec `phases/phase-NN-spec.md` (NN = zero-padded $1, e.g.
`/arc-phase-done 3` → `phases/phase-03-spec.md`) and `docs/build-playbook.md` §8. Evidence
over assertion — show output, don't claim.

1. **Tests:** run the full suite. Must be green. Paste the summary line.
2. **Live demo:** run the spec's **Verification plan** exactly (test command, demo
   scenario, real-system check) and show the output against its expected evidence.
   If this phase's verification plan is still the coarse one-liner, refine it FIRST,
   then run it.
3. **Verify in the real place** (real DB / API / deployment) if the phase touches one.
   If this phase owns an external dep: contract tests must now pass against the REAL
   impl, not just the fake.
4. Check every exit criterion in the phase spec — tick or list what's missing.
5. **Plan drift check:** run `node .claude/scripts/plan/kickoff-lint.mjs`. A phase can't close
   on a drifted plan (missing spec, unmapped REQ, broken ADR index) — fix the plan first.
   **Trigger scan:** read PLAN's Assumptions ledger and every indexed ADR's **Revisit
   trigger** — a FIRED assumption not yet routed through `/arc-change`, or a revisit
   condition that is now true, is unresolved risk: route it through `/arc-change` BEFORE
   closing. **Phase 0 only:** any ADR still `DEFERRED — spike scheduled` blocks this
   close — run the spike, land its evidence in the ADR, finalize the decision.

**If anything fails: the phase is NOT done.** Say exactly what's missing and stop.
Do not update the tracker for an unfinished phase.

If all pass:
6. **Write the evidence bundle** (Phase 02+, ADR-0002). Run
   `bash .claude/scripts/plan/arc-evidence.sh bundle $1` then
   `bash .claude/scripts/plan/arc-evidence.sh verify $1`. This commits `docs/evidence/phase-NN/`
   (scan verdict, review stamps, coverage, + a sha256 manifest). **A phase cannot close if
   `verify` fails** — the bundle is the tamper-evident proof the gates actually passed.
7. Update `PROGRESS.md`: flip the phase row to ✅, add a done-log entry (what shipped +
   test count + actual time vs appetite) **+ the phase metrics: `amendments: <n>`
   (/arc-change entries touching this phase) · `reopened: y/n`. Phase 0 close also
   records `t-to-phase0: <days since kickoff>`** — /arc-retro reads these for the
   scoreboard. Update the **appetite-burn line**. In PLAN.md's Success requirements, flip
   this phase's REQs from `active` to `validated`. Check the kill criteria: **if ≥50% of
   total appetite is burnt and the tripwire phase isn't done, STOP and force the
   scope-cut conversation now** — blown appetite gets flagged for /arc-retro. Then move
   `## Now` to the next phase.
8. Knowledge-graph refresh (ADR-0075) — normally already done, so **verify rather than run**:
   codegraph self-syncs through its daemon, and graphify rebuilds on every commit via the
   guarded `post-commit` hook. Run `graphify update .` by hand only when `graphify hook status`
   reports the hook missing, or when a graphify upgrade has overwritten `post-commit` and
   dropped its `[ -d "graphify-out" ] || exit 0` worktree guard.
9. Reply with a one-line summary + anything phase $(($1+1)) needs from me (keys,
   accounts, infra) per the "your-setup / pending" list.
10. **Leave the receipt (spine)** — record the phase close, and that moving past it needs my
    sign-off (both hook-mode, never block):
    ```bash
    bash .claude/scripts/hq/arc-event.sh emit phase.closed --payload '{"phase":"<NN>","tests":"<count>"}'
    # Moving past a closed phase is a human sign-off gate: leave that approval request on the
    # spine too. Record my decision via `arc-inbox approve <id> --reason ...` / `reject` (REQ-06).
    bash .claude/scripts/hq/arc-event.sh emit approval.requested --payload '{"what":"approve moving past phase <NN>","gate":"phase-done","phase":"<NN>"}'
    ```
