# Phase 02 real-run evidence -- arc-sandbox (rehearsal)

Generated from the main clone's launch board and spine on 2026-10-13. Resource ids, project refs,
zone ids, deployment ids, order/payment ids and URLs are redacted (the arc repo is public); hostnames, states and
receipt ids are kept. Every receipt is a `run.completed` on the spine with `honesty_class: rehearsal`.

| slot | state | provider | attempt | receipt | answered by / reason | run.completed receipts on spine |
|---|---|---|---|---|---|---|
| plans | verified | plans-yaml | 2 | 01M4VQRKYJN8AWYHWG48YAPBW3 | sandbox.automemory.ai + <redacted>.supabase.co | 4 |
| payment-test | verified | razorpay | 2 | 01M4VQS418XD1FJ0CX7R4QHDRZ | api.razorpay.com | 9 |
| checkout-portal | verified | razorpay-checkout | 3 | 01M4VQZHEKSEP7SDVJ0V5GT223 | sandbox.automemory.ai + api.razorpay.com | 5 |
| webhooks-ledger | verified | razorpay-webhook | 3 | 01M4VR74W3HPCNBWRR8JZ87BGR | sandbox.automemory.ai + api.supabase.com | 5 |
| refunds | verified | razorpay-refunds | 1 | 01M4VR7FZ030C8DDFGEX5KWWWQ | sandbox.automemory.ai + api.supabase.com | 3 |
| ledger-source | verified | ledger-source | 2 | 01M4VR7V1D9XD4HTZKMMEJ52PW | arc spine | 4 |
| payment-live | absent | - | 0 | - | rehearsal never crosses gate-3 (approval.requested 01M4VRAKRFHJJKHGPSEM6YZTA9 recorded, refusal path exercised) | 0 |
