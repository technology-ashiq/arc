# Smoke log excerpts — face v2 Phase 00

Generated from arc-ci run `35191693793` (`pull_request`, head `c6cbd330`, conclusion **success**) — the lines each job holding `tests/face-browser.bats` printed, per OS, from `gh run view --log`. Timestamps removed; nothing else edited. Per-job conclusions for all 19 jobs are in `ci-jobs.json`.

## selftest (ubuntu-latest, 18)

```
# face-browser: node=v18.20.8 floor=below major=18 image=ubuntu24@20260907.300.1
ok 1275 face-browser: the node floor is reported, and only Node 18 may skip # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
ok 1278 face-browser: npm ci and vite build succeed in a copy of face/ # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors # skip SKIP: Vite 8 and @tailwindcss/oxide require Node >=20.19 (node=v18.20.8 floor=below major=18)
ok 1280 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 1281 face-browser: this file runs no inline program text
ok 1282 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## selftest (ubuntu-latest, 20)

```
# face-browser: node=v20.20.2 floor=ok major=20 image=ubuntu24@20260907.300.1
# face-browser: RAN leg=linux/v20.20.2 image=ubuntu24@20260907.300.1
# smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane
# face-browser: 33/33 rooms · 0 console errors · 0 exceptions · chrome=/usr/bin/google-chrome
ok 1275 face-browser: the node floor is reported, and only Node 18 may skip
ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
ok 1278 face-browser: npm ci and vite build succeed in a copy of face/
ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors
ok 1280 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 1281 face-browser: this file runs no inline program text
ok 1282 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## selftest (windows-latest, 20, shard 1/12)

```
# face-browser: node=v20.20.2 floor=ok major=20 image=win25-vs2026@20260907.229.1
# face-browser: RAN leg=win32/v20.20.2 image=win25-vs2026@20260907.229.1
# smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane
# face-browser: 33/33 rooms · 0 console errors · 0 exceptions · chrome=C:\Program Files\Google\Chrome\Application\chrome.exe
ok 1 face-browser: the node floor is reported, and only Node 18 may skip
ok 2 face-browser: the lockfile carries this platform's native packages (offline)
ok 3 face-browser: a planted console error and exception are seen over REAL Chrome
ok 4 face-browser: npm ci and vite build succeed in a copy of face/
ok 5 face-browser: door + preview + smoke open every openable room with 0 errors
ok 6 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 7 face-browser: this file runs no inline program text
ok 8 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## selftest (macos-latest, 20, shard 1/3)

```
# face-browser: node=v20.20.2 floor=ok major=20 image=macos26@20260907.0351.1
# face-browser: RAN leg=darwin/v20.20.2 image=macos26@20260907.0351.1
# smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane
# face-browser: 33/33 rooms · 0 console errors · 0 exceptions · chrome=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
ok 1 face-browser: the node floor is reported, and only Node 18 may skip
ok 2 face-browser: the lockfile carries this platform's native packages (offline)
ok 3 face-browser: a planted console error and exception are seen over REAL Chrome
ok 4 face-browser: npm ci and vite build succeed in a copy of face/
ok 5 face-browser: door + preview + smoke open every openable room with 0 errors
ok 6 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 7 face-browser: this file runs no inline program text
ok 8 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```

## selftest (ubuntu-latest, 22)

```
# face-browser: node=v22.23.2 floor=ok major=22 image=ubuntu24@20260907.300.1
# face-browser: RAN leg=linux/v22.23.2 image=ubuntu24@20260907.300.1
# smoke: opened=33 openable=33 errors=0 excluded-errors=0 unsettled=0 expected=33 not-opened=lane
# face-browser: 33/33 rooms · 0 console errors · 0 exceptions · chrome=/usr/bin/google-chrome
ok 1275 face-browser: the node floor is reported, and only Node 18 may skip
ok 1276 face-browser: the lockfile carries this platform's native packages (offline)
ok 1277 face-browser: a planted console error and exception are seen over REAL Chrome
ok 1278 face-browser: npm ci and vite build succeed in a copy of face/
ok 1279 face-browser: door + preview + smoke open every openable room with 0 errors
ok 1280 face-browser: MUTANT CONTROL -- the summary verdict FAILS a stub smoke that never navigated
ok 1281 face-browser: this file runs no inline program text
ok 1282 face-browser: every test in this file registered (bats drops non-ASCII names silently)
```
