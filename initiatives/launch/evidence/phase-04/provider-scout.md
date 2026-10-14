# Provider scout record -- the providers that ran live on arc-sandbox

Lane `launch`, Cycle 1, Phase 04 (REQ-05, REQ-09; ADR-1705). One consolidated `/arc-capability`-style scout record for
SaaS providers: the candidate is the provider's own API, its existence and provenance are the vendor's, and the
evidence that matters is that launch's adapter for it ran against the real provider and a fresh verify answered.

Each row: the registry id, its slot, the adapter, the digest the row pins when vetted (sha256 after CRLF->LF,
ADR-1719), the slot's `run.completed` receipt on the spine, the outside answerer of the latest `verify --all`
(2026-10-14, main clone, exit 0), and that verify's date. A row is vetted only after the owner's decision.recorded
on the one approval.requested that cites this file; its digest must still match the adapter at that moment.

Providers that ran live: **33** of 37 rows. Not here, and not vetted by this record:
- `cloudflare-registrar` (domain, candidate) -- the slot is a named ABSENT
- `dodo` (payment-test, candidate) -- no live run through this row
- `stripe` (payment-test, blocked) -- no live run through this row
- `arc-legal` (legal-pages, candidate) -- the slot is a named ABSENT

| provider | slot | adapter | digest | receipt | answerer | verified |
|---|---|---|---|---|---|---|
| cloudflare-dns | dns | `providers/dns/cloudflare-dns.mjs` | `b79227399a27103e2cc88a0e03dbe52cdb51ddda4574b432b9068c993467c4c7` | 01M4S0RCD98DSDZBVW70DZ5FA7 | dns.google + cloudflare-dns.com | 2026-10-14 |
| github | repo | `providers/repo/github.mjs` | `fcb39cefb82d7d1740abc66ee489b78cf510c0b484fbcf8eb1d03f74381ef6ca` | 01M49BF225MGES7WMSCA6W31AS | api.github.com | 2026-10-14 |
| github-actions | ci | `providers/ci/github-actions.mjs` | `2cd022da976444d77f185f7d56292343bc8c703c9878cf9e28bbc17974ee1e02` | 01M49MS5CAWTR8C59JH7M8TK38 | api.github.com | 2026-10-14 |
| vercel | hosting | `providers/hosting/vercel.mjs` | `ef4ee02fbd2228badba70276742e4b513d3d5695c49619742602e2c77ac555a2` | 01M4RY99VG6NE83J5DSV6PSFN8 | api.vercel.com | 2026-10-14 |
| vercel-environments | environments | `providers/environments/vercel-environments.mjs` | `7276cbe56ced6a866bbf693f32ebee644dce21d5c48c587330bef2610b121cb7` | 01M4VG62CA28WQGFZ8K1PEX92T | api.vercel.com | 2026-10-14 |
| vercel-managed-tls | tls | `providers/tls/vercel-managed-tls.mjs` | `72e37a02a18c1929aa79b58bb582c99ace36db89420355eb6c243d076739b346` | 01M4SY132MW8J2XDKBQT80GTTS | api.ssllabs.com + sandbox.automemory.ai | 2026-10-14 |
| vercel-env-store | secrets | `providers/secrets/vercel-env-store.mjs` | `92ec7d73b05327a444390c0acdd5a37141160c4e53aa5df8b37981efaebbc8fa` | 01M4RYGWSDW99560ZEHMD56FJC | api.vercel.com + api.github.com | 2026-10-14 |
| arc-ship-release | release | `providers/release/arc-ship-release.mjs` | `bde82fd2b7887e8a8ac6c62401bce07b6270a7cdfe1eb4856713a98361685fe4` | 01M4STVD8PFCWBS1NFRPCSTZ1Z | api.vercel.com | 2026-10-14 |
| nextjs-shell | frontend | `providers/frontend/nextjs-shell.mjs` | `c6340bd5db436b4746d49425cf4594f817176aeb23594f70495cf7d48cfd0da7` | 01M4VRMGF33AZ9851JTTTT3M8W | sandbox.automemory.ai + www.googleapis.com | 2026-10-14 |
| next-route-handlers | backend | `providers/backend/next-route-handlers.mjs` | `956a77f41fcaf262b5464d38f31baadfc69740415ae97d8582632a54c0f64404` | 01M4VGEA8XM74N19WXTGZ5Q7DF | sandbox.automemory.ai | 2026-10-14 |
| supabase | database | `providers/database/supabase.mjs` | `213c746fedcf5ada453f201e18c55a5a283e8c9d48da00acc2216262d808baa0` | 01M4RYHT0EJ3JEMSGKS7C900EP | api.supabase.com + <ref>.supabase.co | 2026-10-14 |
| neon | database | `providers/database/neon.mjs` | `414c62424fe252ac5aee7c3a4077eb593088e1037760e377d34b4311c20e02b0` | 01M4Y295RKMHSHBS52T7DE9Q08 | console.neon.tech + the project pooler (RLS: owner 1 row, launch_anon 0; vet run on a private state copy, the sandbox stays on supabase; digest is the adapter with its role-grant fix, which lands in the REQ-08 PR on its own) | 2026-10-15 |
| drizzle | orm | `providers/orm/drizzle.mjs` | `4d1e14f76d36a4fa6d6cfaf132a6440f9783f00dc11b65367474e85dca7c71a3` | 01M4VGHHQKSFA4Z7YCDYS9RCFT | api.github.com | 2026-10-14 |
| resend | email-transactional | `providers/email-transactional/resend.mjs` | `7ae5de308b80495d616964cb7f3c0d30acbba7865e62095fc2b92d6a1d4eb4bf` | 01M4S0YBSCTPGC0EW3VA9SBN3P | api.resend.com + dns.google + cloudflare-dns.com | 2026-10-14 |
| supabase-auth | auth | `providers/auth/supabase-auth.mjs` | `846ff2ff244e027f3b2e4fd87afc746b17358d22d5b655d0b03c29ccd4cec68e` | 01M4VNR44T2N5GQ3JRMCMNYKDQ | sandbox.automemory.ai + <ref>.supabase.co | 2026-10-14 |
| rls-roles | authz | `providers/authz/rls-roles.mjs` | `dca77275db07a09aa18d6bb97056fda328ab26cd2b320e2f58c3ead47cdd8e31` | 01M4VNVH1ZDHQ2N06GFD0AFE4D | sandbox.automemory.ai + <ref>.supabase.co | 2026-10-14 |
| org-invite | tenancy | `providers/tenancy/org-invite.mjs` | `572fdbe494bf372e01e5a2487bae14ad0950c3f502e111f10fbb6899c0b05544` | 01M4VNYQW6DJ165B22C2CG1G4N | sandbox.automemory.ai + <ref>.supabase.co | 2026-10-14 |
| plans-yaml | plans | `providers/plans/plans-yaml.mjs` | `1467986929d93ed79de26a84de8f975f99319dd5f9e53b67ba05d313c034a443` | 01M4VQRKYJN8AWYHWG48YAPBW3 | sandbox.automemory.ai + <ref>.supabase.co | 2026-10-14 |
| razorpay | payment-test | `providers/payment-test/razorpay.mjs` | `2d1a4cf8608b5b41005ac880ef4807cbbf30593df16ecf3262ab8e9c3ca3761c` | 01M4VQS418XD1FJ0CX7R4QHDRZ | api.razorpay.com | 2026-10-14 |
| razorpay-checkout | checkout-portal | `providers/checkout-portal/razorpay-checkout.mjs` | `e9acb5ac4b6f5becc99474c5bde34218f1461cee76be4f2d35b4a819e876b57c` | 01M4VQZHEKSEP7SDVJ0V5GT223 | sandbox.automemory.ai + api.razorpay.com | 2026-10-14 |
| razorpay-webhook | webhooks-ledger | `providers/webhooks-ledger/razorpay-webhook.mjs` | `42c633c14e461f9925126269de4d6ea3740ce3fe266b3df860fb5ec4e6ad4494` | 01M4VR74W3HPCNBWRR8JZ87BGR | sandbox.automemory.ai + api.supabase.com | 2026-10-14 |
| razorpay-refunds | refunds | `providers/refunds/razorpay-refunds.mjs` | `8380a4767abdec7bab2e2568e0021efa0969eb72ea62f26fececce254fd2998d` | 01M4VR7FZ030C8DDFGEX5KWWWQ | sandbox.automemory.ai + api.supabase.com | 2026-10-14 |
| next-headers | security-headers | `providers/security-headers/next-headers.mjs` | `956f6723ae8044b9bcc39254cbe99204789193f72ddf1aab09996150d738fc40` | 01M4VGA6CA3GPN2Z0H9BSWN8KD | sandbox.automemory.ai + observatory-api.mdn.mozilla.net | 2026-10-14 |
| arc-scan-dependabot | dependency-scan | `providers/dependency-scan/arc-scan-dependabot.mjs` | `ea320a829745c8be30f049c849d912c351129b4c56cdc19952e8d27975dc534e` | 01M4RZ4HRZ480YW9Y3AF1V52D1 | api.github.com | 2026-10-14 |
| sentry | errors | `providers/errors/sentry.mjs` | `dfa807d043ecea7579b378ea1653e8aefcb7457548dcde5addaac3bd46d777b6` | 01M4SY5CF9PBA99X197F8XAP4Y | sentry.io | 2026-10-14 |
| pg-dump | backup | `providers/backup/pg-dump.mjs` | `09b01af242557c12e9babd1b7a753b798f7b9992f66bdbc9e9d04f4fad44d3cf` | 01M4VQ1FXPYFP705TWDC18XA1X | api.github.com | 2026-10-14 |
| pg-restore-scratch | restore-drill | `providers/restore-drill/pg-restore-scratch.mjs` | `b034d4b523de0a83513752d6c0f77a01f56fe5cb629e162798cb03fa321ef95d` | 01M4VQ4XEPJ8J643KAVMX1DR7K | api.github.com | 2026-10-14 |
| drizzle-down | migration-rollback | `providers/migration-rollback/drizzle-down.mjs` | `35b96790d2adb140b503c210e4d70e55a315af0e4472b6388596d06546f7499a` | 01M4VS619EB8B1A1Q6JPM7NAFG | api.github.com | 2026-10-14 |
| venture-register | passport | `providers/passport/venture-register.mjs` | `9e539eed01d28d0e974938de8b3e1580971fbf9c8b23560b705fa1fcbb783172` | 01M4RZ5MZS8Q4DCJV51R83HKSJ | arc venture-register --dry-run | 2026-10-14 |
| ledger-source | ledger-source | `providers/ledger-source/ledger-source.mjs` | `54fd9d5668d84abdfe019cf05cff75df24030e5fd2a3dbf7ff6b659f047f18be` | 01M4VR7V1D9XD4HTZKMMEJ52PW | arc spine | 2026-10-14 |
| face-planned | face-room | `providers/face-room/face-planned.mjs` | `d0bc27f403d2d519c6ae42421e87f9839eb00b1ac445df0d8f415eefa8a7153a` | 01M4VTAQTJC473NTQ6R7BRCC6R | arc face contract | 2026-10-14 |
| arc-checkout | arc-harnesses | `providers/arc-harnesses/arc-checkout.mjs` | `4079cef9e4b42075f0aa9f5d715cf23af5fab8b6d64e261353cedea692db29e1` | 01M4YA96HKTWZNWSMYDQMCVKYS | arc doctor --dir (673 placed, 20 degraded, 0 missing, 0 unmanaged-conflict; claude-code, codex, opencode, skills-only) | 2026-10-15 |
| teardown-render | teardown-plan | `providers/teardown-plan/teardown-render.mjs` | `7621eb3fe644842cfd1c2e86c58d0ff2563e1ef6f85142e1b4d781a8736cc55e` | 01M4RZ5PY3R29VCKK95K4DNE79 | arc teardown render | 2026-10-14 |
