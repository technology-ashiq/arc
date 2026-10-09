# debt-ledger.md — LOW leftovers and accepted findings (ADR-2011)

One row per finding that was not fixed in its PR, with the reason and the trigger that reopens it.

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack c4e1d7d r1 boundary B2 | the probe passes raw text to `parseYamlSubset`, which rejects CR bytes, so a CRLF checkout fails on Windows | accepted: `.gitattributes` forces `eol=lf` on `*` (`git check-attr eol engine/harnesses.yaml` = `lf`); stripping CR in the probe would hide a real CR in the committed file | a CI leg reports a CR parse error on `engine/harnesses.yaml` |
| 2 | attack c4e1d7d r1 boundary B9 (+ first run B10/B11) | dropping the ignore lines protects only clones that already moved their local `.codex/` aside; another clone could `git add -A` a machine-path `hooks.json` | mitigated, not closed: on 2026-10-07 all 17 worktrees were swept and none holds `.codex/`, `.agents/` or `AGENTS.md`; the main clone's copies are in the private archive. the drive-letter refusal for rendered dirs lands with the P03 `[dirty]`/render checks, where `.codex/` is first written (moved from P01: P01 has no rendered dir to guard) | any tracked file under `.codex/` or `.opencode/` contains a `[A-Z]:\\` path |
| 3 | attack c4e1d7d r1 boundary B3 (low) | an absolute MSYS temp path handed to native node may resolve differently | fixed in the same commit via `native()` (`cygpath -m`); listed here only because the attacker graded it low | — |
| 4 | attack 22fddfc r1 boundary B6 (low) | an EPIPE on a closed stdout is raised asynchronously and could escape the probe's catch | accepted: bats captures the whole output, so nothing closes the pipe early | a probe is ever piped into `head` or `grep -q` |

Rejected in attack 22fddfc round 1 (ADR-0067 taxonomy):

```
REJECTED: L3 mutant assumes 4-space indent — already-covered
REJECTED: L4 / B8 mutant grep also matches source-command-arc-pr-extra — already-covered
REJECTED: L5 / L14 empty-stderr requirement too strict for node warnings — unsupported
REJECTED: L6 cd "$ARC_ROOT" unquoted — unsupported
REJECTED: L7 / L8 / L9 / L13 / L15 no concrete defect — non-actionable
REJECTED: L10 golden_transform assumed single-line — non-actionable
REJECTED: L12 duplicate key in a row silently accepted — already-covered
REJECTED: B1 CRLF .gitignore makes the pattern carry a CR — already-covered
REJECTED: B9 machine path in evidence breaks the public-repo rule — already-covered
REJECTED: B10 relative vs absolute probe arguments — non-actionable
```
(L3/L4/B8: the regexes were already structural in 22fddfc; L5/L14: this probe emits no warning; L6: it is quoted; L12: `parseYamlSubset` rejects a duplicate key by name; B1: `.gitattributes` forces `eol=lf`, and the copy now strips CR anyway; B9: 83 files on `main` already carry that path, and it is not owner PII.)

Attack 5d3f91b round 2 (logic; boundary had its two rounds at c4e1d7d and 22fddfc). Fixed: L3, L9, L11 (`init --template=`). Rejected:

```
REJECTED: L2 the all-dates mutant should delete exactly one date — already-covered
REJECTED: L5 an unverified row must carry no date — unsupported
REJECTED: L7 partial: accepts a leading space — already-covered
REJECTED: L4 a FAITHFUL seo-article-writer row is accepted — non-actionable
REJECTED: L6 a pipe inside a cell reclassifies it — already-covered
REJECTED: L12 compare the raw golden line with the parsed value — non-actionable
REJECTED: L1 / L14 symlinked ARC_ROOT, POSIX paths — non-actionable
```
(L2: the arm asserts every row is reported undated while the real tree reports none; L5: ADR-2003 dates every row, unverified included, so the date says when the absence was declared; L7: the regex is `^partial:\S`; L6: a stray pipe changes the cell count, which is illegal.)

| 5 | attack 5d3f91b r2 logic L8/L13 (medium) | the seed-dir check compares counts (0 = 0) with no named-set equality or planted-seed negative control | deferred: 0 FAITHFUL rows and no `codex-seed/` dir exist, so the check has nothing to compare | any `FAITHFUL` command row or any `codex-seed/` dir appears |
| 6 | attack 5d3f91b r2 logic L15 (low) | the four probed ignore paths are hard-coded rather than derived from the matrix's rendered directories | deferred to P03, when the adapters declare their rendered directories in `engine/harnesses.yaml` | P03 adds a rendered directory |

Attack 4f5dfc7 round 1 (P01). Fixed: B1, B2, B4 (version check + allow-marker count printed), B5, B6, B7, B8, L1, L2, L4, L6, L7, L8, L9-L12, B10 (slug validated; union of the newest 3 PRs). Rejected:

```
REJECTED: B3 single-parent HEAD scans only the last commit — already-covered
REJECTED: B9 a non-.sh file in a blocking dir is enforced — unsupported
REJECTED: L3 a CRLF event file hides blocking — already-covered
REJECTED: L5 a skip word inside a string is a false gap — non-actionable
REJECTED: L13 setext and trailing-hash headings — out-of-appetite
REJECTED: L15 zero headings checked passes vacuously — already-covered
```
(B3: the PR run is a merge ref, and a single-parent HEAD prints that it scanned the last commit only; B9: `_dispatch.sh` runs `[0-9]*.sh` only, and the derivation now uses that exact glob; L3: the event text is CR-stripped before the regex; L5: a false gap is the safe direction for a merge-time truth; L15: the bats asserts `[1-9][0-9]* headings`.)

| 7 | attack 4f5dfc7 r1 boundary B4 (part) | `gitleaks:allow` lets a change's author waive the merge-time secret gate on any line | accepted, made visible: the scan prints how many added lines carry the marker; a PR that edits its own gate is visible in the same diff | a merged PR is found carrying a real credential behind the marker |
| 8 | attack 4f5dfc7 r1 logic L14 (low) | `rule-propose --home AGENTS.md` skips the existence check `.claude/rules/*.md` homes get | accepted: AGENTS.md is tracked on main from this PR on, the same standing CLAUDE.md has | AGENTS.md is ever removed from main |

Attack 7c55982 round 2 (P01; the cap). Fixed: L2, L6, B2, B11 (selftest copies dereference symlinks). Rejected:

```
REJECTED: L1 a marker sharing a line with a comment is consumed — non-actionable
REJECTED: L3 / B12 a conditional or heredoc exit in a hook — non-actionable
REJECTED: L4 a non-executable fragment is a false gap — unsupported
REJECTED: B3 in-tree .gitattributes still alters the diff — already-covered
REJECTED: B4 gitleaks:allow waives the gate — duplicate
REJECTED: B5 a final line with no newline is uncounted — unsupported
REJECTED: B6 a depth-1 fetched parent lacks its tree — unsupported
REJECTED: branch-guard detached HEAD and short ref forms — unsupported
REJECTED: L13 a stand-in binary can print v8 — non-actionable
REJECTED: L14 / L15 heading and fragment counts not exact — already-covered
```
(L1/L3/B12: each errs toward a false finding, the safe direction for a gate; L4: `_dispatch.sh` runs `bash "$f"`, so the exec bit is irrelevant; B3: `--text --no-textconv` was tested against a committed `*.dat binary` attribute and the key was caught; B4: debt row 7; B5: awk emits a newline per added line; B6: a depth-1 fetch of a commit brings its tree, and a failed fetch exits 2; branch-guard: pre-push always receives the full remote ref, and the server is the truth; L13: a runner that controls PATH controls CI anyway; L14/L15: counts are asserted against an independent derivation.)

| 9 | attack 7c55982 r2 L5 | a `skip` reached through a loaded helper escapes the lexical skip check | accepted: catching it needs executing the test; the merge-time test body itself is checked | a merge-time row's test is found skipping on a CI log |
| 10 | attack 7c55982 r2 B7 | `.githooks/*` call bare `bash`; a PowerShell-launched git could resolve WSL bash | watch (A-04): git for Windows runs hooks inside its own MSYS environment; the owner's main clone is checked when `core.hooksPath` is set | a commit from PowerShell shows the hook running under WSL or silent |
| 11 | attack 7c55982 r2 B10 | `arc-doctor` trusts gh stdout on a non-zero exit when it contains "Branch not protected" | accepted: the text must still parse as GitHub's exact 404 object | a gh wrapper is found printing that body on another failure |
| 12 | attack 85d2416 r1 boundary B6 (low) | `arc-compile` calls `process.exit` right after `console.log`, so a large `[dirty]` listing on a Windows pipe could lose its last line | accepted: the pattern predates P02 across the whole file and its output is a few lines; the suites assert the summary line, so a truncation fails loudly rather than passing | a CI leg fails with the summary line missing, or a listing grows past a screen |

Rejected in attack 85d2416 round 1 (ADR-0067 taxonomy):

```
REJECTED: L1 a repeated --target with a different value overwrites -- unsupported (value() refuses it, exit 2)
REJECTED: L2 --input without --all processes zero files -- unsupported (refused, exit 2)
REJECTED: L3 description: --- read as the closing line -- unsupported (only an exact --- line closes)
REJECTED: L4 a backslash path passes confineRel -- unsupported (the regex refuses any backslash)
REJECTED: L5 a flag-shaped file name under a rendered dir -- non-actionable (no reader passes it as argv)
REJECTED: L6 a symlink named x.md is read -- already-covered (flagged before the read)
REJECTED: L8 an empty row id joins the id list -- unsupported (ROW_ID refuses every empty target)
REJECTED: L9 an empty targets entry hides a duplicate -- unsupported (every entry joins the duplicate set)
REJECTED: L10 a symlink named .. -- unsupported (readdir never returns it)
REJECTED: L11-L15 version key, missing processes dir, BOM, unquoted false, no frontmatter -- non-actionable (each fails closed by design)
```

Attack 74bcf43 round 1 (P03), boundary. B1-B7, B9, B11 and B12 fixed ((ar)-(ay); B12: the rollback line names directories kept because something else is in them). Logic round 1 on qwen3.8-27b failed to run; the re-run on deepseek-v4-flash returned `findings: []` in 19 s on a 126 KB diff, recorded as an unconfirmed clean result, and round 2 attacks logic again.
```
REJECTED: B8 sync folds every installer failure into exit 3 -- by design (exit 3 is sync's documented install-failure code since Phase 04 of the products lane; the installer's own lines, with its reason, are printed to stderr first)
REJECTED: B10 every CR is stripped, not only CRLF -- by design (REQ-04 hashes through the sync golden's own transform, tr -d '\r', so identity and the golden agree byte for byte)
```

Attack d32e714 round 2 (P03). Fixed: B1-B5 and L8, as (at) revised and (az)-(bd).
```
REJECTED: L1/L2 a/../../x escapes the target -- already-covered (confineRel refuses every `..`, `.` and empty segment)
REJECTED: L3/L4/L9 a non-string frontmatter value -- unsupported (parseFrontmatter yields raw strings only; targets entries are checked by frontmatter-lint against the verified rows)
REJECTED: L5 JSON.stringify escapes an apostrophe -- unsupported (it does not)
REJECTED: L6 a tab forces the basic string -- unsupported (the control-character class already excludes 0x09)
REJECTED: L7 the wildcard check runs before :* is stripped -- unsupported (it runs on the stripped scope)
REJECTED: L10-L15 -- non-actionable (the attacker's own text says no defect, or N/A)
```
| 13 | B6 (attack d32e714): sync always passes `--force`, so the first sync over a consumer with no install record backs up every arc file whose bytes changed into `.arc-install-backup/` | `sync-to-project.sh` full mode, `install-targets/common.mjs` | it keeps a recoverable copy of anything overwritten, which the old copy loop never did | consumer repos gain an untracked backup directory per upgrade | a consumer reports the directory as noise, or a second upgrade: then seed the record from the previous sync golden's sha set |

Attack 188f724 round 1 (P04). Boundary B1-B7 fixed as (bg)-(bj); B8 (spawnSync maxBuffer) fixed with a 64 MiB cap on the dispatcher's child runs. Logic re-run on deepseek-v4-flash after the first logic run failed: L6, L11 fixed.
```
REJECTED: L1 an empty --dir value -- unsupported (the value check refuses "" by name)
REJECTED: L2/L4 `--` and an unknown flag exit 2 -- by design (a closed flag set; an unknown flag is a usage error, the lane's flag rule)
REJECTED: L3 --dir is not checked before the installer -- by design (arc-install judges the directory after printing its plan, REQ-10's RAN contract)
REJECTED: L5 --quiet is undocumented for arc-install -- unsupported (arc-install accepts --quiet; the dispatcher forwards it)
REJECTED: L7 the node check runs after the imports -- non-actionable (node: imports exist on every Node package.json's engines admits)
REJECTED: L8/L14 cygpath absent, bats array semantics -- already-covered (the same helpers run on all 3 legs in 7 P03 suites)
REJECTED: L9 the npm cache is not cleared -- unsupported (BATS_TEST_TMPDIR is fresh per test)
REJECTED: L10 the head SHA may be short -- unsupported (the test asserts 40 hex before use)
REJECTED: L12 compile with no args -- by design (arc-compile prints its own usage, exit 2)
REJECTED: L13 a repo whose trunk is master -- out of scope (the fixture names its branches; branch-guard's own rule is main, ADR-2015)
REJECTED: L15 the runbook names the script form -- by design (the script form works in a project that installed arc without the bin)
```
