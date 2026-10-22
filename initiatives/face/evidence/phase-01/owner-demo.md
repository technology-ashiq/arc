# Phase 01 — the owner's live read

**Owner, 2026-10-22, this session's chat:** "live runs done machi, phase-done 01-03 pannu".

The face door's journal on his main clone (`.claude/state/face/journal-2026-10-22.jsonl`, not committed —
local state) shows the four rooms' reads that morning, after `main` held #452 (`75a8fa51`):

| Room | Read | Time (IST) |
|---|---|---|
| ventures | `GET /api/ventures` 200 | 11:53:18 |
| money | `GET /api/pnl` 200 | 11:53:18–11:53:57 |
| org | `GET /api/org` 200 | 11:54:10 |
| story | `GET /api/file/history` 200 | 11:54:35 |

What the journal cannot show: what he saw on the Records tab. That is his statement above, not a measurement.
The Records render itself is proven on CI (`face-browser`, first-verb < 768 px, `RecordsTable` 8-row cap and
"show all N") and in `heights.md`.
