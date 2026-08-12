# Trial-gate ledger — fixture

| date | gate | run-ref | fired? | false-positive? |
|---|---|---|---|---|
| 2026-01-01 | fixture-gate | abc1234 (fixture run) | no | — |
| 2026-01-02 | fixture-gate | def5678 (fixture run) | **YES** — fired once | no |

| group | why it is in trial | what would promote it |
|---|---|---|
| `fixture-gate` | it has one exercised run, not three | two more clean runs |
