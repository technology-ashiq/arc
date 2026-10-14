# Vet-ready providers -- arc-sandbox real runs (ADR-1705)

Two of the four `vetted` artifacts are here: the adapter digest and a real verify that passed (its receipt). The
other two are the owner's: a `/arc-capability` scout record and a `decision.recorded` id carried as `vetted_by`.

| slot | provider | status | real verify receipt | adapter digest |
|---|---|---|---|---|
| dns | cloudflare-dns | candidate | 01M4S0RCD98DSDZBVW70DZ5FA7 | `b79227399a27103e...` |
| repo | github | candidate | 01M49BF225MGES7WMSCA6W31AS | `fcb39cefb82d7d17...` |
| ci | github-actions | candidate | 01M49MS5CAWTR8C59JH7M8TK38 | `2cd022da976444d7...` |
| hosting | vercel | candidate | 01M4RY99VG6NE83J5DSV6PSFN8 | `ef4ee02fbd2228ba...` |
| environments | vercel-environments | candidate | 01M4VG62CA28WQGFZ8K1PEX92T | `ca1ac676326512c1...` |
| tls | vercel-managed-tls | candidate | 01M4SY132MW8J2XDKBQT80GTTS | `d8db59cc766aedde...` |
| secrets | vercel-env-store | candidate | 01M4RYGWSDW99560ZEHMD56FJC | `92ec7d73b05327a4...` |
| release | arc-ship-release | candidate | 01M4STVD8PFCWBS1NFRPCSTZ1Z | `bde82fd2b7887e8a...` |
| frontend | nextjs-shell | candidate | 01M4VRMGF33AZ9851JTTTT3M8W | `0b7895e739dd23c2...` |
| backend | next-route-handlers | candidate | 01M4VGEA8XM74N19WXTGZ5Q7DF | `956a77f41fcaf262...` |
| database | supabase | candidate | 01M4RYHT0EJ3JEMSGKS7C900EP | `213c746fedcf5ada...` |
| orm | drizzle | candidate | 01M4VGHHQKSFA4Z7YCDYS9RCFT | `4d1e14f76d36a4fa...` |
| email-transactional | resend | candidate | 01M4S0YBSCTPGC0EW3VA9SBN3P | `7ae5de308b80495d...` |
| auth | supabase-auth | candidate | 01M4VNR44T2N5GQ3JRMCMNYKDQ | `dd1e47c658de971c...` |
| authz | rls-roles | candidate | 01M4VNVH1ZDHQ2N06GFD0AFE4D | `dca77275db07a09a...` |
| tenancy | org-invite | candidate | 01M4VNYQW6DJ165B22C2CG1G4N | `572fdbe494bf372e...` |
| plans | plans-yaml | candidate | 01M4VQRKYJN8AWYHWG48YAPBW3 | `1467986929d93ed7...` |
| payment-test | razorpay | candidate | 01M4VQS418XD1FJ0CX7R4QHDRZ | `2d1a4cf8608b5b41...` |
| checkout-portal | razorpay-checkout | candidate | 01M4VQZHEKSEP7SDVJ0V5GT223 | `e9acb5ac4b6f5bec...` |
| webhooks-ledger | razorpay-webhook | candidate | 01M4VR74W3HPCNBWRR8JZ87BGR | `42c633c14e461f99...` |
| refunds | razorpay-refunds | candidate | 01M4VR7FZ030C8DDFGEX5KWWWQ | `8380a4767abdec7b...` |
| security-headers | next-headers | candidate | 01M4VGA6CA3GPN2Z0H9BSWN8KD | `ef172d5b17b53b5c...` |
| dependency-scan | arc-scan-dependabot | candidate | 01M4RZ4HRZ480YW9Y3AF1V52D1 | `ea320a829745c8be...` |
| errors | sentry | candidate | 01M4SY5CF9PBA99X197F8XAP4Y | `dfa807d043ecea75...` |
| backup | pg-dump | candidate | 01M4VQ1FXPYFP705TWDC18XA1X | `c7d203c24801d8d5...` |
| restore-drill | pg-restore-scratch | candidate | 01M4VQ4XEPJ8J643KAVMX1DR7K | `5a8649dde90e451e...` |
| migration-rollback | drizzle-down | candidate | 01M4VS619EB8B1A1Q6JPM7NAFG | `35b96790d2adb140...` |
| passport | venture-register | candidate | 01M4RZ5MZS8Q4DCJV51R83HKSJ | `9e539eed01d28d0e...` |
| ledger-source | ledger-source | candidate | 01M4VR7V1D9XD4HTZKMMEJ52PW | `54fd9d5668d84abd...` |
| face-room | face-planned | candidate | 01M4VTAQTJC473NTQ6R7BRCC6R | `d0bc27f403d2d519...` |
| teardown-plan | teardown-render | candidate | 01M4RZ5PY3R29VCKK95K4DNE79 | `7621eb3fe644842c...` |
