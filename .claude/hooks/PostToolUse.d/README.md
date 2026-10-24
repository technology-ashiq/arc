# PostToolUse.d -- no fragments (ci REQ-11, ADR-2212)

`00-format.sh` and `90-emit.sh` were retired. The event stays wired: every installed `settings.json`
still registers `PostToolUse.sh`, and the dispatcher runs whatever `NN-*.sh` lands here next.
