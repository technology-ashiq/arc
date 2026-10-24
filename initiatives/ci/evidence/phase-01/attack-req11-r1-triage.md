# REQ-11 attack round 1 triage (07e31a1; evidence in ../phase-00/attack-07e31a1-r1-*.json)

The first logic run failed (arc-run could not emit from a worktree); round 1 logic was re-run before any fix, per the skill.

| id | sev | verdict |
|---|---|---|
| B1 / L10 | high | FIXED (owner line): the read hook's `compgen -G "$CLAUDE_PROJECT_DIR/..."` failed open on a Windows backslash path and on `[`. Reproduced: armed + `C:\...` dir -> scope check never ran. Now a quoted-dir loop, as in composer-scope-check.sh:173. Pinned in design-composer-eyes.bats. fixed-defects (ag). |
| B2 / L6 / L7 | medium | FIXED: the retire test planted copies via `git show <old sha>`, absent from a shallow clone. Now fixtures in tests/fixtures/sync-retired/. fixed-defects (ah). |
| B3 | low | NO CHANGE: `.gitattributes` pins `*.sh text eol=lf`, so the heredoc never holds a CR. |
| B4 / L1 | low/high | DEBT D16: symlink -> only the link is removed, and only on an exact shipped hash. The retired paths are fixed literals, so no newline path exists. |
| B5 | low | NO CHANGE: the list holds every hash git ever held (`git log` per path: 1, 1 and 2 versions). |
| L2, L4, L11 | medium | NO CHANGE: the attacker's own analysis ends "not a real defect". |
| L3 | high | DEBT D17: operator-chosen TARGET; deletes only 3 fixed paths on an exact hash. |
| L8 | medium | NO CHANGE: the drift invariant runs on a fresh target only; no venture runs it. |

## Round 2 (90fbd5d; ../phase-00/attack-90fbd5d-r2-*.json)

| id | sev | verdict |
|---|---|---|
| L1 | high | NO CHANGE: the glob tail sits outside the quotes on purpose; that is the only part meant to glob. The pinned bracket-path test runs it. |
| L2 / L3 | high/medium | DEBT D17 / D16 (repeat of round 1). |
| L4 | medium | NO CHANGE: the list holds every version git ever held. |
| B2 / L5 | medium | FIXED: `_arc_sha` drops CR before hashing; the test plants a CRLF copy and a mutant without the strip goes red. (ai) |
| B1 / L6 | medium | FIXED: the test now retires the OLDER session-log version (second-hash arm) and counts exactly 2 retired lines. (aj) |
| B3, B4, L7, L8 | low | DEBT D19. |
| L9, L11 | low | DEBT D20. |
| L10 | low | NO CHANGE: the scope check's own refusals are pinned by the 20 other cases in the same suite. |
