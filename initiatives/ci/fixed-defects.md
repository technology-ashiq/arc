# Fixed defects — ci lane

Imported classes. Every attacker prompt carries this list; check each one in EVERY ci file, not only the one where it was fixed.

- (a) A test that passes proves the assertion held, not that the code ran: a `node:test` file that throws at import or matches 0 tests must FAIL its lane's `.count`, never count as green.
- (b) A required check that never starts leaves a PR pending forever: path filtering is job-level `if:` only, never workflow-level `paths`.
- (c) Waiting on CI that was never created: confirm a run exists whose `headSha` is HEAD before waiting (retro 2026-08-12#6).
- (d) A program embedded in a shell string carries no apostrophe; inside a double-quoted string, no backtick and no `$` (AGENTS.md). Workflow `run:` blocks with real logic live in their own script file.
- (e) Never interpolate `$ARC_ROOT` / a POSIX path into a native node program on Windows; `cd` first + relative path, or pass it as argv.
- (f) A Node CLI main guard realpaths both sides.
- (g) A byte-compared git extract passes `-c core.autocrlf=false -c core.eol=lf` (retro 2026-10-14#1).
- (h) A floor only catches shrinkage: every count file is compared against the runner's REPORTED count, never a grep of the source.
- (i) A path filter that believes a successful diff over an unverified range: both refs are `cat-file -e` checked first, and any doubt fails OPEN (attack c9aab1d B1/L6). A job gated on a filter output tests `!= 'false'`, never `== 'true'`, so an unset output runs the job (B2).
- (j) Paths from git are read with `-z` and `core.quotePath=false`: a quoted or newline-bearing path is one record, never two or none (B3/L4).
- (k) A counted file set and the set the runner executes come from ONE enumeration: no symlink follow on either side, and shard index/total come from the matrix (`strategy.job-index/job-total`), never a second hand-typed number (B4, B7/L2, B8).
- (l) A downloaded tool binary is installed only when its sha256 equals the pinned published digest; presence alone is not trust (L13).
- (m) A one-line count file accepts `\r\n` as well as `\n`: files are written on a Windows box (L1).
- (n) `node --test` output is parsed only under `--test-reporter=tap`; the default reporter is not TAP on Node 24 (B6).
- (o) A claimed count (`.count`, a drop row) is checked against what actually ran or existed: the runner's reported total covers the sum of `.count`, and one name buys one drop (r2 B1/B6).
- (p) A diff that feeds a filter passes `--no-renames`, so a file moved out of a gated path still triggers the gate; a change to the gate itself triggers every gated job (r2 B3/B4).
- (q) A hook's stdin is read ONCE and handed to every reader that needs it; the first reader drains it for the rest (p01 B1).
- (r) "Nothing mapped" or "0 tests ran" is never green: a lane with no test file runs the core set, and a node run must report `# tests N` > 0 (p01 B2/L1).
- (s) A child spawned from a git hook gets an env with every `GIT_*` variable removed, so a test sandbox cannot write the real repo (p01 B3).
- (t) On Windows, `bash` is git's own (`git --exec-path`/../../../usr/bin/bash.exe), never a PATH lookup that can land on WSL (p01 B5).
- (u) A glob over lane dirs uses nullglob and the lanes.md name grammar; a non-lane dir is skipped, never passed as `--lane` (p01 B4).
- (v) An allowlist of "safe to skip" paths also asks the tests' own text: a path or 3+-segment dir a test names is code; a code extension is code anywhere (p01 B11/L3/L10).
- (w) A lane name from a file name is the LONGEST known lane prefix, never the first `-` word (p01 L4).
- (x) "Named by a test" checks the file's full path at any depth, not only 3+-segment dirs: PORTFOLIO.md is one segment (p01 r2 B2).
- (y) A local command that runs bash runs git's bash, never PATH's: `npm run ci` is `test-changed.mjs --ci` (p01 r2 B3).
- (z) A runner's summary is read from its LAST `# tests N` line; a test's own output can print one first (p01 r2 L3).
- (aa) A local run that covers a migrated lane whole is held to that lane's `.count`, like CI's node-test job (p01 r2 L2).
