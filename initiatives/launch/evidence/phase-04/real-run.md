# Phase 04 real-run evidence -- arc-sandbox (rehearsal)

Generated from the main clone's launch board and spine on 2026-10-13. Resource ids, project refs,
zone ids, deployment ids, order/payment ids and URLs are redacted (the arc repo is public); hostnames, states and
receipt ids are kept. Every receipt is a `run.completed` on the spine with `honesty_class: rehearsal`.

| slot | state | provider | attempt | receipt | answered by / reason | run.completed receipts on spine |
|---|---|---|---|---|---|---|
| passport | verified | venture-register | 1 | 01M4RZ5MZS8Q4DCJV51R83HKSJ | arc venture-register --dry-run | 3 |
| ledger-source | verified | ledger-source | 2 | 01M4VR7V1D9XD4HTZKMMEJ52PW | arc spine | 4 |
| face-room | verified | face-planned | 2 | 01M4VTAQTJC473NTQ6R7BRCC6R | arc face contract | 2 |
| teardown-plan | verified | teardown-render | 1 | 01M4RZ5PY3R29VCKK95K4DNE79 | arc teardown render | 3 |
