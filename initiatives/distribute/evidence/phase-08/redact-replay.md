# Debt row 24 — the redactor's refusal of run 5c's first `ship.done`, replayed

**Reproduced, cause found, fixed** (2026-10-14). The row closes `fixed`, not `not-reproduced`.

## Replay

`tests/distribute/redact-replay.mjs` builds arc-event's envelope around each payload in canonical form (sorted keys,
compact) and runs `scanSecrets`, the emitter's own scan. Before the fix:

| Case | Payload `url` | Verdict |
|---|---|---|
| landed (the re-emit that reached the spine) | `wt-oc-req03.vercel.app` | clean |
| bare-https | `https://wt-oc-req03.vercel.app` | **hit connection-string-password** |
| team-https | `https://wt-oc-req03-technology-ashiqs-projects.vercel.app` | **hit connection-string-password** |
| pr-url | `https://github.com/technology-ashiq/arc/pull/416` | clean |
| control (a real DSN, assembled at runtime so no credential shape sits in the repo) | a postgres DSN for user `arc` with a 10-character password at `db.internal` | hit |

## Cause

The rule is `scheme://[^\s:/@]{1,64}:[^\s:/@]{6,64}@`. In the canonical text, `payload` sorts just before `process`,
and `process` is `arc-event@1.0.0`. A payload whose last value is a bare-host URL therefore reads:

```
https://wt-oc-req03.vercel.app"},"process":"arc-event@1.0.0"
        └──── "user" ─────────────────┘ └─"pass"──┘
```

The user class allowed `"`, `}` and `,`, so `wt-oc-req03.vercel.app"},"process"` matched as a user, `:` as the
separator, `"arc-event` as a password of 6+ characters, and `@` closed it. A URL with a path (`/pull/416`) stops at the
`/` and is clean. That is why the PR URL never tripped it and the re-emit without `https://` landed. **Every consumer
`ship.done` naming a deploy URL would have been quarantined.**

## Fix

`.claude/scripts/hq/lib/redact.mjs:85`: `"` is excluded from both the user and the password classes. A credential
inside a JSON string never contains a raw quote, since canonical JSON escapes it. After the fix, all four URL cases are
clean, the intact DSN still hits, and a DSN split at its colon across two payload fields (`postgres://arc_app` +
`:s3cr3tpassword@db…`) still hits through the scanner's adjacency joins. Both controls are pinned in
`tests/distribute-redact-replay.bats`, and the existing hostile fixture `tests/fixtures/spine/hostile/46-secret-dsn.json`
is unchanged.

This edits a shared core rule. Its tracked home is Phase 08 scope item 8 and ADR-2027 (debt row 24), and the change
tightens nothing a credential needs.
