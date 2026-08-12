# Adversarial pass 2 of 2 — the CLI / shell / OS / process boundary

ADR-0708. A second fresh agent, run in parallel with pass 1 and blind to it, 2026-08-11, against
`1e5a79e`. Surface: argv, exit codes, stdout discipline, environment, paths, encodings, the
index-load path, cross-OS behaviour.

**15 findings, 12 fixed, 2 accepted with a reason, 1 a clean negative control.** Overlap with
pass 1: **zero** — the two agents shared not one root cause. Second cycle running that ADR-0708 has
now measured twice.

| # | input | expected | actual | sev | disposition |
|---|---|---|---|---|---|
| 1 | run the CLI through a directory junction/symlink | the query runs, or a named error | **exit 0, zero bytes on stdout and stderr.** `--nonsense` (must be 2) → 0. A nonexistent `--root` (must be 3) → 0. **The whole exit map collapsed to 0** | high | **fixed** — my own Phase-00 fix over-corrected. `endsWith` was too loose; exact URL identity is too strict, because **Node ESM realpaths the entry module while `argv[1]` keeps the link**. macOS `/tmp` and `$TMPDIR` are symlinks, so this was live on a CI leg. Both sides are realpathed now, in all three CLIs |
| 2 | `printf '{}' > index.json`, then query | rebuild, or exit 3 | exit 0, *"0 of 0 record(s) … no recorded lesson matched. That is a result, not an error"* | high | **fixed** — `isStale` iterates `index.manifest ?? {}`, so an **absent** manifest is zero iterations and then *"manifest matches"*: making the index **more** broken defeated the freshness check. `loadExpect` already refused `null`/`[]`/`{}`/`5` one function away — the twin fix was never applied to `readIndex`/`isStale` |
| 3 | a v1-schema index (records kept, postings removed) | schema mismatch detected | exit 0, *"0 of 8 record(s)"* — while `--grep` on the same index returned 2 hits | high | **fixed** — **nothing read `index.version`.** `search(index.postings ?? {…empty})` turned a missing postings block into a silent empty engine. Any future schema bump would have given every user zero ranked results |
| 4 | truncate an organ, then compare `memory-index` with `arc-recall` | both refuse | `memory-index` exit 1, *"an organ does not empty by accident"*. `arc-recall` exit 0, *"That is a result, not an error"* | high | **fixed** — recall passed `allowEmptyOrgan: true` **and** a hardcoded `null` prior, double-disabling the guard on the surface people actually query. An unread organ is also surfaced as a warning now |
| 5 | `--tag --json "prevention"` | refuse a flag-shaped value | exit 0, `--json` consumed as the tag value, **non-JSON on stdout at exit 0** | high | **fixed** — `.claude/rules/lanes.md` names this verbatim. Refused, along with every empty value |
| 6 | replace `arc-recall.mjs` with a 60-line stub that reads nothing | the stub fails most assertions | **15 of 15 pass**, including *"returns the lesson verbatim"*, *"the exit map is honoured"* and *"query determinism"* | high | **fixed** — every assertion was a substring or exit-code check on output the callee controls, and the determinism test compared the CLI **to itself**. Two assertions now compare against the fixture organ's own bytes and against a ranking computed independently by the library |
| 7 | make `index.json` a directory, then query twice | the write failure is reported | exit 0, correct answers, **zero stderr** — and a full rebuild on every invocation, forever | medium | **fixed** — the write failure is named. It silently voided the sub-second criterion |
| 8 | `ARC_SPINE_ROOT=""` | exit 2 or 3 | **exit 1** — "internal error" per the documented map | medium | **fixed** — `isStale` calls `resolveSpine` outside the exit-3 wrapper. An operator env typo is not a bug in this program |
| 9 | `ARC_SPINE_ROOT=<a plain file>` | name the spine, or refuse | exit 0, full results, decisions organ silently dropped, no provenance printed | medium | **fixed** by #4's unread-organ warning. `memory-index` printed the spine it read; recall printed nothing |
| 10 | `-- "prevention"` | `--` ends flag parsing | exit 2, *"unknown flag --"* | medium | **fixed** — and it matters here: the organs this tool indexes are documents **about** flags |
| 11 | `--full-text "x"` | exit 2 | exit 0, silently ignored | medium | **fixed** — the flag was in the bool set with no dispatch arm. An accepted-but-inert flag is worse than a rejected one |
| 12 | `--grep ""` | refuse, per the empty-value rule | exit 0, **dumped the index** | medium | **fixed** — the carve-out turned the quoted form the lane rules *mandate* into "print everything" |
| 13 | query a fresh tree with no `.claude` and no `.gitignore` | read-only, or an announced write | creates `<tree>/.claude/state/memory/index.json` | low | **accepted, recorded.** Rule 4 permits exactly this path. But the `**/.claude/state/` ignore is a property of *this* repo, so a consumer repo gets an untracked derived file. Named here as a v1 consequence of root-mode rather than papered over |
| 14 | 1 MB of stdout piped to `head -1` | no crash, no truncation | no defect observed **on Windows**, where pipes are synchronous | low, **unverified for macOS** | **fixed anyway** — Node's stdout is asynchronous for pipes on macOS, where `process.exit()` truncates what is still buffered. Every terminating path returns instead of calling `process.exit(0)`. The agent could not execute this here and said so |
| 15 | CRLF + BOM organs; UTF-16LE; a 2 MB single line | normalized / refused / handled | all correct; UTF-16 refused at exit 3 **naming the file** | low | **no defect** — recorded as a negative control so the rows above are not read as "everything failed" |

## The finding to keep

Not #1, severe as it is. It is **#6**: the suite protecting this module proved nothing. Deleting
the entire implementation left fifteen assertions green, and one of them was the determinism proof.
`.claude/rules/testing.md` states the rule this violated — *prefer an assertion that fails when the
code is deleted* — and the file that violated it was written the same day, by the session that had
just quoted that rule in another suite's header.
