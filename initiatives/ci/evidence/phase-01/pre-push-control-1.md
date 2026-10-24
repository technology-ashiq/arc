# REQ-05 control 1 -- planted assert.equal(1, 2) in tests/zzplant/, git push --dry-run

```
lanes: ci core face launch zzplant
not ok 7 - planted failure (REQ-05 negative control)
test-changed: FAILED tests/core/test-changed.test.mjs tests/zzplant/plant.test.mjs
error: failed to push some refs to 'https://github.com/technology-ashiq/arc'
push exit=1
```
