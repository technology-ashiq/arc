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
