# Phase 02 — red first

The verification plan's failures, committed as tests before any implementation (`acafbb5d`,
"test(face): Phase 02 red first") and run on CI by workflow_dispatch: **arc-ci run `35221247877`**,
head `acafbb5d447e800b3f41f5427f4ec50ea84c019b`, conclusion `failure`, 11 of 19 jobs success and 8
failure. Every line below was read from the job logs (`gh api repos/technology-ashiq/arc/actions/jobs/<id>/logs`).

## What failed

| test | why it failed, in the log's words | on |
|---|---|---|
| `face v2: face-pure FAILs a planted branch in a View and a planted React import in a fold, and the tree is pure` | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../.claude/scripts/core/face-pure.mjs' imported from .../tests/face/face-pure.mjs` | ubuntu 18/20/22 · macOS 1/3 · windows 6/12 |
| `face v2: the module frame attaches both ways, agrees with face-coverage, and no shell file names a room` | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../face/src/lib/registry.mjs' imported from .../tests/face/module-frame.mjs` | same five jobs |
| `face v2: /arc-face-module scaffolds a module green on face-pure + face-coverage, and refuses what it must` | `FAIL the scaffold script exists .../.claude/scripts/hq/face-module.mjs` | same five jobs |
| `face v2: face-coverage's module half FAILs an orphan and an unnamed exemption, and the exemption list is EMPTY` | `module arm missing or failed: an orphan module folder` | ubuntu 18/20/22 · macOS 3/3 · windows 9/12 |
| `L3 logic runs with no install and no build, and every check passes` | `FAIL g goes home` — `g` still opened a room spelled in shell.mjs | ubuntu 18/20/22 · macOS 1/3 · windows 6/12 |
| `face/ imports nothing from .claude, so the repo split stays a directory move` | `an excused file is missing: .../.claude/scripts/core/face-pure.mjs` — the named exclusions for the three new readers of face/src/modules came before the files | same five jobs |
| `face-browser: npm ci and vite build succeed in a copy of face/` | `tsc --noEmit failed (exit 2): face/src/lib/mood.mjs(73,33): error TS7006: Parameter 'mood' implicitly has an 'any' type.` | ubuntu 20/22 · macOS 1/3 · windows 1/12 |
| `face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods` | `no build from the previous test` (it follows the build) | same four jobs |
| `no L3 test or source file carries a byte that makes grep call it binary` | `BINARY-FLAGGED: .../tests/face/face-pure.mjs` | ubuntu 18/20/22 · macOS 1/3 · windows 6/12 |

On ubuntu Node 18 the browser tests are the counted skip, as designed:
`face-browser: node=v18.20.8 floor=below major=18 image=ubuntu24@20260907.300.1`.

The new MUTANT CONTROL for the render verdict passed on every job it ran on (it needs no Chrome
and no build), which is what a control must do before the thing it controls exists.

## Two reds that were not in the plan, and what each was

- **`tsc --noEmit`** was red on code that predates this phase: the typecheck had never run on CI
  (debt-ledger), and its first run found one implicit `any` in `face/src/lib/mood.mjs`
  (`moodToggleLabel`). Fixed with the JSDoc type in `335e4d28`. That is the debt row's point: the
  error existed for a phase and nothing could see it.
- **The binary-byte guard** caught the red-first suite itself: a planted-NUL fixture was written
  with a literal NUL character in `tests/face/face-pure.mjs`, which makes grep treat the whole
  suite as binary and skip it silently in every grep-driven gate. The same failure the guard's own
  comment records from Cycle 15. Fixed in `335e4d28` by building the byte with
  `String.fromCharCode(0)`.
