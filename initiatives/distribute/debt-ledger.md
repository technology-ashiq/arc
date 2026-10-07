# debt-ledger.md — LOW leftovers and accepted findings (ADR-2011)

One row per finding that was not fixed in its PR, with the reason and the trigger that reopens it.

| # | Source | Finding | Disposition | Reopen when |
|---|---|---|---|---|
| 1 | attack c4e1d7d r1 boundary B2 | the probe passes raw text to `parseYamlSubset`, which rejects CR bytes, so a CRLF checkout fails on Windows | accepted: `.gitattributes` forces `eol=lf` on `*` (`git check-attr eol engine/harnesses.yaml` = `lf`); stripping CR in the probe would hide a real CR in the committed file | a CI leg reports a CR parse error on `engine/harnesses.yaml` |
| 2 | attack c4e1d7d r1 boundary B9 (+ first run B10/B11) | dropping the ignore lines protects only clones that already moved their local `.codex/` aside; another clone could `git add -A` a machine-path `hooks.json` | mitigated, not closed: on 2026-10-07 all 17 worktrees were swept and none holds `.codex/`, `.agents/` or `AGENTS.md`; the main clone's copies are in the private archive. P01's `pre-commit` gains a drive-letter-path refusal for `.codex/**` (fixed-defects class d) | any tracked file under `.codex/` or `.opencode/` contains a `[A-Z]:\\` path |
| 3 | attack c4e1d7d r1 boundary B3 (low) | an absolute MSYS temp path handed to native node may resolve differently | fixed in the same commit via `native()` (`cygpath -m`); listed here only because the attacker graded it low | — |
