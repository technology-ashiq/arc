# Handoff → face: flip the `money/discover` room from planned to live (ADR-1914 amendment)

The discover lane is born (PR #343). `face/src/modules/money/discover/` is still a planned-room module that draws its line from `initiatives/face/contracts/planned-rooms.json`. discover never edits face code, so this is a paste for the face session:

```
/arc-change --lane face convert the money/discover planned room to a live room now that the discover lane is born

The discover lane is born (ADR-1900, PR #343). face/src/modules/money/discover is a planned-room module that reads its
line from planned-rooms.json, and tests/face/module-frame.mjs F3 pins that. Convert it to a live room reading discover's
receipts through the door: idea.captured, run.completed (process discover@x.y.z, payload.step hunt|judge),
approval.requested with gate discover-winner (payload slug, cluster_fp, cluster_tokens, score), and the decision that
decides it. Then, in the same PR: remove the discover row from planned-rooms.json and from expected-set.json
plannedRooms.map, move products.discover / lanes.discover / adrs.1900 / commands.arc-hunt from "lane" to the money room
if the room should index them, re-run face-sections.mjs, and update F3. tests/discover-birth.bats asserts the planned
row is still there; flip its two room tests in the same PR (they are discover's, but the flip is yours to time).
```

Until then the face shows discover twice, correctly: as a live lane in the generic lane room, and as the dotted money room.
