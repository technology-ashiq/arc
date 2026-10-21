# CI read -- PR #449 head d8f03de (merged as 6012c36)

Read from CI, not re-run on the box (testing.md). Source: `gh run view 39551997252 --log`, grepped.

## ci-digest

```
arc-ci -- run 39551997252 @ d8f03de9a837 -- 19 job(s) -- https://github.com/technology-ashiq/arc/actions/runs/39551997252
  ✓ ci-tier -- success
  ✓ selftest (windows-latest, 20, shard 10/12) -- success
  ✓ selftest (windows-latest, 20, shard 12/12) -- success
  ✓ selftest (macos-latest, 20, shard 1/3) -- success
  ✓ selftest (windows-latest, 20, shard 4/12) -- success
  ✓ selftest (ubuntu-latest, 18) -- success
  ✓ selftest (windows-latest, 20, shard 1/12) -- success
  ✓ selftest (windows-latest, 20, shard 7/12) -- success
  ✓ selftest (ubuntu-latest, 20) -- success
  ✓ selftest (macos-latest, 20, shard 3/3) -- success
  ✓ selftest (windows-latest, 20, shard 3/12) -- success
  ✓ selftest (macos-latest, 20, shard 2/3) -- success
  ✓ selftest (windows-latest, 20, shard 5/12) -- success
  ✓ selftest (ubuntu-latest, 22) -- success
  ✓ selftest (windows-latest, 20, shard 6/12) -- success
  ✓ selftest (windows-latest, 20, shard 2/12) -- success
  ✓ selftest (windows-latest, 20, shard 8/12) -- success
  ✓ selftest (windows-latest, 20, shard 9/12) -- success
  ✓ selftest (windows-latest, 20, shard 11/12) -- success
GREEN: every job concluded green.
```

## face-browser 119063062195 (selftest (macos-latest, 20, shard 1/3))

```
ok 1 face-browser: the node floor is reported, and only Node 18 may skip
ok 2 face-browser: the lockfile carries this platform's native packages (offline)
ok 3 face-browser: a planted console error and exception are seen over REAL Chrome
ok 4 face-browser: npm ci and vite build succeed in a copy of face/
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=dark mood-miss=0
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=light mood-miss=0
# sessions: ok rooms=9 reloads=9 attach=ok starts=0 control=1
# flows: ops=32 ok=32 fail=0 live=ok live-ms=16 page-errors=0
ok 5 face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods
ok 6 face-browser: MUTANT CONTROL -- the front-door verdict refuses a short run, a failed check, a wrong mood and no line
ok 7 face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run
ok 8 face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run
ok 9 face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must
ok 10 face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic
ok 11 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 12 face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran
ok 13 face-browser: this file runs no inline program text
ok 14 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## face-browser 119063062306 (selftest (ubuntu-latest, 18))

```
ok 2068 face-browser: the node floor is reported, and only Node 18 may skip # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 2069 face-browser: the lockfile carries this platform's native packages (offline)
ok 2070 face-browser: a planted console error and exception are seen over REAL Chrome
ok 2071 face-browser: npm ci and vite build succeed in a copy of face/ # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 2072 face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 2073 face-browser: MUTANT CONTROL -- the front-door verdict refuses a short run, a failed check, a wrong mood and no line
ok 2074 face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run
ok 2075 face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run
ok 2076 face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must
ok 2077 face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic
ok 2078 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 2079 face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran
ok 2080 face-browser: this file runs no inline program text
ok 2081 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## face-browser 119063062360 (selftest (ubuntu-latest, 20))

```
ok 2068 face-browser: the node floor is reported, and only Node 18 may skip
ok 2069 face-browser: the lockfile carries this platform's native packages (offline)
ok 2070 face-browser: a planted console error and exception are seen over REAL Chrome
ok 2071 face-browser: npm ci and vite build succeed in a copy of face/
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=dark mood-miss=0
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=light mood-miss=0
# sessions: ok rooms=9 reloads=9 attach=ok starts=0 control=1
# flows: ops=32 ok=32 fail=0 live=ok live-ms=1 page-errors=0
ok 2072 face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods
ok 2073 face-browser: MUTANT CONTROL -- the front-door verdict refuses a short run, a failed check, a wrong mood and no line
ok 2074 face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run
ok 2075 face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run
ok 2076 face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must
ok 2077 face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic
ok 2078 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 2079 face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran
ok 2080 face-browser: this file runs no inline program text
ok 2081 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## face-browser 119063062426 (selftest (ubuntu-latest, 22))

```
ok 2068 face-browser: the node floor is reported, and only Node 18 may skip
ok 2069 face-browser: the lockfile carries this platform's native packages (offline)
ok 2070 face-browser: a planted console error and exception are seen over REAL Chrome
ok 2071 face-browser: npm ci and vite build succeed in a copy of face/
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=dark mood-miss=0
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=light mood-miss=0
# sessions: ok rooms=9 reloads=9 attach=ok starts=0 control=1
# flows: ops=32 ok=32 fail=0 live=ok live-ms=1921 page-errors=0
ok 2072 face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods
ok 2073 face-browser: MUTANT CONTROL -- the front-door verdict refuses a short run, a failed check, a wrong mood and no line
ok 2074 face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run
ok 2075 face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run
ok 2076 face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must
ok 2077 face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic
ok 2078 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 2079 face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran
ok 2080 face-browser: this file runs no inline program text
ok 2081 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## face-browser 119063062323 (selftest (windows-latest, 20, shard 1/12))

```
ok 1 face-browser: the node floor is reported, and only Node 18 may skip
ok 2 face-browser: the lockfile carries this platform's native packages (offline)
ok 3 face-browser: a planted console error and exception are seen over REAL Chrome
ok 4 face-browser: npm ci and vite build succeed in a copy of face/
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=dark mood-miss=0
# smoke: opened=36 openable=36 errors=0 excluded-errors=0 unsettled=0 expected=36 not-opened=lane mood=light mood-miss=0
# sessions: ok rooms=9 reloads=9 attach=ok starts=0 control=1
# flows: ops=32 ok=32 fail=0 live=ok live-ms=11 page-errors=0
ok 5 face-browser: door + preview + smoke open every openable room with 0 errors, in BOTH moods
ok 6 face-browser: MUTANT CONTROL -- the front-door verdict refuses a short run, a failed check, a wrong mood and no line
ok 7 face-browser: MUTANT CONTROL -- the sessions verdict refuses a start with no click, a dead counter and a short run
ok 8 face-browser: MUTANT CONTROL -- the flows verdict refuses a short, failed, slow or erroring run
ok 9 face-browser: MUTANT CONTROL -- the rehearsal, planned and runner verdicts refuse what they must
ok 10 face-browser: MUTANT CONTROL -- the render verdict FAILS a shell that drew every room generic
ok 11 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 12 face-browser: MUTANT CONTROL -- the verdict FAILS a mood run in the wrong mood, and a mood that never ran
ok 13 face-browser: this file runs no inline program text
ok 14 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

**Narrower than written, stated:** the spec expected a `34/34 front door` line per leg; this run prints no such line. The front-door evidence it does carry is `smoke: opened=36 openable=36 errors=0` in both moods, and the face-browser bats rows passing (`ok N face-browser: ...`, MUTANT CONTROL included).
