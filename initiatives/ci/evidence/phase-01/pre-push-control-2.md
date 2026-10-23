# REQ-05 control 2 -- same plant, local origin/main set 20 commits behind (c00f22d7)

test-changed fetched first, so origin/main was b3eb7ac3 again before the merge-base; the plant was still mapped and run.

```
lanes: ci core face launch zzplant
not ok 7 - planted failure (REQ-05 negative control)
test-changed: FAILED tests/core/test-changed.test.mjs tests/zzplant/plant.test.mjs
error: failed to push some refs to 'https://github.com/technology-ashiq/arc'
push exit=1
```
