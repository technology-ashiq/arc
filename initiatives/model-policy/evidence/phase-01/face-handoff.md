# Phase 01 — handoff to the face lane (ADR-1803)

model-policy v2 stays off the Settings page because the face session is building on it (Phase 11 model edit, PR #332;
Phase 12 keys, ADR-1351). Three items belong there. They are handed over as one prompt, to be pasted into the face
lane's session. This lane builds none of them.

```text
/arc-change --lane face Settings -> Models, three additions for router provider profiles (model-policy v2, ADR-1800..1803, merged on main):
1. COST on a model record: an optional per-million-token price (input and output). The store schema is closed today (models.mjs checkRecord refuses an unknown field), so this is a schema change plus a form field. Any receipt or view that uses it labels it cost_source: declared, never measured (ADR-0069 block b: absent data is never estimated).
2. "USED BY" column: for each record, the router classes and tiers that name it. The data is already served: GET /api/model-policy now returns, for every tier pin and class row, `profile: { profile, model, gateway_host, missing, from }` (never the key), plus `unroutable` (store names with a space, which the router grammar cannot reference). Invert it per record.
3. REMOVE GUARD: removing a record that engine/router.yaml names (a tier pin `generic-api: profile:<name>`, or a class `profile: <name>`) is refused, naming the rows. Today arc-run refuses such a run at preflight with exit 2 (ADR-1801), so nothing breaks silently, but the page should say it before the owner removes it.
Boundary: engine/router-row.mjs exports PROFILE_DRIVER, PROFILE_PREFIX, PROFILE_NAME_RE and profileRef for the router grammar. Reuse them; do not copy them.
```

Delivered in the owner's chat at Phase 01 close on 2026-10-05, for pasting into the face session.
