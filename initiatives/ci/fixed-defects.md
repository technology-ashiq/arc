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
