# Phase 01 — adversarial pass: the OPEN half

Two fresh agents on different surfaces (decision logic · shell/OS boundary) attacked Phase 01's
three gates on 2026-08-23/24 and returned **26 findings**. Commit `05fc34d0` closed the
mechanical ones. This file is the **open** half, written down because the previous session ended
with them recorded nowhere but its own transcript — and a finding that lives only in a transcript
is a finding that comes back.

**Status of this file:** live worklist. A row leaves it by being fixed with a test that fails
first, or by being accepted in writing with a reason. Nothing leaves it by being forgotten.

---

## Where this stands, 2026-08-24

| # | Finding | State | Proof |
|---|---|---|---|
| L1 | the three gates are inert | **CLOSED** | red at `f100c1dc`, green at `4f720557` |
| L2 | boundary covers `Read` while the agent holds three tools — *script side* | **CLOSED** | red at `691fb5b4`, green at `4f720557` |
| L2 | *wiring side* — `settings.json` matches `Read` alone | **BLOCKED — owner** | red, deliberately left red |
| L3 / S2 | the scope suite drove argv while production sends stdin | **CLOSED** | regression pins green at `4f720557` |
| S2b | `policy-hook.bats` never listed `Read`/`Grep`/`Glob` | **PARTIAL** | `Read` green; `Grep`/`Glob` red behind the owner row |
| L4 | `--surfaces` only checked `<section>` | **CLOSED** | red at `691fb5b4`, green at `4f720557` |
| L5 | `selfreview` was opt-in | **CLOSED** | red at `691fb5b4`, green at `4f720557` |
| S3 | the renderer's output path carried no viewport | **fix written**, red pushed at `20f56454` | |
| S4 | `render` wrote where no gate reads | **CLOSED** | red at `691fb5b4`, green at `4f720557` |
| S12a/c/d | the three minors | **open, batched** | — |

**The one blocked row, stated plainly.** `.claude/settings.json` is outside what this session is
permitted to edit; two layers refuse it, and that refusal is deliberate rather than a bug to
route around. Until its `PreToolUse` entry for `PreToolUse-read.sh` reads
`"matcher": "Read|Grep|Glob"` instead of `"matcher": "Read"`, Grep and Glob never reach the
dispatcher and the script-side fix above is unreachable in production.

Two cases stay RED naming exactly that — `settings.json arms the read boundary for Grep and
Glob` in `design-composer-eyes.bats`, and the `Grep`/`Glob` rows of `PHASE 04 — settings.json
actually ROUTES the policed tools` in `policy-hook.bats`. They are red on purpose. A hole that
cannot be closed from here should be visible in the suite rather than skipped into silence, and
on the fix run those two were the **only** failures on any leg, including the unsharded
ubuntu-22 job and macOS shard 2/3.

**The one line is verified SUFFICIENT, not merely necessary.** Both cases were re-run against an
**in-memory** copy of `settings.json` with the matcher patched — the file itself was not written,
because the refusal is a guard and not an obstacle. `design-composer-eyes.bats`'s check finds all
three tool names. `policy-hook.bats`'s own predicate, used verbatim, reports `live=true /
mutant=false` for all six of `Bash Edit Write Read Grep Glob` — the mutant column being uniformly
false is what makes that test non-vacuous, and it stays false, so the change routes the new tools
without loosening the anchored match for the old ones. Nothing else moves. Whoever makes the edit
will not make it and then discover it was not enough.

`sync-to-project.sh` reads `settings.json`, so `tests/fixtures/sync-golden/tree-manifest.txt`
needs regenerating once the edit lands. That half is not the owner's.

**Still owed before Phase 01 can close:** the second two-surface adversarial pass. Everything in
the CLOSED column above is new code, and this lane's rule is that a fix is not applied until it
has been attacked somewhere it was never made.

### New, and it is mine: the boundary's fast path costs ~370ms and now runs 3x as often

Found by measuring my own change rather than by an attacker, minutes after widening the matcher
to `Read|Grep|Glob`. On this Windows box:

```
bare bash spawn                 56 ms
full PreToolUse-read dispatch  ~400 ms      (unarmed -- the exit-0 path)
```

So roughly **370ms of dispatcher work on every Read, and now on every Grep and every Glob too**,
in every arc session, whether or not an explore run is armed. Grep and Glob are high-frequency
tools; a session doing a hundred searches pays about forty seconds for a guard that is doing
nothing at the time.

**Why the fast path is not fast.** `composer-scope-check.sh` reaches its
`[ -f "$MARKER" ] || exit 0` at line 100. Before that, on *every* invocation, it runs
`git rev-parse --show-toplevel` — a whole git subprocess — sources `common.sh`, and probes
`command -v` / `type` twice. The cheap check is last and the expensive setup is first.

**Fixable, and deliberately not fixed here.** The hook sets `CLAUDE_PROJECT_DIR`, so `ROOT` can
be derived without spawning git, the marker can be tested before any of the setup, and the
canonicaliser only needs to exist on the path that actually canonicalises something. That is a
reordering of a **security boundary's startup**, which is exactly the class that gets red-first
tests and a two-surface adversarial pass — not a hot-patch applied minutes before that pass
runs, on a branch that has just gone green. Widening the matcher was the correctness fix and it
is done; making its fast path fast is a separate slice with its own proof.

Recorded here with the numbers so the next pass inherits a measurement rather than a suspicion,
and so nobody has to rediscover that the cost tripled the moment the matcher did.

### Carried into that pass: EINTR on a gate's own output

Seen once on `20f56454`, macOS shard 1/3, in **another lane's** gate:

```
pii-tripwire: VIOLATION resolved store path in a tracked file
  file: .claude/scripts/leads/cfg.mjs:1
.claude/scripts/leads/pii-tripwire.sh: line 79: printf: write error: Interrupted system call
```

The tripwire **detected the violation correctly and printed it**. The `printf` was then
interrupted by a signal, and the run ended with that write failure instead of the intended
exit 2, so the test asserting `status -eq 2` failed. It reads as a flake and it is not one in
the way that word usually means: a gate whose exit code can be decided by an interrupted write
is a gate that can be walked past at exactly the wrong moment. Detection was never the weak
part.

**The mechanism, checked rather than assumed.** `pii-tripwire.sh` runs `set -euo pipefail`, and
the interrupted `printf` lives inside its `report()` function. With `-e`, a failed `printf`
aborts the script then and there, carrying its own status — the scan never reaches the exit that
would have said 2.

My first note here claimed the same exposure was in the code this phase shipped. **That was
wrong, and checking it is the only reason I know.** `design-explore.sh`,
`composer-scope-check.sh` and `design-render.sh` all run `set -uo pipefail` with **no `-e`**, and
every refusal path writes to stderr and then reaches an `exit 2` / `exit 0` on its own line — an
interrupted write there is discarded, because the exit status comes from the explicit `exit` and
not from the last command that happened to run. The exposure needs BOTH halves: output that can
be interrupted, and `-e` (or a bare fall-through) letting that interruption decide the status.

Carried into the next pass as a named class anyway, because "not exposed today" is a fact about
today: *can any gate in this lane be made to report the wrong exit status by interrupting its
output?* — and specifically, does any path here end on a command's status rather than on an
explicit `exit`. Not fixed for leads: that lane runs in its own flow, and one lane does not
patch another's gate over a single transient.

---

## The headline: the three gates are INERT

`grep -rn` across commands, skills, processes, hooks and CI found **zero callers** of
`composer-scope-check.sh --begin` and **zero callers** of `design-explore.sh
surfaces|coverage|selfreview` outside `tests/`. Nothing arms the marker, and
`[ -f "$MARKER" ] || exit 0` makes the read hook a **permanent no-op** in production.

Those slices were reported green on CI, and they are green. **CI green is not the same fact as
the guard guarding** — this repo's own words: *"a green matrix is evidence the assertions held,
never evidence a guard guards."* Three gates were built and none were wired into the explore flow.

This is the phase's exit criteria talking, not a nice-to-have: REQ-02 says the allowlist is
enforced by *"a named technical mechanism … not by prompt prose alone"*, and an unarmed mechanism
is prose with a shell script next to it.

---

## Open — decision logic

| # | Finding | Why it matters |
|---|---|---|
| L1 | **The gates are inert** (above). Zero production callers; the marker is never armed. | REQ-02's "named technical mechanism" is not in the path. The negative control tests compliance, not refusal. |
| L2 | **The read boundary covers `Read` only.** `ui-composer` also holds `Grep` and `Glob`, and either returns a sibling variant's content. | This is **verbatim the assumptions-ledger trigger** written at kickoff. It is FIRED and owed a `/arc-change` route. **Routed 2026-09-16** — PLAN's ledger row now carries `FIRED 2026-08-24`. |
| L3 | **The composer-scope suite is vacuous on the production path.** All 15 tests pass the path as `$1`; the real dispatcher passes it on **stdin**. Delete the stdin branch and every test still passes. | Fifth vacuous-pass instance this cycle. See S2 — the same hole from the shell side. |
| L4 | **`--surfaces` only requires markers on `<section>`.** A page built from `<div>`s passes with zero markers. | Cycle 3's variants were div-built pages. The gate does not cover the shape it was written for. |
| L5 | **`selfreview` is opt-in.** Three iterations on disk and no `self-review/` directory means no gate at all. | An absent artifact reads as a pass. Same class as L4: fail-closed is the contract, fail-open is the behaviour. |

## Open — shell / OS boundary

| # | Finding | Why it matters |
|---|---|---|
| S2 | **The `Read` hook wiring is asserted nowhere.** `tests/test_helper.bash` copies `10-design-composer.sh` into the sandbox but not `PreToolUse-read.sh` and not `_dispatch.sh`. `tests/policy-hook.bats` — literally the test that exists to catch a deleted hook block — loops over `["Bash","Edit","Write"]` and never got `Read`. | Deleting the `"matcher": "Read"` block from `.claude/settings.json` leaves every suite green. The attacker verified the production path works **today**, so this is a regression hole, not a live break. |
| S3 | **`coverage` is unsatisfiable by anything `design-render.sh` can write.** The output path has **no viewport component**, so rendering one route at 1440x900 then at 390x844 in one session overwrites both the meta and the PNG — only the last viewport survives. `coverage` requires both to exist. | REQ-03's viewport contract cannot be met by the renderer it is written against. The passing fixture hand-writes `d.json`/`m.json` — filenames the renderer cannot emit — so it is green against a shape production never produces. |
| S4 | **`design-explore.sh render` writes into a session the gates never read.** It calls `design-render.sh "$page"` with no flags, so `MODE` defaults to `critique` and `SESSION` to `design-critic`; output lands in `renders/design-critic/` while `coverage` and `selfreview` read `renders/$ID--variant-$v`. | `render <id>` followed by `coverage <id>` **always** reports a viewport gap, and `selfreview` sees no metas at all. Only the composer's hand-typed flags produce what the gates read. |

## Open — minor, accepted as a batch or fixed in passing

| # | Finding |
|---|---|
| S12a | `surfaces` and `selfreview` silently swallow every extra argument while `coverage` refuses unknown args — three argument policies in one script. |
| S12c | `composer-scope-check.sh` and `critic-scope-check.sh` use `[A-Za-z]:/*`, a bracket **range**, in the file that spells out the locale-collation rule longhand 60 lines earlier. No bypass (every drive letter is inside the range under any collation), but inconsistent with the file's own stated rule. |
| S12d | **Pre-existing and out of scope:** `COLOUR_PAT` in the `check` branch uses `\b`, a GNU grep extension BSD grep does not honour. Predates this branch (`1968a230`), sits in the same subcommand family, would misbehave on the macOS leg. Recorded so it is not rediscovered as new. |

---

## Closed by `05fc34d0` — kept here so the next attacker prompt can carry them

Per the mandatory-verification rule, an attacker's prompt carries this lane's running list of
already-fixed defects with the instruction to check each one **in every other file**. That is
what this section is for; it is not a changelog.

1. `design-explore.sh init` hung **forever** on a trailing `--brief` (`shift 2` with one arg
   fails and shifts nothing, `set -e` off, `$1` re-read until the job times out; rc=124
   confirmed). The identical defect `design-render.sh` documents in a nine-line comment, that
   five of its tests pin, and that this file's own `coverage` branch fixes correctly 160 lines
   below. Its `*) shift;;` catch-all also swallowed `--breif` silently.
2. `coverage` printed "coverage ok" over an **empty** viewport set — the loop never iterated and
   reported clean.
3. `--brief` resolved against `$ROOT` in `init` and against cwd in `coverage`.
4. An escaped pipe in a manifest prose cell shifted every awk field right, so an **empty**
   revision cell substantiated a row. Field count is checked before the cells are read.
5. `_meta_for` picked by `ls | head -1`, i.e. by `LC_COLLATE`, when a session held more than one
   route — so **which** meta the gate compared differed per OS leg. Ambiguity is a refusal now.
6. `_sha_of`'s `$` anchor could not match past a CR. MSYS2 sed strips it silently, so a CRLF meta
   read clean on Windows and failed on ubuntu/macOS — an OS-asymmetric gate no Windows-authored
   test can pin.
7. A read of a path literally named `--end` disarmed the composer boundary, because the hook
   fragment forwards `"$@"` and the control verbs were matched positionally.
8. `arc_canon_path` returned `//no-such/f` for a fully-missing ancestry (`//host/share` is a UNC
   path on Cygwin/MSYS, implementation-defined in POSIX).
9. The row-owed check used two `grep -qE` alternatives where the second subsumed the first — a
   dead branch that read as two cases.
10. `awk` stripped literal spaces where the selecting grep accepted `[[:space:]]`, so a
    tab-delimited row was selected and then failed with an unusable message.

## Surfaces the shell attacker probed and found CLEAN

Recorded so the next pass spends its budget elsewhere: the heredoc-vs-pipe subshell trap (not
present), functions defined inside the `for` loop (legal in bash 3.2, `_meta_for` reads `$sess`
at call time), glob failure modes on absent/empty dirs, path canonicalisation across
repo-relative / absolute POSIX / `C:\` backslash-escaped JSON / 8.3-short-name roots **with and
without jq on PATH**, exit-code discipline across 13 hostile paths (no command substitution ever
executed), the `common.sh` promotion (no source-time side effects; both scripts fall back
identically when it is deleted), bash-3.2 compliance across all five changed shell files,
sed/grep portability (POSIX BRE only), CRLF in the manifest itself, the `cmd && false` idiom
under bats' `set -e`, cross-test state leakage and `VAR=x run cmd` (none), and registration
completeness in the two product manifests plus the sync-golden tree manifest.

---

## Sequencing note

L1 comes first and most of the rest follow it. Wiring the gates into the explore flow is what
turns L3, S2 and S4 from "untested" into "testable against the path production actually uses" —
so fixing L1 first means the others get their red-first proof against real invocations rather
than against argv the dispatcher never sends.

Everything on this page is **new code when it is fixed**, so a second two-surface adversarial
pass by fresh agents runs against it before Phase 01 closes. The attacker prompt carries the
"Closed by `05fc34d0`" list above with the standing instruction: check each one in every OTHER
file.

---

## Third pass, 2026-09-16 — the abandoned-boundary change

The change routed by `/arc-change` on 2026-09-16 (stamp + describe, never permissive) was
attacked by two fresh agents before it merged: one on decision logic (12 findings), one on the
shell/OS boundary (8). **One overlap**: both found that `--begin` could exit non-zero after the
redirect had already created the marker. That is the change manufacturing the very abandoned
lock it was built to diagnose.

Most of the logic findings were against the TESTS, not the code. Mutants that kept the suite
green:
- "a stale boundary allows anything that is not a sibling"
- a note on only the refusals a test happened to exercise
- a note printed to stdout, which bats merges into `$output` and Claude Code never shows

| # | Finding | Disposition |
|---|---|---|
| DL-1 / SH-3 | `--begin` exits 2 after writing the marker when the stamp is missing (composer and critic) | **fixed**: body written to a dot-name, stamp optional, moved into place whole |
| DL-2 / DL-3 / DL-4 | tests pinned only the sibling refusal, only some refusal paths, and merged stdout into stderr | **fixed**: every read, write and critic refusal class is walked with `run --separate-stderr` |
| DL-5 | a `.bak` copy: the printed release rebuilds the name from content and never deletes the file that refuses | **fixed**: a filename that disagrees with its content is MALFORMED; malformed markers print first, with release-all |
| DL-6 | `--` in ids lets two composers share one marker file (defect #13 returning through the filename) | **fixed**: grammar forbids `--` and edge hyphens, and caps length at 64 |
| DL-7 | the critic honours forwarded `--end` (defect #7's twin, never carried over) | **ACCEPTED in writing**: see below |
| DL-8 | hostile marker text echoed raw into refusals | **fixed**: ids are validated before any use; a malformed marker prints only its sanitised filename |
| DL-9 / DL-10 | the release for a dirless variant was untested, and every release was relative to cwd | **fixed**: releases are root-anchored; tests execute the printed release from a subdirectory |
| DL-11 | with the critic and a composer both armed, only the first boundary is described | **ACCEPTED (low)**: see below |
| DL-12 | compose-done released without saying so | **fixed**: prints "boundary released" before the gates |
| SH-1 | quadratic zero-strip: 64k zeros held the hook for 79 s | **fixed**: length before shape, strip in one expansion |
| SH-2 | golden manifest stale for the critic | **fixed**: regenerated last |
| SH-4 | refusal cost doubled and grew about 390 ms per marker | **fixed**: pure-bash reader, no re-exec from the write side, at most five described |
| SH-5 | hostile-payload test too long to reach the digit check; zero-pad test did not need the strip | **fixed**: 9-character payload, 8 zeros of padding |
| SH-6 | the `--end` release was not scrubbed of `ARC_SCOPE_FORWARDED` | **fixed**: `env -u` in the printed command |
| SH-7 | age fixtures sat exactly on unit boundaries | **fixed**: +1800 s / +600 s margins |
| SH-8 | BSD tr/sed abort on invalid bytes under UTF-8 | **fixed**: no tr/sed remain on the marker path |

**DL-7 accepted.** A critic fix needs the `10-design-critic.sh` fragment to export
`ARC_SCOPE_FORWARDED`, and that fragment is under `.claude/hooks/**`, which governance keeps
edit-denied. It is also unreachable in production: the dispatcher runs every fragment with the
payload on stdin and no argv. This is recorded rather than fixed, and it needs one owner line in
the fragment whenever a hooks edit is next made.

**DL-11 accepted.** Each refusal describes the boundary that refused, and every release it prints
works. Two boundaries therefore take two rounds of advice, and both rounds are true.

**Found while fixing, not by an attacker:** the bounded reader was bounded in LINES, not bytes.
One marker line of a million zeros held it for over five minutes, and a hook that outlives its
timeout is treated as ALLOW. It is now at most 32 reads of at most 1024 characters, measured at
142 ms on that marker.

### Add to the running defect list for the next attacker
11. `pid=$$` recorded the arming process itself, dead on arrival. A liveness check on it disarms
    everything.
12. Arithmetic on a file field: `a[$(cmd)]` executes inside `$(( ))`, and zero-padded values are
    octal.
13. A redirect group whose last command fails reports failure AFTER creating its file.
14. A cap on lines is not a cap on bytes.
15. A test that reads merged `$output` cannot tell stderr from stdout, and hooks are shown by
    stderr only.
16. A filename separator that is legal inside the fields it separates.

## Fourth pass, 2026-09-16 — code-reviewer on the attacked fix (`343a4fc6`)

The verdict was fix-first, with nothing critical. Every warning was probed, and every warning is
fixed.

| # | Finding | Disposition |
|---|---|---|
| W1 | The five-marker cap limited the message, not the work: every marker was still classified, so 12 junk markers took 6.5 s | **fixed**: past five, NOTHING is read. The refusal gives a glob count and release-all (525 ms on 12 × 40KB junk markers) |
| W2 | A stale `common.sh` refused every Read/Grep/Glob with NOTHING armed, and blocked `--end` too | **fixed**: core is checked only with a marker armed and inside `--begin`; `--end` needs nothing |
| W3 | The write check SOURCED the read check, an executable hook, so an older copy ran its enforcement body inside the write check and allowed writes | **fixed**: the shared reader, grammar and description moved into `core/common.sh` (`arc_cm_load`, `arc_cm_describe`), a library with no enforcement body |
| W4 | Nothing pinned the reader's read cap, and the megabyte case had its keys on lines 1-3 | **fixed**: keys after 40 junk lines must read MALFORMED; a megabyte line before the keys has a time bound; 12 junk markers have a time bound |
| nits | "bytes" meant characters; `printf` was not chained; `2>/dev/null` came after the input redirect; the critic loaded core on the unarmed path; `--end` left temp files; there was no hostile-route, write-side stderr, failing-gates premise or age-branch test | **fixed**, each |

**W2 was not hypothetical.** It happened to this session while it was fixing W3. `common.sh` was
mid-edit and briefly lacked the new reader, and the working-tree hook then refused the session's
own Read of the file it was editing, with nothing armed. The reviewer's "repo-wide lock" is a
measured event, not a projection.

**CI found one more that neither the attackers nor the reviewer found.** On the macOS leg only,
the three critic cases built by `_edit_write` exited 0 with no output. That happened at
`2c8ae714`, BEFORE the critic fix existed, and again at `343a4fc6`. On the same leg, the same
boundary refused the same write when the payload was literal.

- **Cause:** that helper built its JSON with escaped quotes nested inside `"$( )"`. A payload the
  hook cannot parse gives an empty target, and an empty target is allowed.
- **Status:** the cause is inferred, not reproduced, because this box has no bash 3.2. The helper
  now builds the payload with `printf` into a variable and asserts its own fixture first. If the
  inference is wrong, the next macOS run fails on "fixture payload is malformed" instead of on
  "age relaxed", which settles it either way.
- **Settled at `fba9a89e`** (run 35133832959): macOS shard 1/3 ran all four critic cases plus
  every adversarial case (declared 1236, executed 1236), and all of them pass. The only change to
  those cases was the payload spelling.

### Add to the running defect list for the next attacker
17. A cap on the OUTPUT is not a cap on the WORK.
18. Sourcing an executable file for its functions imports its body from whatever version is on
    disk.
19. A precondition checked before the "nothing to do" exit turns every unrelated call into a
    refusal.
20. A test payload built with escaped quotes nested in `"$( )"` can arrive malformed on one leg,
    and an unparseable payload reads as "allowed".

## Fifth pass, 2026-09-17 — the composer Bash boundary (`fd94e8f1`) — fixed, except the owner's BS-4

**Status, updated 2026-09-17:** every row is fixed or accepted in writing except BS-4, which is in the owner's `_dispatch.sh`. The fixes still owe their own attack pass. Originally: the session stopped before any was fixed, so this list was the
work queue for the resume. Two fresh agents attacked `composer-bash-check.sh`. Their findings are
recorded exactly as they reported them: CONFIRMED means they executed it, PLAUSIBLE means they
reasoned it.

### Decision logic

| # | Finding | Status |
|---|---|---|
| **BL-1 (High)** | **The renderer leaks a sibling through the page itself.** The composer writes its OWN `index.html` with `<iframe src="../variant-b/index.html">` and `<iframe src="../matrix.md">`; the write boundary allows it (own dir), the Bash boundary allows the render (own route, own session), and the renderer opens the page as `file://` with nothing restricting subresources. The screenshot in the composer's own session showed the sibling's thesis and the matrix line, and the composer is allowed to Read that PNG. `file:///abs` iframes and JS navigation are the same hole. **Pinning the command is not enough: the page is the attack.** | CONFIRMED, **FIXED** at `ee8d4707` ([ADR-1418](../../../../docs/adr/1418-an-explore-render-is-confined-to-its-own-variant-directory.md)): served from the variant directory; proven on a real browser in [`render-confinement-real-browser.md`](render-confinement-real-browser.md); the attack pass is still owed |
| BL-2 (High, tests) | **Seven mutants keep every case green, and five of them open real bypasses.** M1: the alphabet check deleted, so `;cat<variant-b` placed in the ROUTE position passes; every compound case had its injection after `--viewport`, which a different check refuses first. M3: `-eq 1` loosened to `-ge 1`, so two markers allow variant-b. M4: `arc_cm_load` swapped for a plain read, so a `.bak`-only marker naming variant-b allows it. M7: the core-missing refusal changed to `exit 0` allows variant-b. M9: the no-jq parser blanked is invisible while jq is on PATH. M2 (arity) and M5/M6 (iter and viewport) survive only because the renderer re-checks. | CONFIRMED, **FIXED**: M1, M2, M3, M4, M7 and M9 each have a case that fails on the mutant; M5 (iter) and M6 (viewport) are pinned in the hook and the renderer both |
| BL-3 (Med) | **An unreadable identity allows.** The parser is chosen by `command -v jq`, not by jq working: a broken jq shim (exit 127) makes a composer's `cat` of variant-b exit 0. On the no-jq path, `"agent_type":"ui-composer"` also exits 0. Fix: when the prefilter matched and the identity cannot be read, refuse. | CONFIRMED, **FIXED**: jq is used only after a probe answers, and a payload naming ui-composer whose identity cannot be read exactly refuses |
| BL-4 (Med-low) | `ROOT` comes from the hook process cwd (`git rev-parse`), while the fragment finds the script through `CLAUDE_PROJECT_DIR`. Run from another repo, it reads the wrong marker, so variant-b is allowed. Lane defect #3 again. Fix: take ROOT from `CLAUDE_PROJECT_DIR`. | CONFIRMED in the hook, **FIXED**: ROOT from `CLAUDE_PROJECT_DIR`, pinned from a second checkout |
| BL-5 (Low-med) | A repeated flag lets the last value win (`--session b --session a`, `--mode critique ... --mode explore`). Only the renderer's own duplicate check stops it, and the renderer has no such check for `--viewport`. Lane defect #13 again. Fix: refuse any repeated flag. | CONFIRMED in the hook, **FIXED**: any flag twice refuses; the renderer gains the same for `--viewport` and `--media` |
| BL-6 (Low) | Viewport values are unbounded and not normalised: `99999999999999999999x800`, `0x0` and `01440x0900` all exit 0. `0x0` hung the renderer for 32s. A leading zero never matches the declared viewport. Fix: no leading zero, bounded digits, a maximum. | CONFIRMED in the hook, **FIXED**: 200..4096, no leading zero, in the hook and the renderer alike |
| BL-7 (Low) | The jq and grep parsers disagree: `NUL` inside the command; duplicate `command` keys (jq takes the last, grep the first); duplicate `agent_type`; `tool_name:"Bash"` with no jq. Only a harness-written payload has these shapes. Fix: one parser; refuse control characters after decoding. | CONFIRMED in the hook, **FIXED**: a key given twice, a non-string value, or an escaped control character refuses |
| BL-8 (Low) | The marker is not bound to the calling composer. The payload's `agent_id` is ignored, so a still-running composer A is treated as B once B is armed. Fix: record `agent_id` at the first composer call and refuse a mismatch. | PLAUSIBLE, **ACCEPTED**: composition is serial, so a still-running composer A while B is armed needs the orchestrator to break its own order; revisit with the queued decision to scope the boundaries by identity (PROGRESS, resume step 6) |
| BL-9 (Low) | The identity must match exactly: `UI-Composer`, `arc:ui-composer` and a trailing space all exit 0, so a namespaced plugin install silently disables the check. Fix: lowercase and strip a `*:` prefix. | PLAUSIBLE, **FIXED**: the identity is lower-cased with letters spelled out, stripped of a `*:` prefix and of spaces; the prefilter matches without case |
| aside | `design-render.sh:383` has a literal `\n` before `\|\|`, so the command becomes `agent-browser ... set media light n`, and the fail-closed media check tests a malformed command. | CONFIRMED, **FIXED** at `ee8d4707`, pinned by `design-render-confine.bats` |

Clean on the original: the main session, other agent types and non-Bash tools are untouched;
all shell syntax is refused; `..` in any form is refused; sibling routes and sessions, other modes,
unknown flags, missing values, no marker, two markers and a `.bak`-only marker are refused; no
exit code other than 0 or 2; 16,000 flag pairs were refused in 2.8s; `--end` through Bash is
refused.

### Shell / OS boundary

**Both attackers found the iframe leak independently: BS-1 is BL-1.** They also overlap on
BS-2/BS-3 = BL-2 (mutants M1/M2/M3), on BS-6 = BL-3 + BL-7, and on BS-7 = BL-4.

| # | Finding | Status |
|---|---|---|
| BS-1 (High) | **= BL-1.** An iframe in the composer's own page showed variant-b in its own session's PNG. `img` and `iframe` also reach render state, scripts and the brief. | CONFIRMED, **FIXED** with BL-1 |
| BS-2 (High, tests) | **= BL-2 M1.** No case pins the alphabet on its own: `design-render.sh docs/.../variant-a/index.html;cat${IFS}docs/.../variant-b/index.html --mode explore --session lexos-v1--variant-a` passes once lines 71-74 are deleted. Add injections that ride inside the ROUTE word. | CONFIRMED, **FIXED** with BL-2 |
| BS-3 (Med, tests) | **= BL-2 M2/M3.** The arity guard and the one-marker guard are unpinned: a trailing `--iter` exits 1 (read as ALLOW), and with two markers the last in glob order wins. | CONFIRMED, **FIXED** with BL-2 |
| **BS-4 (Med, inherited)** | **The dispatcher fails OPEN when it cannot capture the payload.** With `TMPDIR` unwritable, `_dispatch.sh:50-51,61` fails the fragment's `< "$input"` redirect with exit 1, which is read as allow. **Every PreToolUse guard has this gap**, not only this one, and `_dispatch.sh` sits under the governance-denied `.claude/hooks/**`. Fix direction: in blocking mode, a failed capture, or a fragment exit other than 0 or 2, blocks. | CONFIRMED, OPEN — owner-side file |
| BS-5 (Med) | **The owner's "one command" is incomplete.** Closing it also needs `.claude/hooks/PreToolUse.d/10-design-composer.sh` added to `products/design/manifest.json` → `files` and the sync golden regenerated; otherwise a selective install ships the check with nothing calling it. The test should also assert the manifest row. | CONFIRMED, **FIXED in the test**: once the fragment is installed, the case also requires the manifest row; the row and the golden follow the install |
| BS-6 (Med, cond.) | **= BL-3/BL-7.** The grep fallback takes the first `agent_type` at ANY depth, and a broken jq shim exits 0. Take top-level keys only; block when the payload names `ui-composer` but its identity cannot be read. | CONFIRMED, **FIXED** with BL-3 and BL-7 |
| BS-7 (Low) | **= BL-4.** ROOT from cwd, not `CLAUDE_PROJECT_DIR`. | CONFIRMED, **FIXED** with BL-4 |
| BS-8 (Low, tests) | The four status-0 cases (main session, other agent, non-Bash, mention) still pass with the script deleted, because the fragment fails open. Pair each with a composer refusal in the same sandbox. | CONFIRMED, **FIXED**: every allow case also proves a composer refusal in its own sandbox, and the fragment now BLOCKS a ui-composer call when the check script is missing instead of failing open |
| BS-9 (Low, harness) | The red-on-purpose fragment case keeps this file's CI job red until the owner acts, which hides any new regression in the other cases. Move it to its own file, or skip it with a counted reason. | CONFIRMED, **FIXED**: the case skips with the owner action as its reason until the fragment is installed |
| BS-10 (Low) | Refusal messages echo `'$ROUTE'` and `'$1'` uncapped: a 20KB word produces 20KB of stderr. Cap every echoed value (lane defect #14). | CONFIRMED, **FIXED**: route, flag and viewport echoes capped in the hook and the renderer |
| BS-11 (Low) | jq on Windows emits CRLF. Git Bash strips the trailing CR in `$( )`, but Cygwin bash or WSL calling `jq.exe` would compare `ui-composer\r` and exit 0. Strip `\r` from AGENT and TOOL. | PLAUSIBLE, **FIXED**: CR stripped from every field read |

Clean (shell): 18 hostile code points (NBSP, the U+2000 space family, zero-width spaces, BOM,
fullwidth solidus and more) are refused under the C, UTF-8 and tr_TR locales. `\ ` in the bracket
is a space. Word-splitting edges refuse. NUL is dropped in the safe direction. `...` components are
not traversal. The renderer's own `_no_redefine` refuses a repeated `--mode`, `--session` or
`--iter`. Large payloads cost 0.5-1.3s, and argv limits keep a flag flood well short of the
timeout. The golden row matches. The `_bp` round-trip is exact. bash 3.2 (macOS) is unverified.

**Process defect, for the next pass:** the two attackers shared one scratchpad. One overwrote the
other's `sb.txt`, and between 02:56:57 and 02:57:50 its mutations ran inside the other's sandbox,
`tmp.Cz0ZU6JXrT`: lines deleted, then restored, and a marker added. Every BS result was re-run in a
private sandbox. BL results obtained inside that window against `tmp.Cz0ZU6JXrT` should be treated
as unverified. **Give each attacker its own sub-directory.**

**What BL-1 changes about the plan.** The Bash boundary is necessary and not sufficient. Blindness
now also needs the RENDER to be confined to the variant directory, for example by serving only
that directory over loopback or by blocking every request outside it and refusing a capture whose
frames left it. That is a renderer change and a design decision, so route it through `/arc-change`
before Phase 01 closes.

## Sixth pass, 2026-09-17 — the render confinement (ADR-1418, `a9f35240`)

Two fresh agents, one on the decision logic and one on the shell / OS boundary, each in a private
scratch dir, each prompt carrying the running defect list. **Neither found a way to get a byte from
outside the variant into a render.** The decision attacker built the one mutant that matters,
`inside()` deleted, and it leaked through a junction; the symlink and junction cases catch it. Real
renders used: 0 and 1, the second by accident (below).

| # | Finding | Disposition |
|---|---|---|
| CD-1 (Med-low) | **Over-refusal worded as an accusation.** A broken link to the page's own asset refused as "the page left its variant directory". The browser turns `../variant-b` into `/variant-b` before asking, so the server sees a sibling reference and a typo'd stylesheet link as the same `missing` request. CONFIRMED. | **FIXED**: both still refuse; the refusal now says "asked for something that is not one of its own files" and explains only the kinds the record holds, `missing` naming the broken-link reading. New case pins it. |
| CD-2 (Low, tests) | The colon check (NTFS `::$DATA` stream, drive letter) had no case; deleting it served `/tokens.css::$DATA` with a 200 on Windows. CONFIRMED. | **FIXED**: both paths join the traversal loop, and a new server case asserts each check's kind (`missing` / `outside` / `malformed` / `violation`), which moves on every leg when a check is deleted. |
| CD-3 (Low) | The raw pre-decode check was fully subsumed by the decoded one and unpinnable. CONFIRMED. | **REMOVED**, with the reason in the comment. The decoded backslash check is now pinned by kind. |
| CD-4 (info) | A violation report arriving after the record is read loses detection only; the load is still blocked. PLAUSIBLE. | **ACCEPTED**: the same class ADR-1418 already accepts for `file://`. |
| CS-1 (Low, tests) | `3>&-` on the server spawn was a surviving mutant: every exit bats can see runs the trap that kills the server first. CONFIRMED mechanism. | **PINNED statically**, saying so: a dynamic case needs a SIGKILLed renderer and an orphan this suite cannot reap on Windows. |
| CS-2 (Low, tests) | No Windows junction case; the symlink case skips on Git Bash. CONFIRMED (the junction escape itself was refused). | **FIXED**: a junction case, guarded to Windows, requiring the junction to exist before it asserts. |
| running #15 | The suite's merged `$output` could not tell a stderr refusal from a stdout one. | **FIXED**: `_run_bounded` keeps `stderr` apart; every refusal assertion reads it. |

**Found by CI, not by either attacker:** the two concurrency cases in `design-render-session.bats`
went red on four legs of run 35186056146, because the fake browser kept ONE `url` file. Three
concurrent explore renders read each other's loopback port and refused one another as "navigated
away". A real agent-browser session answers `get url` for itself, so the fake now keys the URL by
session.

**Clean, by execution:** raw, encoded, double-encoded, backslash and overlong traversal; trailing
dots and spaces; 8.3 names; device names (`/NUL`, `/CON`, `/AUX.html`, `/COM1.txt`: 404, no
hang); UNC; a broken `node` shim and an unwritable `TMPDIR` (both refuse, neither falls back to
`file://`); the lifetime cap; `kill $!` stopping native node under Git Bash; the tab regex under
`C`, `C.UTF-8`, `en_US` and `tr_TR`; a slow report body; 40KB and forged reports (self-refusal
only); three concurrent renders on three ports; a repo path with a space and `&`.

**Process note, both attackers:** a `C:/...` entry prepended to `PATH` in Git Bash is split at the
drive colon, so a fake binary placed there is never found and the REAL one runs. One real render
fired this way before it was caught. `tests/` sandboxes use `mktemp -d` (`/tmp/...`) and are not
affected; any future harness that prepends a Windows-form dir is.

### Add to the running defect list for the next attacker
21. A fake that keeps one state file for what a real system keeps per session makes concurrent
    callers read each other's state.
22. When a normaliser upstream erases the difference between two causes, a refusal may not name
    the worse one.
23. A check that a later check always repeats cannot be pinned; delete it, or pin it by the
    classification only it produces.
24. A `C:/` directory prepended to `PATH` in Git Bash is split at the colon and silently not
    searched.

## Seventh pass, 2026-09-17 — the fifth-pass fixes (`81a59499`)

Two fresh agents, decision logic and shell / OS, in private scratch dirs, with the defect list at
24. **Neither found a real composer call that runs anything but its own render.** The shell
attacker found one way to make the check not answer at all, which reads as allow.

| # | Finding | Disposition |
|---|---|---|
| **S1 (High)** | **A command of ~180k words outlived the hook timeout.** The command was split into its words and `core/common.sh` was then sourced with all of them in `$@`, and the cost grows with the word count: 30k words 2.2 s, 120k 14.7 s, 240k 129 s. A timed-out hook is read as ALLOW. CONFIRMED. | **FIXED**: the command is refused above 400 bytes before anything whose cost depends on it; a real render is under 200. Pinned by the refusal MESSAGE, so a later refusal after the slow part does not pass. |
| S1-esc (Med) | On that timeout, a padded sibling render would render the sibling into the composer's own session. PLAUSIBLE. | **Closed with S1.** |
| S2 (Med) | The dispatcher fails open when it cannot capture the payload. CONFIRMED. | **= BS-4, the owner's `_dispatch.sh`.** Still open. |
| F1 (Low-Med) | The escaped-control-character refusal ran before the identity check, so the MAIN session's own probes that mentioned UI-Composer were blocked. Running defect #19. CONFIRMED. | **FIXED**: it runs only once the caller is known to be a composer running Bash. |
| F2 (Low-Med) | An empty or truncated check script exited 0 and allowed a composer; the fragment only caught a missing one. CONFIRMED. | **FIXED**: the script ends in a sentinel line. Without it, or with an exit other than 0 or 2, the fragment blocks a composer and nobody else. |
| F3 (Low) | With the script missing, the fallback blocked any agent that only mentioned ui-composer. CONFIRMED. | **FIXED**: the fallback reads the `agent_type` value, case-blind, with an optional namespace. |
| F4 (Info) | A key spelled with a JSON escape, or split from its colon by a line break, was invisible to the raw count and read as absent. CONFIRMED. | **FIXED**: with jq working, jq decides presence and must agree with the raw count; the grep reader treats any `\u` escape as unreadable. |
| F5 (Info) | Every CR was stripped from the command, so the command checked was not the command run. CONFIRMED, no leak. | **FIXED**: one trailing CR (jq.exe's line end) is removed; any other CR stays, and the alphabet refuses it. |
| F6 (Info) | Five of the renderer's refusal echoes were still uncapped. CONFIRMED. | **FIXED** and pinned. |
| F7 (Info) | Only a `:` namespace is understood. PLAUSIBLE. | **ACCEPTED**: `plugin:agent` is the harness's real form (this session's agent list uses it); the others are not. |
| SM1-SM9 | Surviving mutants: the grep reader's empty-value refusal, the viewport's upper width and lower height bounds, the four-digit first-digit class (in both the hook and the renderer), a duplicate `tool_name`, and a case-sensitive fallback. | **Each has a case now.** |
| running #15 | The renderer's new cases grepped merged output. | **FIXED**: `run --separate-stderr`. |
| running #17 | The marker count did not stop at 2. | **FIXED**. |
| running #20 | Escaped quotes nested inside `"$( )"` in the jq reader. | **FIXED**: the jq programs are single-quoted and joined to the path. |

**Clean, by execution:** identity normalisation under `C`, `tr_TR.UTF-8` and `en_US.UTF-8`; a broken
jq; duplicate keys; a non-string identity; `CLAUDE_PROJECT_DIR` spelled with backslashes, `C:/`, a
trailing slash, `..`, `.`, or a space and `&`; payloads up to 1.5 MB in 0.8-2.6 s.

**Process note:** the Write tool decodes a `\uXXXX` sequence into the raw character. One attacker's
payload generator and this session's own comment both landed a real NUL that way. Build escapes
from a backslash variable.

### Add to the running defect list for the next attacker
25. Length before shape: a check whose cost grows with its input fails open on the hook timeout
    unless the input is capped before any work that scales with it.
26. A refusal that runs before the caller is known scopes everyone.
27. "The script exists" is not "the script is whole": give it a sentinel and read the exit code.
28. The Write tool turns a `\uXXXX` escape in its content into the character itself.
