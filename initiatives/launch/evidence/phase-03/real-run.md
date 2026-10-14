# Phase 03 real-run evidence -- arc-sandbox (rehearsal)

Generated from the main clone's launch board and spine on 2026-10-13. Resource ids, project refs,
zone ids, deployment ids, order/payment ids and URLs are redacted (the arc repo is public); hostnames, states and
receipt ids are kept. Every receipt is a `run.completed` on the spine with `honesty_class: rehearsal`.

| slot | state | provider | attempt | receipt | answered by / reason | run.completed receipts on spine |
|---|---|---|---|---|---|---|
| legal-pages | absent | arc-legal | 1 | 01M4VNYWZXQVDM246GKA79J4WJ | sandbox.automemory.ai | 1 |
| security-headers | verified | next-headers | 5 | 01M4VGA6CA3GPN2Z0H9BSWN8KD | sandbox.automemory.ai + observatory-api.mdn.mozilla.net | 7 |
| dependency-scan | verified | arc-scan-dependabot | 1 | 01M4RZ4HRZ480YW9Y3AF1V52D1 | api.github.com | 5 |
| errors | verified | sentry | 3 | 01M4SY5CF9PBA99X197F8XAP4Y | sentry.io | 5 |
| backup | verified | pg-dump | 9 | 01M4VQ1FXPYFP705TWDC18XA1X | api.github.com | 11 |
| restore-drill | verified | pg-restore-scratch | 2 | 01M4VQ4XEPJ8J643KAVMX1DR7K | api.github.com | 4 |
| migration-rollback | verified | drizzle-down | 1 | 01M4VS619EB8B1A1Q6JPM7NAFG | api.github.com | 3 |
