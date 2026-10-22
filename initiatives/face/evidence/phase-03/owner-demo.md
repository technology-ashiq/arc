# Phase 03 — the owner's hunt from the face

**Owner, 2026-10-22, this session's chat:** "live runs done machi, phase-done 01-03 pannu".

On his main clone, after `main` held #454 (`b97dcc00`), the discover room's **Hunt** op ran through the work
door. The door journal (`.claude/state/face/journal-2026-10-22.jsonl`, local state) records five
`POST /api/op/discover.hunt/plan` and one apply:

```
{"ts":"2026-10-22T11:58:14+05:30","work":true,"op":"discover.hunt","phase":"apply","planId":"MEmO6MMEnUzA0o8ToQxzWI4K","ok":true,"receipt":"01M5H4QFYCNYBAXVB5Y9G71XNH"}
```

The receipt is on the canonical spine (`events/2026-10-22.jsonl`, not quarantine):

```
01M5H4QFYCNYBAXVB5Y9G71XNH run.completed discover@0.1.0
{"captured":20,"clusters":7,"niche":"expense tracker","outcome":"ok","records":20,"step":"hunt"}
```

Tiers: `/api/roster`'s `tier` + `tier_source` are served and asserted on CI (`served.md`).
