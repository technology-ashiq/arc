# Phase 01 — red first

The verification plan's three expected failures, committed as tests before any implementation
(`97031604`, "test(face): Phase 01 red first") and run on CI by workflow_dispatch:
**arc-ci run `35201425258`**, head `970316041706565dbcc124fff8e7033eed753099`, conclusion
`failure`, 12 of 19 jobs success and 7 failure. Every line quoted below was read from the job logs
(`gh api repos/technology-ashiq/arc/actions/jobs/<id>/logs`), not remembered.

## What failed, and only that

Across the seven failed jobs the failing tests are exactly these four, and no other test failed
anywhere in the run:

| test | failed on |
|---|---|
| `face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods` | ubuntu Node 20 (`105136834225`), ubuntu Node 22 (`105136834182`), macOS shard 1/3 (`105136834256`), windows shard 1/12 (`105136834375`) |
| `face v2: both moods' contrast ratios are computed, above their floors, and match the header` | ubuntu Node 18, 20, 22 · macOS shard 2/3 (`105136834242`) · windows shard 11/12 (`105136834258`) |
| `face v2: tokens-contrast REFUSES a typed header, a low pair and a broken reserved meaning (mutant arms)` | the same five jobs |
| `face v2: the colour-literal lint finds 0 literals in ui/** and modules/**, and FAILs planted ones` | the same five jobs |

On ubuntu Node 18 (`105136834290`) the browser test is the counted skip, as designed:
`ok 1279 face-browser: door + preview + smoke ... # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)`.

## The failures, in the spec's words

**tokens-contrast** (expected: `missing selector html.hq.hq-light` and `missing token --blue`):

```
FAIL missing selector html.hq.hq-light
FAIL dark: missing token --blue
FAIL light: missing token --blue
tokens-contrast: moods=2 pairs=0 findings=41
```

The selftest had nothing to mutate: `tokens-contrast: cannot write: the file has no "BEGIN computed-contrast" ... "END computed-contrast" markers`.

**colour-literal** (expected: `ERR_MODULE_NOT_FOUND` before the lint exists):

```
ERR_MODULE_NOT_FOUND]: Cannot find module '/home/runner/work/arc/arc/.claude/scripts/core/face-colour-literal.mjs'
```

**the smoke mood arm** (expected: `hq-light: class not applied on <html>`), identical on ubuntu,
macOS and windows — every room opened, settled and logged nothing, and every room was in no mood:

```
smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane mood=dark mood-miss=33
smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane mood=light mood-miss=33
smoke: FAIL mood=light -- hq: class not applied on <html> (33 room(s): today,inbox,map,spine,board,ask-arc,...
hq-light: class not applied on <html> (33 room(s): ...        (3 jobs)
XX today settle-ms=1111 mood-miss(html-class="")
```

That run is also the mood arm's own negative control on real Chrome: a room that is perfect on
every Phase 00 count is refused by the mood pair alone.
