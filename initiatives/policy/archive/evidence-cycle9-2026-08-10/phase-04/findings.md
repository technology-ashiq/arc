# Phase 04 — the adversarial pass, in full

**Two days. Four fresh agents, two per day, on two different surfaces** — decision logic (schema,
reducer, promotion chain, effective-level arithmetic) and the shell/OS boundary (path
normalisation, hook dispatch, settings, process spawning). Fresh means the agent had not seen the
implementation.

The exit criterion this file answers is the one that says a clean report does not close the
phase: **the evidence is the attempts, not the verdict.**

---

## The headline

| | |
|---|---|
| Findings raised | **26** |
| Real, closed in code | **23** |
| Rejected after measurement | **2** |
| Accepted and recorded as owed | **1** (owner action, below) |
| Regression fixtures added | **17 bats tests + 10 hostile-corpus rows** |
| Hostile corpus | 54 rows → **64 rows** |
| Kill criterion | **did not fire** — see the last section |

**Day two was harder than day one, and it found more.** Day two's target was day one's *fixes*.
Three of its findings exist only because a day-one fix created them or moved them one step over.

---

## Why two agents per day, measured rather than argued

Day one ran two agents against the same engine. They overlapped on **three** findings out of
fifteen. Where they overlapped they shared the root cause; everywhere else they did not intersect
at all. A single agent's blind spot is structural, not a matter of effort — which is the whole
argument for the two-surface rule, and this phase is the second time this repo has measured it.

Every attacker's prompt carried the lane's running list of already-fixed defects, with the
instruction to check each one in every **other** file. That instruction is what produced findings
19 and 24 below, both of which are a previously-closed defect found alive somewhere it had never
been fixed.

---

## Day one — the engine as written

| # | Finding | Severity | Where it was closed |
|---|---|---|---|
| 1 | The **entire Edit/Write tool family reached no policy check at all**. `settings.json` wired the fragment under the `Bash` matcher only; `policy-hook.mjs` carried a `RESOURCE_FIELD` map for Edit/Write that nothing ever invoked. Demonstrated end to end with the Bash gate ARMED: `Write` replaced `authorize.mjs` (10658 → 153 bytes, returning execute unconditionally), after which the armed Bash gate permitted a `settings.json` edit it had refused one command earlier. | critical | `PreToolUse-edit.d/40-policy.sh` + the shared `policy-decide.sh` body |
| 2 | **Deleting a PARENT of a guarded path executed.** Every guard branch tested the resource itself; nothing tested whether the resource *contains* a guarded entry. `rm -r .claude` never named a guarded file. | critical | `containsGuardedEntry` in `resources.mjs` |
| 3 | **An unclassified argv0 was skipped at runtime**, i.e. treated as an implicit narrow — the exact opposite of ADR-0507's sentence. The static lint caught it; hooks never run the lint. | critical | `reproducedBy` widens to all seven |
| 4 | **At L3 the chaining and redirection refusal never ran**, because it lived inside the L2 branch. | high | hoisted above the level branch |
| 5 | **The engine's own source was writable.** `.claude/scripts/**` was a write root and the engine's source was not on the un-grantable list — ADR-0502's own sentence turned back on the guard. | critical | un-grantable list widened |
| 6 | **`.claude/hooks` itself was reachable** while its children were not: every glob branch tested for a STRICT descendant. | high | glob branch fixed |
| 7 | **The L2 branch had no `spend` arm**, so any amount executed with its cap never consulted. | critical | POL-F cap hoisted above the branch |
| 8 | **A decoy operand defeated the guard** — only the first slash-bearing argument was inspected, so one extra operand ahead of the real target hid it. Same shape with the target inside `--flag=value`. | high | every operand inspected |
| 9 | **A file-mutating program naming no resolvable operand was skipped**, not denied. | high | unresolvable is denied |

Plus **five defects in the fixes themselves**, all caught before they shipped and all recorded in
the commit history rather than quietly amended:

- the ancestor rule denied `jq .` — a guard that denies a read is not stricter, it is broken;
- its negative control measured the wrong thing, twice;
- the birth rule gated on `name:` when the runtime keys on the filename stem — **and my own test
  asserted that blindness was correct**;
- **7 of the 18 tests guarding that gate passed with the gate deleted**;
- the POL-D check grepped its own explanatory comment.

---

## Day two — the fixes as the target

| # | Finding | Severity | Where it was closed |
|---|---|---|---|
| 10 | **Trailing dot or space.** Win32 STRIPS a trailing dot or space at the API layer, so `hq.policy.yaml.` is the same file as `hq.policy.yaml` to every Win32 caller and a different string to every check in `resources.mjs`. **The only finding in this cycle with a proven byte-level side effect**: through PowerShell, the real `.claude/settings.json` went 3219 → 14 bytes and `hq.policy.yaml` 6660 → 14, while `guardedEntryFor` reported the target clear. `pwsh` is already a classified interpreter, so this is a program the policy contemplates permitting. Rejected outright rather than trimmed — trimming means this module deciding which of two names the OS meant, and the aliasing *is* the attack. | critical | `hasTrailingDotOrSpace`, rejected in both lookups |
| 11 | **The argv0 model failing on its own terms.** `shellArgv0` returns the first word and every check downstream keys on it, so `env rm -r .claude` is classified as `env`. Eleven wrappers — env nice nohup timeout setsid stdbuf flock sudo doas busybox xargs — all returned PROPOSE while the bare `rm` denied. Not a gap in one Set: any allowlist keyed on the first word is one wrapper away from meaningless. Refused outright, like chaining. | critical | `ARGV0_LAUNDERERS`, 28 names |
| 12 | **`FILE_MUTATORS` was ~40 names short** — find rsync tar unzip 7z gzip cpio robocopy xcopy del rd move, plus the interpreters the Set forgot while keeping node/python/bash: pwsh powershell cmd deno bun go make cargo perl ruby php yarn pnpm npx. | high | Set widened |
| 13 | **The sourced dispatcher was a bypass.** `policy-decide.sh` sourced `_dispatch.sh` and used **neither** function from it — arbitrary shell executed inside the authority path with an `exit 0` escape. An attacker replaced `_dispatch.sh` with `exit 0` and a Write to `hq.policy.yaml` came back permitted. | critical | line deleted; the authority path sources nothing |
| 14 | **Not-in-force keyed on the LIBRARY, not the law.** The fragment tested for `run-gate.mjs`, so `mv run-gate.mjs run-gate.mjs.bak` turned enforcement off silently and exited 0. | critical | gates on `hq.policy.yaml`; tampering now exits 2 |
| 15 | **Every dispatcher shipped non-executable.** `git ls-files -s` showed `PreToolUse.sh`, `PreToolUse-edit.sh` and `_dispatch.sh` at 100644 while `settings.json` invokes them as bare paths. On a fresh clone on Linux or macOS that is EACCES → 126 → the dispatcher's ignore-everything-but-2 branch → **layer 1 never runs at all on two of three legs**. | critical | exec bit set in the index |
| 16 | **A hand-written spine line raised a cap.** `loadPolicyEvents` ran every line through `validateEvent` and called that integrity. `validateEvent` checks SHAPE; `eventSha` was exported by `canonical.mjs` and nothing on the read path called it. | critical | `eventSha` verified on read |
| 17 | **A copied spine line undid a demotion.** `policy.level.changed` is an ABSOLUTE set in the reducer and the loader de-duplicated nothing, so a genuine, already-applied promotion appearing a second time RESTORES a cap a later demotion took away. No forgery needed: `cp` of one day file. | critical | dedup on read |
| 18 | **A promotion citing an approval that does not exist raised a cap.** `decision_ref` was written, shape-checked and hashed into the idem — and **never dereferenced anywhere in the repo**. The sha check above proves a line was not EDITED after sealing; it says nothing about whether a human ever authorised it, because `eventSha` and `policyIdem` are exported and pure, so an attacker seals their own forgery. **Both day-two attackers found this independently and both called it their top priority.** | critical | `loadPolicyEvents` resolves `decision_ref` against sha-verified `decision.recorded` ids |
| 19 | **The dedup keyed on `id`, not `idem`** — so a later event REUSING a prior id suppressed a genuine demotion (fail-open: the cap stayed high), and a re-sealed copy with a fresh id but the same idem folded twice, meaning fix 17 only ever covered exact-id copies. | critical | dedup keyed on `idem`, the spine's own identity |
| 20 | **Shell granted execute with NO allowlist was unbounded.** `reproducedBy` returns the empty set for an absent allowlist, so ADR-0507's derivation minned over nothing and kept the declared level — an attacker got unbounded network and an unbounded interpreter out of a kind whose write and network were both L1, and `policy-lint` printed "is law" over the file. | critical | capped to the birth cap |
| 21 | **The money guard could not detect a non-serialising lock.** A spend reservation that a concurrent writer overshot was reported as reserved. | high | post-append re-read releases and refuses |
| 22 | **The daily window was never daily** — the reservation ledger accepted a reservation with no day, so "daily" was a label on an unbounded window. | high | `YYYY-MM-DD` required |
| 23 | **A reservation could be checked against an unreconciled ledger.** | high | refuses while `ledger.unreconciled.length` |
| 24 | **A case-variant `processes/` directory resolved per platform.** `processSubjects` branched on "absent" and "not-a-directory" and FELL THROUGH for "case-variant" — so `Processes/` yielded a real subject set on Windows and macOS and an uncaught ENOENT throw on Linux, inside `policy-lint`, the FAIL-capable gate. `kickoff-lint` gates on that state before calling and got it right; **this caller did not**. The fourth twin-fix recurrence in this lane. | high | typed `PROCESSES_UNREADABLE` throw |
| 25 | **The wiring itself was never asserted.** An attacker deleted the entire `hooks.PreToolUse` block from `settings.json` and all seventeen tests in `policy-hook.bats` stayed green — every one invokes `policy-hook.mjs` or a `.d` fragment directly, so the suite proved the decision logic and never that anything calls it. | critical | a test that reads the routing out of `settings.json`, with the deleted-block mutant as its negative control |
| 26 | **`argv0_allow` was enforced only at L2.** Found attacking finding 20's fix rather than the original code. For the other seven capabilities "L3 is unbounded within the capability" is coherent; for shell it is circular, because ADR-0507 *derives* `effective(shell)` from `reproduced_by(argv0_allow)` — the declared list is the input to the cap that permitted L3. Ignored at L3, the set actually admitted is every program on the machine, whose reproduces set is "everything", while the cap was computed over the two or three names someone wrote down. Measured: `shell: { level: L3, argv0_allow: ["bats"] }` executed `node -e`, `curl`, `dd` and a recursive delete. **Latent rather than live** — every shell grant in the shipped `hq.policy.yaml` sits at L1 with no allowlist — and pinned anyway, because the ceiling is one reviewed repo edit away. | high | enforced at L3 too |

---

## The two findings that were NOT real, and why saying so matters

**A claim that this branch had reverted the two spend guards** and lowered a test count 35 → 33 to
match. That attacker mutation-tested against an older HEAD and copied the tree mid-edit. Verified
on disk before acting: both guards present, count 35, 35 tests registered. Rejected.

**A demand that `checkReservation` require `execute`.** Attempted, then measured and backed out:
POL-F caps spend at L1 in v1, so requiring execute makes the money guard **unreachable** and
breaks 31 tests. The reasoning is recorded in a comment at the call site so the next reader does
not re-attempt it. Rejected.

Recording a rejection is not a formality. A pass that adopts every finding is not adversarial, it
is credulous — and two of these twenty-six would have made the engine worse.

---

## The mutant, as the negative control

The exit criterion asks for a deliberately malicious module and counts the pass only if the engine
stops it. Run, and it is finding 1 above: a module that overwrote the canonical file, returned
`execute` unconditionally, and then let a previously-refused `settings.json` edit through. **The
engine did not stop it** — that is why finding 1 is a critical, and why `PreToolUse-edit.d/` now
exists. The mutant is also what proved findings 13 (`_dispatch.sh` replaced with `exit 0`), 14
(`mv run-gate.mjs`) and 25 (the `PreToolUse` block deleted).

The pattern is now a standing rule in this suite: **the check and its mutant run the same
predicate**, so a check that has stopped measuring anything is red instead of green.

---

## Kill criterion: checked, did not fire

The criterion is *"a bypass class the Phase-1/2 architecture cannot close — meaning the enforcement
point is not actually the sole entry."*

Findings 1, 13, 14, 15 and 25 are all that class **in appearance**: each is a way for layer 1 not
to run. None of them fires the criterion, because in every case the architecture had the right
shape and the wiring was wrong — a missing matcher, a missing exec bit, a gate keyed on the wrong
file. Each was closed inside the existing two-layer design without changing it.

**The honest posture, stated plainly:** the interactive hook is armed by `ARC_POLICY_HOOK=1` and
is inert without it. That is a documented POL-H decision, not an oversight — `session:interactive`
holds shell and write at L1, so with it armed every Bash and every Write in a live session is
`propose`, which is correct by the model and unusable as a session. **While the flag is off, the
engine is safe because it is disarmed, not because it enforces.** The tests set the flag, so the
enforcement path runs on every CI leg rather than sitting unproven.

That is why layer 2 — the static `permissions.deny` floor — matters, and why the one thing this
phase could not close itself is written up for the owner.

---

## The one finding that is not mine to close

`.claude/settings.json` is on the un-grantable resource list (ADR-0502) **and** in the harness's
own `permissions.deny`, so an agent is refused `Edit` and `Write` on it by two independent layers.
That is the rule working. Three findings therefore cannot be closed in code:

1. **The deny floor does not cover the guard's own files** — 24 entries, none for `.claude/hooks/**`
   or `.claude/scripts/hq/lib/policy/**`. With the hook disarmed, one session can permanently
   disarm every future armed one, because nothing restores what it removed.
2. **The `Edit|Write` matcher misses `MultiEdit` and `NotebookEdit`.**
3. **The MCP surface reaches no policy check at all** — `policy-hook.mjs` carries a complete
   `mcp__server__tool` branch that no matcher ever routes to. Live and unpoliced in this session:
   `mcp__stripe__*` (real money, which E2 forbids), `apply_migration`, `browser_run_code_unsafe`.
   Every one would be **denied** if it reached the hook. `Agent`/`Task` is the practical bypass for
   everything else.

Written up with exact paste-ready diffs in [`docs/owner-action-settings-json.md`](../../../../docs/owner-action-settings-json.md).

---

## Where every finding now lives

| Surface | File |
|---|---|
| Library-level regressions needing a real filesystem object | `tests/policy-hardening.bats` — 24 tests, asserts its own count |
| Hook fragment, wiring, and the two-layer contract | `tests/policy-hook.bats` — 20 tests, asserts its own count |
| The promotion chain and automatic demotion | `tests/policy-demotion.bats` |
| Money | `tests/policy-spend.bats` — 35 tests |
| The birth rule | `tests/kickoff-lint.bats` — 71 tests |
| **Attacks as data, driven by an INDEX** | `tests/fixtures/policy/hostile/` — **64 rows**, up from 54 |

The corpus is the one that matters for the exit criterion, because adding an attack there is
adding a fixture and one INDEX row — never new test code. That is what stops the corpus quietly
ceasing to grow, and the driver asserts its own size so a deleted fixture turns the file red
instead of shrinking in silence.
