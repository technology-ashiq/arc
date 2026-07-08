---
description: Close a phase per the build playbook's Definition of Done — or refuse.
argument-hint: [phase-number]
allowed-tools: Bash(npm run test:*), Bash(npm run lint), Bash(npm run build), Bash(git log:*), Bash(git diff:*), Bash(graphify:*)
---

Verify phase $1 against its spec `phases/phase-NN-spec.md` (NN = zero-padded $1, e.g.
`/arc-phase-done 3` → `phases/phase-03-spec.md`) and `docs/build-playbook.md` §8. Evidence
over assertion — show output, don't claim.

1. **Tests:** run the full suite. Must be green. Paste the summary line.
2. **Live demo:** actually run the phase's capability end-to-end and show the output.
3. **Verify in the real place** (real DB / API / deployment) if the phase touches one.
4. Check every exit criterion in the phase spec — tick or list what's missing.

**If anything fails: the phase is NOT done.** Say exactly what's missing and stop.
Do not update the tracker for an unfinished phase.

If all pass:
5. Update `PROGRESS.md`: flip the phase row to ✅, add a done-log entry (what shipped +
   test count + actual time vs appetite — blown appetite gets flagged for /arc-retro), and
   move `## Now` to the next phase.
6. Refresh the code knowledge graph if available (`graphify update .`) — the next phase's
   reviews and diagnoses should see the current blast radius, not last phase's.
   (Skip if graphify's own git hook is installed — it already rebuilt on commit.)
7. Reply with a one-line summary + anything phase $(($1+1)) needs from me (keys,
   accounts, infra) per the "your-setup / pending" list.
