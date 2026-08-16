# Phase 00 adversarial pass — `jobs-lint` and the job scripts

**Run:** 2026-08-12, on commit `a1762bb` (the commit that shipped `jobs-lint`), gating its merge
rather than the phase close. Two fresh agents, neither having seen the implementation, on two
deliberately different surfaces. Both carried this lane's running defect list with instructions
to check every item in every *other* file.

| Surface | Charter | Findings |
|---|---|---|
| A | decision logic — rule set, slot arithmetic, and the tests that protect them | 12 + 4 minors |
| B | shell / filesystem / OS boundary — path identity, child processes, cross-leg behaviour | 12 |

**24 findings. All fixed. Overlap between the two surfaces: 1 of 24** (both found the bare `**`
write root). That ratio is the argument for the two-surface rule: a single agent's blind spot is
structural, not a matter of effort, and surface B found seven defects that surface A — reading
the same files, on the same day — could not see.

## The four that mattered most

**1. Every failure was reported as success.** `arc-event` runs in hook mode by default and exits
**0 on every failure**, writing `SKIP <code>` to stderr. `day-close-roll` passed no `--strict`,
so a lock timeout, a torn append, a validation failure and a malformed date all landed in
`result.sealed`. The job printed `sealed=N failed=0` and the wrapper would have written a
receipt saying the books were closed. Measured: `close-day --date not-a-date` exits 0.

This also made the file's own three-outcome design unreachable — the `DAY_CLOSED` and `NO_DAY`
branches are only consulted when `status !== 0`, which those codes never produced.

*Fixed:* `--strict` is passed, `r.error` is checked, and **the verdict now comes from the
filesystem** (`isDayClosed`) rather than from pattern-matching the child's stderr. Read the
artifact, do not parse the report about it. Negative control pinned: `jobs-run.bats` forces a
close-day failure and asserts it lands in `failed`, never `sealed` — reverting `--strict` turns
that test red.

**2. The self-modification ban passed a job granted write to the entire repo.** `roots: ["**"]`
was reported clean. The prefix reducer stripped only a *trailing* `/**`, so the bare glob matched
neither branch, resolved a path whose last segment is literally `**`, matched nothing, and passed
— **by being asked the wrong question, which is verbatim the hazard the comment three lines above
it claimed to have closed.** `withinRoots` treats `**` as grant-everything, so this was the
maximum grant, not an exotic one. A non-array `roots` skipped the check entirely.

*Fixed:* any prefix still containing a wildcard is refused; a non-array `roots` is refused; an
L2/L3 write grant with no roots at all is refused. Four fixtures pinned.

**3. This commit was already CI-red on all three legs.** `job_stub` was not in `process-lint`'s
closed top-level key set, so both stubs produced five findings each, and `arc-compile --all`
reported `3/5 byte-identical` and exit 1. Two committed tests assert the opposite
(`process-lint --all` exits 0; `--against-baseline` says `3/3`).

*Fixed:* a job stub is now its own document class with its own closed key set — `output`,
`evals` and `baseline` are **forbidden** there, not optional, because carrying one is a claim to
be compiled. `arc-compile --all` skips stubs, detected by reading the file rather than by name.
Both gates green, and `3/3` is restored rather than the test's expectation being edited.

**4. A job entry could be a directory, and node executes it.** `existsSync` is true for a
directory, and `node <dir>` resolves `index.js`. Proven end to end: a directory named
`dirjob.mjs` under the allowed path linted clean and ran. `lstatSync` was imported and never
used — the file-type check was intended and dropped.

*Fixed:* a script entry must be a regular file, must end in `.mjs`, and must not be a hardlink
(`nlink > 1` gives it a second name outside the reviewed directory that realpath cannot see,
because both names are equally real).

## The rest, by class

**"Cannot check" treated as "check passed"** — the deny-by-default violation, four times:
a null `processNames` skipped the process-entry check (and `subjects.mjs` states that exact
contract in its own header: *"VERIFY THIS CONTRACT WHENEVER A NEW CALLER APPEARS"* — this was a
new caller); an absent `ctx.policy` skipped every policy rule and returned clean; an
unresolvable entry path fell back to a lexical string decision while the code comment claimed it
was refused; `--bill` printed `INR 0 by construction` for a file that did not parse.

**Coercion where a type check was meant** — `budget.inr: null` satisfied *"inr is mandatory"* and
billed ₹0, walking an unbudgeted LLM job straight through the ceiling check the pre-mortem calls
the mitigation for runaway spend. Same shape: `budget.min: true`, `version: "1"`,
`monthly_ceiling_inr: null`.

**A rule tested against a value that structurally cannot contain what it looks for** — the
credential scanner's flagship pattern needs the field name and the value in one string, but in
YAML the field name is the *key*, and only the value was tested. `api_key: <32 hex>` was clean.
The one passing test worked only because its fixture embedded `token:` *inside* a quoted scalar.
Comments were invisible entirely. *Fixed:* the probe is now `key: value`, plus a raw-text pass.

**A guard keyed on a string rather than on the thing it measures** — the suite's own self-count
test ran `grep -c '^@test '` over the file, which cannot catch the failure it exists to catch
(bats silently drops a `@test` whose name carries a non-ASCII character; the line stays in the
file). *Fixed:* it now asks `bats --count` and cross-checks.

**Cross-leg divergence** — three `sed` replacements used GNU-only `\n`, which BSD sed on the
macOS legs emits as a literal `n`: two tests would have failed there and one would have **passed
while testing a different construct entirely**. Six other test files in this repo carry explicit
BSD-sed warnings. *Fixed:* those fixtures are heredocs now.

**A closed schema that closed nothing** — no unknown key was rejected at any level, so
`catch_up: run` was accepted and ignored. That typo silently removes the one guarantee that
matters most on this machine: `catchup: run` is what makes a slept-through night catch up rather
than vanish (ADR-0804). Clean lint, no diff signal.

**Arithmetic that would have cried wolf every week** — `cadenceIntervalMs` returned a constant
24h, so a healthy `weekdays` job is "overdue" every Monday: Friday 09:00 → Monday 08:00 is 71
hours, over 2×24h. `brief-materialize` is `weekdays@06:00`. Pre-mortem row 5 names trust collapse
from needs-you spam as a top-5 failure, and a guaranteed weekly false alarm is that failure on a
timer — it then hides the real one. *Fixed:* replaced by `missedSlots`, which counts slots that
should have fired. `slotsBetween` also silently truncated at 4000 iterations (a walk from epoch
returned exactly 4000 slots ending in 1980, reading as complete) and returned `[]` for a NaN
bound — both now throw.

**Non-atomic write** — `brief-materialize` truncated then wrote, on a job that fires at 06:00 on
a Modern-Standby-only box, making a mid-write suspend the expected case. *Fixed:* temp file plus
rename, and the size is read back off the artifact rather than off the child's stdout.

**Dead code carrying a live bug** — `relPosix` was never called and computed containment with
`slice()` and no separator check, so `C:\repository\secrets` rendered as `ository/secrets`: a
path outside the root shown as inside it, one call site away from a bypass, in a file whose whole
job is containment. Deleted.

## What the pass did NOT find

The duplicate-name check, the `entry-dir` traversal guard, the `jobs`-must-be-a-sequence short
circuit, the 31/23 slot arithmetic, and the YAML subset's own flow/anchor/duplicate-key
exclusions all held against everything both surfaces threw at them. One of the two named mutants
— `lintJobs` returning no findings unconditionally — was genuinely caught by 23 tests.

The other was not, and that is the finding this report ends on: **a mutant `jobs-lint` that exits
0 unconditionally survived the entire original suite**, because all 22 hostile cases drove the
module through the harness and the only CLI status assertion was `[ status -eq 0 ] || [ status
-eq 2 ]` — a gate that accepts the mutant by construction. `jobs-lint` also appeared nowhere in
`.github/`. The exit code is the whole contract of a validator, and nothing was binding it.

*Fixed:* four CLI tests now bind exit 2 on an illegal schedule with the rule named, exit 0 on a
legal one, exit 1 when the lint cannot run, and `UNKNOWN` rather than a measured zero from
`--bill` on an unparsed file.

## Tally

`tests/jobs-lint.bats` 28 → 43 tests. `tests/jobs-run.bats` added, 10 tests, covering the two job
scripts and the `arc-run` guard — none of which was executed by any test on any leg before, which
is why four of the defects above survived a green CI run.
