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
