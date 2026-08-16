# A test that passes proves the assertion held, not that the code ran

We shipped this failure three times in one cycle, twice inside test suites written to prevent
exactly it. That repetition is the interesting part. Knowing about a class of bug does not stop you
writing it; only a control that fires without your attention does.

The three:

Nine test probes imported a path that Git Bash resolves and node does not. Three of them passed.
They passed on the stack trace, because the assertion was "output does not contain X", and a crash
satisfies that beautifully.

A heredoc never reached a helper's stdin, so every fixture it built was empty. Two "no findings"
tests passed on nothing at all. An empty fixture is a silent pass generator and it looks identical
to a clean run.

A probe read `process.argv[1]`, which for a node script is the script itself. A validator spent an
entire suite parsing its own source and reporting no problems with it.

## The general form

Prefer an assertion that fails when the code is deleted. If ripping out the implementation would
leave the test green, the test is measuring nothing, and it is worse than no test because it
occupies the slot where a real one would go.

Three cheap rules fall out of that. Any probe that shells out checks the exit status, or asserts on
a marker the code emits only when it reaches the end. A fixture builder asserts its own fixture is
non-empty. An assertion shaped "output does not contain X" never stands alone; it gets paired with
a positive assertion that the run produced its expected output.

## The sibling that is worse

There is a version of this where the test was never there at all. Our test runner silently drops a
test whose name contains a non-ASCII character. Five tests written with em-dashes in their titles
were never registered, never ran, and never failed. The file was green. The only signal available
was the total count falling.

So a suite that is the proof of a rule now asserts its own registered count. A suite running fewer
tests than it declares is indistinguishable, from the outside, from a suite that passes.
