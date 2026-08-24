# Phase 01 — adversarial pass: the OPEN half

Two fresh agents on different surfaces (decision logic · shell/OS boundary) attacked Phase 01's
three gates on 2026-08-23/24 and returned **26 findings**. Commit `05fc34d0` closed the
mechanical ones. This file is the **open** half, written down because the previous session ended
with them recorded nowhere but its own transcript — and a finding that lives only in a transcript
is a finding that comes back.

**Status of this file:** live worklist. A row leaves it by being fixed with a test that fails
first, or by being accepted in writing with a reason. Nothing leaves it by being forgotten.

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
| L2 | **The read boundary covers `Read` only.** `ui-composer` also holds `Grep` and `Glob`, and either returns a sibling variant's content. | This is **verbatim the assumptions-ledger trigger** written at kickoff. It is FIRED and owed a `/arc-change` route. |
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
