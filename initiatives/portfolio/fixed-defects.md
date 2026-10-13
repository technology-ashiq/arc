# fixed-defects.md -- the portfolio lane's running defect list (lock 5, ADR-0226)

Every `/arc-attack` on a portfolio PR carries this file. Check **each class below in every file of the
diff**, not only where it was first fixed: a fix is not applied until it has been attacked somewhere it
was never made.

## Imported classes (seeded at Cycle 5 kickoff, 2026-10-14)

- **(a) markdown-contract parsing.** Case-sensitive key match, first-vs-last of a repeated key, `$` under `/m`, bold or heading-level variants slipping an exact regex (Cycle 4 risk 3, council v2/v3).
- **(b) flag values.** A flag with a missing or empty value is refused by name and never consumes the next flag; two copies of one flag with different values is an error, not last-wins (Cycle 4 Phase 00, lanes.md).
- **(c) a gate reading its own output.** A job whose own receipt resets the clock it measures (kickoff attack finding 1).
- **(d) the wrong repo or spine.** Resolving from cwd instead of the linted root; a linked worktree reading its own empty `.claude/state` (kickoff attack).
- **(e) string-diff "is this new?".** A typo or date amendment flipping a header comparison (kickoff attack finding 2).
- **(f) counts a rehearsal satisfies.** A threshold over receipts met by a simulated, fixture or rehearsal record (kickoff attack finding 4).
- **(g) vacuous tests.** Absence-only assertions a crash satisfies; non-ASCII `@test` titles bats drops silently (testing.md).

## Lane finds

- **(h) a value handed to git as an argument.** A ref or path with a leading dash is an option to git (`--output=<path>` writes a file): validate against a ref grammar before any `git` call (Phase 04 r1 B2).
- **(i) one null for two failures.** "Absent at base" and "could not read base" must be different states; folding both into null made a git hiccup refuse a mid-cycle lane (Phase 04 r1 B4).
- **(j) the main worktree is not dirname(git common dir).** Separate-git-dir checkouts and submodules break that; read `git worktree list --porcelain`'s first entry (Phase 04 r1 B5).
- **(k) a marker that is only checked for one literal.** `test: "false"` is not proof of real money; a marker counts unless it is literally `false` (Phase 04 r1 L3).
- **(l) order on an append-only log.** A supersedes/decision line only acts on a record that existed before it (Phase 04 r1 L4).
- **(m) tracker paths in two forms.** A path used both on disk and as a git tree path must be repo-relative POSIX (Phase 04 r1 B3).
- **(n) rows without a header.** Markdown ledgers append rows under later prose without repeating the header; code-fenced pipe lines are not rows (Phase 05 demo).
- **(o) env paths resolved against cwd.** A relative `ARC_SPINE_ROOT` handed to a gate that lints a root argument resolves against that root, never cwd (Phase 04 r2 B1).
- **(p) a flag value that looks like another flag.** The value after `--text`, `--lane`, `--root`, `--for`, `--print` belongs to that flag, even when it reads `--base` (Phase 04 r2 B2).
- **(q) one message for two failures, again.** A git that is missing or timed out is not "the ref does not resolve" (Phase 04 r2 B3).
- **(r) a duplicate the emitter must quarantine.** A daily job checks the spine for its own episode before emitting; leaning on `DUP_IDEM` filed one quarantine line per silent lane per day (Phase 06 demo).
- **(s) a needs-you line that does not say where.** The brief printed a bare `incident.raised`; an alarm that does not name its subject is not actionable (Phase 06 demo).
