# ADR 1351 — FV2-S: the owner's keys are set once in the face, and arc's tools read them from there

**Status:** accepted 2026-10-05 by the owner ("Yes, build it", choosing the keys store; then "Dynamic add panra maari vai machi ... key : value maari")
**Date:** 2026-10-05
**Product:** face
**Reversibility:** two-way (the store is one file outside the repo; a tool that stops reading it falls back to its environment variable, as today)
**Revisit trigger:** a key value appears in any door response, in the repo tree, in a spine event or in a transcript; or a tool runs on a stored key while its own environment variable was set
**Amends:** ADR-1350 (the Settings page gains a third section, Keys; the models registry keeps its own per-model keys)

## Context

On 2026-10-05, after the Settings page and model edit, the owner asked: "athe maari API keys la add pannalama, ovvoru
timeum session la kodukura mari iruku, ella API's add panra maari pannalama?" -- the same for API keys: it feels like he
hands them over in every session. The record agrees. The attack's logic model needs `OPENROUTER_API_KEY`, kept by `setx`
in his user environment, which a running shell does not see, so each session reads it through PowerShell or asks him.
The launch lane's real adapters wait on his tokens (Vercel, GitHub). Each key lives somewhere different: a user
environment variable, `setx`, or pasted into a chat.

Asked which keys, he asked for them to be dynamic: "Dynamic add panra maari vai machi apo than ethunalum add panra maari
vaika mudiyum ... key : value".

## Options considered

1. **A fixed list of known keys on the page** (OpenRouter, Vercel, GitHub). Rejected: the owner asked for any key.
2. **A `.env` file in the repo, gitignored.** Rejected: the repo is public, and a gitignored file is one `git add -f`
   from published. The face's models file already refuses any path inside the repo for the same reason.
3. **A dynamic `NAME : value` store outside the repo, set from the face, read by arc's tools when their own
   environment variable is unset** -- chosen.

## Decision

1. **Dynamic pairs.** The Settings page gains a **Keys** section listing every stored key by name. The owner adds a
   key (a name and a value), replaces a value, and removes a key. A name is environment-variable shaped, so a tool can
   look it up by the name it already uses: `^[A-Z][A-Z0-9_]{1,63}$` (`OPENROUTER_API_KEY`, `VERCEL_TOKEN`). A value is
   8 to 4000 printable characters with no spaces. At most 50 keys.
2. **Stored once, outside the repo.** `~/.arc-private/keys/keys.json` (or `ARC_KEYS_FILE`, which may not point inside
   the repo, the same guard as the models file). Written atomically, owner-only permissions where the OS has them.
3. **Never returned.** `GET /api/keys` lists names, whether each is set, and the last four characters of a value of 20
   or more characters, never the value. `POST /api/keys/set` takes one change -- `add`, `replace`, `remove` -- and
   answers with the same view. The face never holds a stored value; it sends a new one once and clears the field.
4. **Arc's tools read it, the environment wins.** One resolver, `resolveKey(name)` in
   `.claude/scripts/hq/lib/keys.mjs`: the process environment first, then the store. A set environment variable is
   never overridden, so every current setup keeps working. In this phase the first reader is the `generic-api` driver
   (the attack's logic model and `narrative-verify`): with `ARC_LLM_API_KEY` unset it reads it from the store, and
   with `ARC_LLM_KEY_NAME` set it reads that name instead (for example `OPENROUTER_API_KEY`). Other lanes' tools
   (launch's adapters) adopt the resolver as their own change.
5. **No new spine kind.** Setting a key writes no receipt (a receipt naming a key is a leak path); the door's
   allow-list carries the two routes, `spineEffect: "none"`.

## Consequences

- The owner sets each key once, in the face; a session reads it without asking him.
- The models registry keeps its per-model keys (ADR-1350): a model's key belongs to that endpoint, a named key to the
  tools. Pointing a model at a named key is a later choice, not this phase.
- The store is a second private file to back up; the face says where it lives.
