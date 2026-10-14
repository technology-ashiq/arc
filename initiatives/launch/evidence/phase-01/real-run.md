# Phase 01 real-run evidence -- arc-sandbox (rehearsal)

Generated from the main clone's launch board and spine on 2026-10-13. Resource ids, project refs,
zone ids, deployment ids, order/payment ids and URLs are redacted (the arc repo is public); hostnames, states and
receipt ids are kept. Every receipt is a `run.completed` on the spine with `honesty_class: rehearsal`.

| slot | state | provider | attempt | receipt | answered by / reason | run.completed receipts on spine |
|---|---|---|---|---|---|---|
| repo | verified | github | 1 | 01M49BF225MGES7WMSCA6W31AS | api.github.com | 2 |
| ci | verified | github-actions | 2 | 01M49MS5CAWTR8C59JH7M8TK38 | api.github.com | 2 |
| environments | verified | vercel-environments | 2 | 01M4VG62CA28WQGFZ8K1PEX92T | api.vercel.com | 4 |
| hosting | verified | vercel | 1 | 01M4RY99VG6NE83J5DSV6PSFN8 | api.vercel.com | 3 |
| dns | verified | cloudflare-dns | 1 | 01M4S0RCD98DSDZBVW70DZ5FA7 | dns.google + cloudflare-dns.com | 3 |
| tls | verified | vercel-managed-tls | 4 | 01M4SY132MW8J2XDKBQT80GTTS | api.ssllabs.com + sandbox.automemory.ai | 6 |
| secrets | verified | vercel-env-store | 1 | 01M4RYGWSDW99560ZEHMD56FJC | api.vercel.com + api.github.com | 3 |
| release | verified | arc-ship-release | 2 | 01M4STVD8PFCWBS1NFRPCSTZ1Z | api.vercel.com | 5 |
| frontend | verified | nextjs-shell | 6 | 01M4VRMGF33AZ9851JTTTT3M8W | sandbox.automemory.ai + www.googleapis.com | 8 |
| backend | verified | next-route-handlers | 1 | 01M4VGEA8XM74N19WXTGZ5Q7DF | sandbox.automemory.ai | 3 |
| database | verified | supabase | 1 | 01M4RYHT0EJ3JEMSGKS7C900EP | api.supabase.com + <redacted>.supabase.co | 3 |
| orm | verified | drizzle | 1 | 01M4VGHHQKSFA4Z7YCDYS9RCFT | api.github.com | 3 |
| email-transactional | verified | resend | 1 | 01M4S0YBSCTPGC0EW3VA9SBN3P | api.resend.com + dns.google + cloudflare-dns.com | 3 |
| auth | verified | supabase-auth | 6 | 01M4VNR44T2N5GQ3JRMCMNYKDQ | sandbox.automemory.ai + <redacted>.supabase.co | 8 |
| authz | verified | rls-roles | 2 | 01M4VNVH1ZDHQ2N06GFD0AFE4D | sandbox.automemory.ai + <redacted>.supabase.co | 4 |
| tenancy | verified | org-invite | 2 | 01M4VNYQW6DJ165B22C2CG1G4N | sandbox.automemory.ai + <redacted>.supabase.co | 4 |
| domain | absent | - | 0 | - | rehearsal never crosses gate-1 (approval.requested 01M4S0GYX6S3NVGA9CRSN9Z1H9 recorded, refusal path exercised) | 0 |
