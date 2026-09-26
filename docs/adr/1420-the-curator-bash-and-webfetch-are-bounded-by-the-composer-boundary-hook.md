# ADR 1420 — The curator's Bash and WebFetch are bounded by the composer boundary's hook

**Status:** accepted
**Date:** 2026-09-26
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** the curator needs a second command (a resize, a second fetch tool), or a
gallery's listing pages move to a host that is not on its registry row. Either one widens the
allowlist, and that is a new decision, not an edit.

## Context

Phase 02 needs a `design-curator` agent at balanced-workhorse
([ADR-1414](1414-the-curator-sits-at-balanced-workhorse-and-one-juror-at-high-judgment.md)) that
browses the registry's `active` galleries, picks 5–8 screens, and adds each one through
`design-refpack.mjs`, which runs the robots.txt preflight, the host binding and the provenance
write ([ADR-1412](1412-gallery-eligibility-is-decided-by-robots-and-terms-not-by-taste.md)).

Two facts shape how its tools are granted:

- `agent-scaffold.mjs` accepts tool **names** only. A scoped `Bash(node …:*)` is refused, and it
  would scope nothing anyway: a subagent's `tools:` field takes names, which is how `ui-composer`
  ran node, sed and PowerShell through a render-only grant on the lexos-p02 demo.
- The curator must browse a gallery to choose screens. A plain `WebFetch` of a listing page never
  passes the robots preflight, so "a preflight per fetch" would hold only for the final image.

The `PreToolUse.sh` dispatcher already receives both `Bash` and `WebFetch` (`settings.json`
matchers), and its `10-design-composer.sh` fragment already hands every payload to
`composer-bash-check.sh`, which reads the harness-written `agent_type`.

## Options considered

1. **Scope in the existing hook.** Tools `Read, Grep, Glob, WebFetch, Bash`. `composer-bash-check.sh`
   learns a second identity: for `design-curator`, Bash runs only
   `node .claude/scripts/design/design-refpack.mjs …`, and a `WebFetch` runs only when its URL is
   on the `hosts` of an `active` registry row AND `design-robots.mjs` answers ALLOW for it.
   Pros: the spec's "preflight per fetch" holds for browsing too; no new hook file, no settings
   change. Cons: one more identity in a file that has taken nine attack passes.
2. **The curator does not fetch.** Tools `Read, Grep, Glob`; the main session browses and runs
   the builder. Pros: least new code. Cons: the judgement ADR-1414 seats at balanced-workhorse
   moves back into the operator session.
3. **Plain Bash and WebFetch.** Pros: fastest. Cons: the Phase 01 hole, again, on purpose.

## Decision

**Option 1**, chosen by the owner on 2026-09-26 ("Hook-la scope"). For a caller whose
`agent_type` is `design-curator` (case-blind, optional namespace, read by the same identity
parser as the composer's):

- **Bash:** exactly `node .claude/scripts/design/design-refpack.mjs` followed by its own flags
  (`--brief --source --url --principle --avoid`, each once). A principle is a sentence, so a
  value may be double-quoted, and inside the quotes only letters, digits, space and
  `. , : ; - ( ) ' / ? !` appear: no `$`, backtick, backslash or inner quote, which leaves
  nothing for bash to expand. Outside quotes the renderer's closed alphabet holds. No second
  command, no redirection, no substitution.
- **WebFetch:** the URL is `https`, its host is a registry row's host (or a subdomain) where the
  row is `status: active` and `access: fetch`, and `design-robots.mjs --url` exits 0. DISALLOW
  and UNREADABLE both refuse, and the refusal names which.
- Every other tool the curator holds is ungoverned by this ADR; `Read`, `Grep` and `Glob` are
  read-only and the curator has no `Write` or `Edit`.

## Consequences

- The robots preflight covers browsing, not only the image the builder fetches.
- `composer-bash-check.sh` now answers for two agents. Its name stays; its header says so.
- The hook fragment's fail-closed fallback (`_is_composer`, used only when the script is missing
  or broken) still names only `ui-composer`. Widening it is the owner's edit under
  `.claude/hooks/**`; until then a missing script leaves the curator's Bash and WebFetch open.
  Ledgered as debt, not hidden.
- A WebFetch hook now makes a network call (the robots.txt fetch) for the curator only. The
  transport's 15 s per request can chain across redirects past the 60 s hook budget, and a hook
  that times out is read as allow, so the hook caps the whole preflight at 40 s and a cap that
  fires refuses.
