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
