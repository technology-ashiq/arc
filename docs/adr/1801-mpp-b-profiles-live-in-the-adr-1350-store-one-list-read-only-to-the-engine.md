# ADR 1801 — MPP-B: profiles live in the ADR-1350 store, one list, read-only to the engine; a missing profile refuses

**Status:** accepted
**Date:** 2026-10-05
**Product:** `model-policy` (with `face`, which owns the store and its Settings page, and `engine`, which owns `arc-run`)
**Reversibility:** one-way
**Revisit trigger:** a profile the router needs must exist on a machine with no face (a CI runner doing real paid runs, a
remote scheduler). The store's location would then be a deployment question rather than a desk one.

## Context

A profile holds a key, and the arc repo is public. ADR-1350 already keeps the owner's chat models (name, base URL, model
id, optional key) in `~/.arc-private/face/models.json`, outside every repo. The face's Settings page writes it, and no
route ever returns a key. A second store for router profiles would mean typing every key twice and two lists drifting
apart. The owner chose one list (2026-10-05: "ore list than").

## Options considered
1. **One list: the ADR-1350 store.** A router `profile:<name>` names a record in it, and the face's chat keeps its own
   `active` pointer. Pros: one key entry and one place to manage. Cons: editing a record moves chat and every class that
   names it.
2. **A separate `profiles` section or file.** Pros: chat and router are isolated. Cons: duplicate keys, duplicate UI, and
   the owner asked for one.
3. **A public manifest of profile names and hosts in `router.yaml`.** Rejected: model ids and hosts are the owner's private
   choices, and a manifest makes CI depend on it.

## Decision

**Option 1.**

- `arc-run` reads the store read-only through `.claude/scripts/hq/lib/face/models.mjs` (`loadRegistry`, `findModel`,
  `endpointOf`), and it never writes it. The path resolves exactly as the face resolves it: `ARC_FACE_MODELS_FILE` if set,
  else `~/.arc-private/face/models.json`. CI and tests point `ARC_FACE_MODELS_FILE` at a fixture store; no real store
  exists on a runner.
- **A router reference names a record by `^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$`.** That is the store's own name grammar
  without spaces, because a YAML scalar with a space is a quoting accident waiting to happen. Matching is
  case-insensitive, as `findModel` already does it. A record whose name has a space cannot be routed to; rename it.
- **The profile reaches the driver through the child's environment only:** `ARC_LLM_ENDPOINT` = `endpointOf(baseUrl)`,
  `ARC_LLM_API_KEY` = the key (or `none` for a keyless local model, as face-ask already does), and `ARC_DRIVER_MODEL` = the
  record's model id. Never argv, never a receipt, never stderr.
- **A missing profile refuses.** If the store is absent, unreadable or has no such record, the run exits 2 before any
  driver starts. The message names the profile, the store path and the router line. It never falls back to the ambient
  `ARC_LLM_*` environment, and never to another profile. A silent fallback would be exactly the hidden switch ADR-1800
  forbids.

## Consequences

- Editing a record in Settings changes chat (if it is the active one) and every class routed to that name. The "used by"
  view that makes this visible is face work (ADR-1803).
- The engine now imports one face library. It is a pure module with no install and no UI, and the dependency is read-only.
- The face lane's Phase 12 (ADR-1351) makes `generic-api` read `ARC_LLM_API_KEY` through a keys store when the
  environment lacks it. Because `arc-run` sets the variable in the child's environment, the environment wins and the two
  compose without either file knowing about the other.
