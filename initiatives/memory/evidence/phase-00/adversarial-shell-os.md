# Adversarial pass 2 of 2 — the shell / OS / process boundary

ADR-0708. A second fresh `general-purpose` agent, run in parallel with pass 1 and blind to it,
2026-08-11, against commit `eb62094`. Surface: paths, CRLF, BOM, unicode, argv, exit codes,
environment variables, filesystem behaviour, atomic rename, temp files, and cross-OS differences.
The parsing logic was the other agent's.

**21 findings, 20 real, 1 unverified-by-construction.** It confirmed its own working tree was
clean afterwards.

| # | input | expected | actual | severity | disposition |
|---|---|---|---|---|---|
| 1 | `--root ""` — what `--root "$DIR"` expands to when DIR is unset, i.e. the QUOTED form the lane rules mandate | refuse | **exit 0.** Built the whole index against `process.cwd()` and wrote `<cwd>/.claude/state/memory/index.json` | high | **fixed** — presence, not truthiness, for every value flag. Fixture `an empty --root is refused, not turned into the current directory` |
| 2 | rewrite an organ and restore its mtime with `utimesSync` | `stale: YES` — the comment beside the code says the hash decides | `stale: no`. The hash was consulted only INSIDE `if (mtime differs)` | high | **fixed** — the hash decides, always. The comment had been asserting a property the code did not have. Fixture `a change that preserves the mtime is still caught` |
| 3 | add an ADR, then `--status` | `stale: YES` | `stale: no` | high | **fixed** — same fix as pass 1 #3; found independently by both agents, the only real overlap in 37 findings |
| 4 | `printf '' > docs/retro-log.md` on a tree with no expectation file — i.e. the live tree | non-zero | **exit 0**, `retro-log 0/0`, index written | high | **fixed** — an organ that had records and now has none fails the build. `0 == 0` satisfies the invariant, and §B3 forbids pinning counts on the live tree, so NO channel existed for this on the real run |
| 5 | re-save an organ as UTF-16LE + BOM (PowerShell 5.1's default on the windows leg) | an encoding refusal | **exit 0**, `retro-log 0/0` — every row silently stopped matching and none was excluded | high | **fixed** — a UTF-16 BOM or a NUL byte is refused by name. Fixture `a UTF-16 organ is refused instead of reading as empty` |
| 6 | `--root <unrelated tree>` from inside a real clone that has its own spine | the decisions organ follows `--root` | indexed the CLONE's decisions into the unrelated tree's index, citing `"(spine)"` — a citation naming no root at all | high | **fixed** — `resolveSpine(root)` derives the spine from `--root` unless `ARC_SPINE_ROOT` names one, and the index records which root was read and how |
| 7 | emit a decision onto the indexed spine, then `--status` | `stale: YES` | `stale: no`; the spine had no manifest entry at all | medium | **fixed** — the spine's event-id list is a manifest input. Fixture `a new decision on the spine makes the index stale` |
| 8 | an expectation file with a UTF-8 BOM | parse it | exit 1 with a raw `SyntaxError` stack | medium | **fixed** — the expectation file goes through the same normalisation as the organs |
| 9 | expectation files holding `null` and `[]` | refuse | exit 0, every expectation silently skipped | medium | **fixed** — same fix as pass 1 #6, reached from a different direction |
| 10 | `ARC_SPINE_ROOT` set to a non-existent path, and to a regular file | refuse, as the empty string correctly does | exit 0, `reader returned 0 event(s)` | medium | **fixed** — a spine with no `events/` directory is `absent`, which now fails the build unless `--allow-missing-spine` |
| 11 | `--root A --root B`; and `--status --rebuild` together | operator error; pick one | silent last-wins; and exit 0 having built nothing | medium | **fixed** — both are exit 2. `lanes.md` settled the doubled-flag question for `--lane` and the reasoning is identical |
| 12 | `--expect my-expect.json` where the file exists in both cwd and the tree | the caller's cwd wins | the TREE's copy won — the artifact under measurement supplied its own pass condition | medium | **fixed** — `--expect` resolves against the caller's cwd, never against the tree being graded |
| 13 | `docs/adr/archive/0899-old.md`, and `0903-shouty.MD` | indexed or named | invisible in both lists. On the case-insensitive windows and macOS filesystems `.MD` and `.md` are the same name to the OS | medium | **fixed** — same fix as pass 1 #15 |
| 14 | replay this suite's own `an empty spine reports zero AND says which spine it read` against a bogus spine path | at least one assertion fails | **both passed.** The test matched the prefix of the sentence and never the path — including the repo root, the exact bug it commemorates | medium | **fixed** — the test asserts `from $SPINE`. A regression test that cannot fail is worse than none, because it reads as coverage |
| 15 | an organ that is a directory; `--expect` pointing at a directory | an error naming the path | bare `EISDIR: illegal operation on a directory, read` — no filename, with 150 ADRs in scope | medium | **fixed** — every read failure names its file. Fixture `an unreadable organ names the file it could not read` |
| 16 | a wrapper named `check-memory-index.mjs` that only imports the module | the module imports and the wrapper runs | **exit 2**, `nothing to do` — the wrapper's own code never ran | medium | **fixed** — `import.meta.url === pathToFileURL(process.argv[1]).href`, exact identity rather than a suffix test. **Phase 1's `arc-recall.mjs` imports this module**, so this was a booked failure |
| 17 | `--status` with no index, and after an organ was deleted | non-zero, so `--status` can gate | exit 0 in both cases | medium | **fixed** — exit 3 on stale, so `--status && use-the-index` cannot proceed on a stale index |
| 18 | a `.bats` file with a `@test` line inside a heredoc | the in-file count guard notices only 2 tests registered | the guard passed on 3 | low | **accepted, and the reason recorded.** The guard counts source lines, not registered tests. `.github/workflows/ci.yml` already reconciles declared-vs-executed TAP lines for real on every leg — the in-file guard is a restatement of a real gate, not the gate. Kept, with that noted in its comment |
| 19 | plant `index.json.tmp-4242`, then rebuild | swept or noticed | left behind forever | low | **fixed** — `writeIndex` sweeps stale temp files. Harmless (the dir is gitignored) but litter in a derived directory is how a derived directory stops being trusted |
| 20 | run from a directory that is not a git repo | no output the caller did not ask for | `fatal: not a git repository` on stderr, from a child whose failure was already handled | low | **fixed** — the probe's stderr is ignored |
| 21 | an ADR filename containing a literal backslash on a POSIX leg | the emitted path names the real file | **NOT RUN** — Windows cannot create the file, so this box cannot construct the case | unverified | **fixed anyway** — `rel()` used an unconditional `\\` swap; it uses `path.sep` now. Would only ever have shown on the ubuntu and macOS legs |

## What held up, and is therefore worth stating

CRLF and LF trees produce byte-identical record sets, and a line-endings-only rewrite correctly
does **not** flip staleness. A BOM-prefixed organ hashes identically to a plain one. Unicode and
spaces in `--root` and in ADR filenames round-trip. Trailing slash, doubled slash and relative
`--root` all normalise. Three concurrent builders on one tree all exited 0 leaving a single
`index.json`. 450 KB of output ending in a non-zero exit was byte-identical through a pipe and
through a file. The builder wrote nothing whatsoever into the spine directory.

## Why two agents and not one

Two agents, 37 findings, and **exactly one shared finding** — the staleness blindness to an added
ADR. Pass 1 lived inside the parsers and never touched argv, encodings or exit codes; pass 2 never
opened a code span. Neither would have produced the other's list with more time or a better
prompt, because the blind spot is structural rather than a matter of effort. That is the whole
claim behind ADR-0708, and this is the second time this repo has measured it.
