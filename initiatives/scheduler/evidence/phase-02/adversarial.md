# Phase 02 adversarial pass — two fresh agents, two surfaces, 24 findings

Run 2026-08-13, after the phase looked finished: the real-OS smoke was green, the fail-closed
gate had a fixture, and the tracker was one commit from flipping. Two agents that had not seen the
implementation attacked it, one on the decision logic and one on the shell/OS boundary, each
carrying the lane's running list of already-fixed defects with the instruction to check every one
against every file on its own surface.

They overlapped on **three** findings out of twenty-four. That is the same result Phase 00 got
(24 findings, one overlap) and the same one Cycle 6 got across seven passes: a single agent's blind
spot is structural, not a matter of effort.

## The one that would have taken the whole phase down

**No job could be registered at all.** `registrationFor` emitted
`weekly:MON,TUE,WED,THU,FRI@06:00` for a weekdays cadence. `scheduler-task.ps1` splits the spec on
`@` and matches the part before it against exactly `daily` and `weekdays` — so that string threw.
`arc-jobs register` with no name walks the enabled jobs in file order, and the first one is
`brief-materialize`, a weekdays job. The unattended surface was 0% registerable.

**Why three green checks looked straight at it and saw nothing:**

- the real-OS smoke hand-typed `-Trigger daily@23:33` and never went through `registrationFor`
- the contract test asserted `WEEKDAY_TRIGGER:"weekly:MON,TUE,WED,THU,FRI@06:00"` — it *pinned the
  bug*, because it was written against the implementation rather than against the grammar the
  other side of the boundary accepts
- every other test used the daily job

A test that pins what the code does, rather than what the contract requires, certifies the defect.
The replacement asserts the emitted kind is inside the closed grammar, and a second test reads the
accepted kinds back **out of the .ps1** and compares them with what Node exports — the two halves
of a closed grammar maintained by hand in two files will disagree eventually, and this pair
already had.

## The rest, by what they would have cost

| Finding | What it would have done |
|---|---|
| `args.join(" ")` unquoted into `cmd.exe` | A repo path containing a SPACE registers a task that runs a truncated path every slot forever. `&` or `%VAR%` in a path would have run a second command |
| Log directory created at REGISTER time only | Delete it and cmd fails opening the redirect **before the job starts** — exit 1, no log, no receipt, and Task Scheduler discards the reason. The mechanism added to make failures visible was hiding this one |
| Readback checked settings only | `command`, `arguments` and `cwd` came back off the OS and were ignored, so a truncated argv, a dropped log redirect or a wrong working directory all read back GREEN and stayed on the machine |
| `new URL(".", import.meta.url).pathname` | Percent-encoded. `C:\My Repos\arc` becomes `My%20Repos`, every spawn returns ENOENT, and every scheduled run dies reporting "left no receipt" — including the incident receipt for its own failure. Thirteen sibling files already used `fileURLToPath`; this was the one that did not |
| `unregister` went through `loadSchedule` | A deleted or unparseable `hq.policy.yaml`, or one missing job row, left the tasks registered and firing with **no CLI path to remove them**. The one surface required to work when everything else is broken was disableable by a broken repo |
| Gate's only control was deny-by-default | Raising `BIRTH_CAP` from L1 to L3 — every declared subject jumps propose to execute — passes all three checks, because an absent kind has ceiling L0 and `min(L0, L3)` still denies. A gate that only asks about a subject nobody declared cannot see a change affecting subjects somebody did |
| Check 3 ignored the root it was handed | `authorizeRun` loads policy from `policyRoot()`, so the third check judged a **different file** from the first two — and returns `mayInvoke: true` for a root with no policy at all. "Validate one read, compare another", the defect closed in `verdict.mjs` and left open in `lineage.mjs`, recurring a third time |
| Orphan sweep threw on a foreign task | One capitalised or non-arc task under `\arc\` aborted the loop and left every remaining task registered — the off switch broken by a neighbour it does not own |
| `list()` coerced a bad shape to `[]` | A failed read printed `0 arc task(s) remain -- the heartbeat is off`. Exactly the shape of `arc-event` exiting 0 on failure, which this lane already paid for in Phase 00 |
| A disabled job could be registered by name | The task fires every slot into a wrapper that refuses to run it: exit 0, no receipt, panel row reads `disabled` — the overdue detector silent by design while the machine ran a task nobody could see. Bulk `unregister` could never remove it: not enabled, so not a target; name known, so not an orphan |
| A renamed job could not be unregistered | `no job named X`, three lines under a comment promising the off switch works on jobs the schedule no longer lists |
| Only three SchedulerError codes handled | `PS_FAILED`, `NO_OUTPUT`, `BAD_OUTPUT`, `SPAWN_FAILED` escaped as a raw stack trace and **exit 1**, indistinguishable from a dozen unrelated failures and silent about which jobs did and did not land |
| `-TaskName` unvalidated in the .ps1 | `Unregister-ScheduledTask` accepts WILDCARDS. The whole guard lived in the Node caller, in a file whose own banner calls itself the only place this repo talks to Task Scheduler |
| Readback compared against `PINNED_SETTINGS` | Not against what was sent. A caller sending wrong settings that the OS honoured exactly would be reported as OS drift, and the real fault never named |

## Mutants that survived the suite — the tests, attacked

Both agents were told to attack the TEST that protects the rule, not only the rule. Five mutants
survived:

1. **`registerVerified` deleted from the CLI**, replaced with a bare `os.register` plus a query.
   The whole suite stayed green: the four rollback fixtures drive the module directly, and nothing
   asserted the CLI calls it. The rollback was protected everywhere except the one caller that
   reaches a machine.
2. **`_refute() { return 0; }`** — the helper four negative assertions depend on, including the one
   proving the gate runs before the platform check. The file's own header explains why the naive
   one-liner is a vacuous pass, then shipped the replacement with no control of its own.
3. **`logonNote()` hardcoded, or the footer deleted** — no test asserted the footer's text, its
   presence, or its derivation. The replay test compares two runs of the same binary, which a
   constant or an absent footer satisfies equally.
4. **The positive control emptied** — there was none to empty yet; adding it created the mutant,
   so an empty control list is now itself a failure.
5. **`-LogPath` dropped from the registration** — no test anywhere referenced `scheduler-task.ps1`,
   `logPath` or `job-logs`. The .ps1 was never executed by the suite at all, which is precisely why
   the trigger bug shipped.

Each now has a fixture. The action line is executed for real on the Windows leg, on a path
containing a space, with the log directory deleted first — the two shipped defects, reproduced as
the test that would have caught them.

## One finding that was the harness, not the code

The first probe of the `cmd.exe` action line failed with *"The filename, directory name, or volume
label syntax is incorrect"*, which read exactly like a quoting defect. It was not. Node's `spawn`
applies its own backslash-escaping to inner quotes, which cmd does not understand; Task Scheduler
concatenates Execute and Arguments into one command line and hands it to CreateProcess untouched.
With `windowsVerbatimArguments: true` — what the OS actually does — the same line ran, created its
missing log directory and wrote its marker. Recorded because the near-miss was to "fix" a correct
implementation against a broken measurement.

## Checks that came back clean, stated rather than padded

- **Node to PowerShell is genuinely injection-proof.** The production argument vector was run
  through a probe on PS 5.1.26100: spaces, quotes, `$`, backticks, semicolons, trailing
  backslashes, empty strings and `--`-prefixed values all arrive byte-intact as typed parameters.
  The `-File` design is doing its job; the injection risk was on the *second* boundary, PowerShell
  to `cmd.exe`, and it is closed by per-argument quoting plus an outright refusal of `" % & ^ < > |`
  in any path that reaches a task action.
- **The apostrophe / backtick / `$` rule holds.** No file on either surface embeds a program in a
  shell string — no `bash -c`, `sh -c`, `node -e`, `-Command`, `eval`, `shell:true` or heredoc.
- **No second `$action` / `$Action` collision.** Every local in the .ps1 was compared against every
  parameter and every PowerShell automatic variable.
- **The panel replay is intact.** The footer is a constant derived from a frozen object, with no
  clock and no I/O.
