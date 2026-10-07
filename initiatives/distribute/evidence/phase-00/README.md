# Phase 00 evidence — distribute

Closed 2026-10-07 via `/arc-phase-done 00 --lane distribute`, from the main clone.

## PR A — the birth PR

- **PR #371** merged as `74aae21a`, with head `e99d421b` confirmed before the squash.
- **CI run `37576214357`:** 19/19 jobs green, read per job with `ci-digest.mjs` and the head SHA asserted.
- **Earlier run `37561831851` (head `1031f72d`):** green after one rerun. `selftest (windows-latest, shard 9/12)` hit its 60-minute job timeout inside the bats step, and GitHub kept no log (BlobNotFound). That is the known intermittent Windows shard hang (memory `windows-ci-shard-hang-suspects`). The `--failed` rerun went green.
- **Two conflicts on `docs/wiki/index.md`:** both were with other lanes' merges (#361, then #366/#360). Each was resolved by re-running `wiki-build.mjs` and `face-sections.mjs`, never by hand. `wiki-build --check` passed each time.
- **`/arc-attack`:** two rounds per surface.
  - Boundary rounds: `c4e1d7d` and `22fddfc`.
  - Logic rounds: `22fddfc` r1 and `5d3f91b` r2.
  - The result JSONs are in this directory. Fixes are recorded in `fixed-defects.md` classes (l)–(u), and rejections in `debt-ledger.md`.
  - The first boundary-only run's JSON is kept under `r1-failed/`, because its logic surface ran on a saturated free model.

## Receipts on the canonical spine (`E:/Work_Hub/01_Automemory/arc/.claude/state/hq/events/2026-10-07.jsonl`)

| Kind | ULID | Notes |
|---|---|---|
| `kickoff.done` | `01M4AJMX1N0ZYRN12H9KSJVF61` | goal + tier M |
| `approval.requested` | `01M4AJMXD7QKGB4G3P8DW08FJY` | the ADR-2000 ruling, gate `lane-birth` |
| `decision.recorded` | `01M4AKYMN04722WM5QGJSDDW1R` | the owner's stamp, verdict `approve` |
| `note.logged` | `01M4AQG22Y85433X9KC4BHJV8H` | `harness: opencode` (the spike; see `opencode-spike.txt`, including its payload-label error) |

`events/_quarantine/` holds 0 files containing `distribute@`.

## Other evidence

- `agents-skills-verdict.md` covers the main clone's local `.codex/`, `.agents/` and `AGENTS.md`. They were moved to `~/.arc-private/distribute/local-2026-07-11/`, and 0 of the 8 command skills are faithful.
- `opencode-spike.txt` has the 7 spike attempts and the facts fed into `engine/harnesses.yaml`.
- For the live demo, `git -C E:/Work_Hub/01_Automemory/arc status --porcelain --ignored -- .codex .agents AGENTS.md` printed nothing after the merge, and `tests/distribute/birth-probe.mjs matrix engine/harnesses.yaml` printed `rows 8 · verified 4 · cells 72 · RAN matrix`.

## Owner-actions and the ledger

- **A-02 (OpenCode formats stable enough to golden):** NOT falsified. The command and agent formats loaded as documented. The facts the spike found are recorded in the matrix header, and the row stays pinned at 1.17.18.
- **A-03 (the spine accepts `harness`):** holds. No vocab ADR.
- **A-06 (nothing outside the repo reads the local `.codex/` / `.agents/`):** no failure reported since the move.
