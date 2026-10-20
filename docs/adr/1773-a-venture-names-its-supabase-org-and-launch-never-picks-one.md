# ADR 1773 — A venture names its Supabase org; launch never picks one

**Status:** accepted
**Date:** 2026-10-20
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** Supabase issues organization-scoped access tokens, so one token sees one org by construction; or a
venture needs its project in an org the owner's token cannot see.

## Context

The `database` slot's `supabase` adapter (ADR-1704, ADR-1731) creates the venture's project in "the token's only
organization", and refuses `ORG_AMBIGUOUS` when it sees more than one. A Supabase personal access token is account-wide:
it sees every org the account belongs to. On `myfitfolio` (launch Cycle 2, the first real venture) the first org's
free-project limit was already used by `arc-sandbox`, so the owner made a second org, `myfitfolio`. The live
`apply database --venture myfitfolio` then answered `refused:ORG_AMBIGUOUS the token sees 2 organizations (AutoMemory,
myfitfolio); one is required` (receipt `01M5CRFPBM11PVBY7BK7S8N8XF`). With the refusal as written, an owner with two
orgs cannot use launch at all.

This is assumption A-11 firing (PLAN ledger). Its planned fallback was to move `myfitfolio`'s `database` to the vetted
`neon` row. The owner kept Supabase and the second org on purpose.

## Options considered

1. **Move to `neon`** (A-11's planned fallback). It works, but the owner already chose the second org, and `auth`,
   `backup`, `authz` and the money chain are built on Supabase for this cycle.
2. **A declared env key `SUPABASE_ORG_ID` on the `supabase` row.** Env keys are box-wide: one value would point every
   venture on the box at the same org, while `arc-sandbox` and `myfitfolio` live in different orgs.
3. **A `venture.yaml` field `supabase_org`.** It is per venture, the org id is not a secret, and `ci_protection`
   (ADR-1735) already sets the pattern of a venture field that the adapter reads and validates itself.

## Decision

Option 3.

- `supabase_org` in `venture.yaml` names the org by id or by name. It must match exactly one org the token sees.
  No match, or more than one, is `ORG_UNKNOWN`, naming the value and the orgs the token sees. Nothing is created.
- Nothing named and one org: unchanged. Nothing named and several orgs: still `ORG_AMBIGUOUS`, and the message now says
  how to name one (`supabase_org: <id>` in the venture.yaml) and lists each org's id and name.
- A named org also scopes the project lookup. Only projects in that org count as the venture's, so a same-named
  project in another org is never adopted, never counted as ambiguous, and never verified.
- Launch never picks between orgs. A value that is not a non-empty string, an explicit `null` included, is `BAD_ORG`.
  A name matches exactly, case and all; an id is the sure form, and an id match wins over another org's equal name.
  A token that sees no org is `ORG_NONE`; an org listed without a usable id is `ORG_BAD_ANSWER`.
- Unnamed, the project lookup stays account-wide as it was before this ADR. Two projects of one name anywhere are
  still `PROJECT_AMBIGUOUS`, and the create still needs exactly one org.
- The refusals list every org's name and whole id, up to 20, then `+N more`.
- If a same-named project comes back without its `organization_id`, it is refused as `PROJECT_UNSCOPED`. It is never
  dropped, because dropping it would make the next create a duplicate. The org is resolved once per scaffold or
  verify, and both the lookup and the create use that one id.
- The eight other adapters that touch Supabase take the project ref from the `database` slot's upstream resources, so
  they carry no org assumption and do not change.
- The adapter's bytes change, so the `supabase` row is `candidate` until the owner re-vets it (ADR-1719).

**Evidence:** live refusal receipt `01M5CRFPBM11PVBY7BK7S8N8XF`; Supabase Management API `GET /v1/organizations`
(`id`, `name`) and `GET /v1/projects` (`organization_id`); contract scenarios `two-orgs`, `two-orgs-named`,
`two-orgs-named-by-name`, `org-unknown`, `named-scopes-lookup`.
**Confidence:** high on the fixtures. The first live run is `myfitfolio`'s after the re-vet.
