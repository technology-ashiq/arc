# debt-ledger.md — LOW leftovers and accepted findings (ADR-2011)

One row per finding that was not fixed in its PR, with the reason and the trigger that reopens it.

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack c4e1d7d r1 boundary B2 | the probe passes raw text to `parseYamlSubset`, which rejects CR bytes, so a CRLF checkout fails on Windows | accepted: `.gitattributes` forces `eol=lf` on `*` (`git check-attr eol engine/harnesses.yaml` = `lf`); stripping CR in the probe would hide a real CR in the committed file | a CI leg reports a CR parse error on `engine/harnesses.yaml` |
| 2 | attack c4e1d7d r1 boundary B9 (+ first run B10/B11) | dropping the ignore lines protects only clones that already moved their local `.codex/` aside; another clone could `git add -A` a machine-path `hooks.json` | mitigated, not closed: on 2026-10-07 all 17 worktrees were swept and none holds `.codex/`, `.agents/` or `AGENTS.md`; the main clone's copies are in the private archive. P01's `pre-commit` gains a drive-letter-path refusal for `.codex/**` (fixed-defects class d) | any tracked file under `.codex/` or `.opencode/` contains a `[A-Z]:\\` path |
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
