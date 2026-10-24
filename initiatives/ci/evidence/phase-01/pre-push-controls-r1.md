# REQ-05 controls, re-run after attack p01 round 1 (commit cb29e4e6 + the non-HEAD fix)

## 1. planted `assert.equal(1, 2)` in tests/zzplant/, HEAD pushed
```
lanes: ci core face launch zzplant
not ok 11 - planted failure (REQ-05 negative control)
test-changed: FAILED tests/core/test-changed.test.mjs tests/zzplant/plant.test.mjs
error: failed to push some refs to 'https://github.com/technology-ashiq/arc'
push exit=1
```

## 3. the planted branch pushed while another branch is checked out (attack B1)
```
lanes: (refused)
test-changed: pushing fc94eb2c, which is not the checked-out HEAD -- check it out and push again (or push it by name from its own worktree)
error: failed to push some refs to 'https://github.com/technology-ashiq/arc'
push exit=1
```

## 4. a push bound for main (the hook fed git's line for refs/heads/main directly: a real non-fast-forward push to main never reaches the hook, git drops that ref first)

```
branch-guard: refuses a push to main (refs/heads/x) -- open a PR instead
RAN branch-guard
hook exit=1
```

## A-04 strike 1 -- the p01 branch's own push (2026-10-24)

`git push -u origin feat/ci-p01-local-first`: 307 s, then `5-minute cap hit; not run: tests/face-browser.bats ...
tests/launch-trust.bats` and the push was refused (exit 1). Not a typical one-lane push: p01 is stacked on the
unmerged p00, so its diff against origin/main carries p00's face lockfile and launch fixture (4 lanes). Counted as
strike 1 of A-04's "3 consecutive pushes > 5 min". After p00 merges the same push maps to ci + core only.
