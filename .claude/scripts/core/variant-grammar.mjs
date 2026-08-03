// variant-grammar.mjs — the ONE definition of the process/variant identifier grammar.
//
// ADR-0303 extends the spine's process id from `name@x.y.z` to `name@x.y.z(+slug)?` so an
// experiment arm is addressable without a second identifier scheme. That grammar is needed in
// three places: the spine validator (hq), process-lint (engine), and the `evolve` manifest
// section validator (core). It lives HERE, in core, because core is the one product every
// other product already requires — a copy in each would be a regex that drifts, which is the
// exact failure recorded in docs/retro-log.md on 2026-07-22.
//
// Zero dependencies. Nothing in this file reads the filesystem or the environment.

// The un-suffixed base: `name@MAJOR.MINOR.PATCH`. Byte-identical to the grammar the spine has
// always enforced, so every pre-existing `name@x.y.z` value still validates.
export const PROCESS_BASE_RE = /^[a-z0-9][a-z0-9._-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;

// The arm suffix, without its `+`. Lower-case, digits and hyphen; must not lead with a hyphen;
// 32 characters max. Deliberately narrower than the process name charset: an arm tag is printed
// in board columns and used as an object key in `experiment.verdict.n_per_arm`, so `.` and `_`
// buy nothing and cost readability.
export const VARIANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// The full extended grammar. A near-miss slug (leading hyphen, upper case, 33 chars, an empty
// `+`) fails the whole match rather than being coerced or silently truncated — closed rules
// only, per the header of hq/lib/validate.mjs.
export const PROCESS_RE = /^[a-z0-9][a-z0-9._-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+(\+[a-z0-9][a-z0-9-]{0,31})?$/;

// Split a process id into its base and its arm slug. Returns null when `id` is not a legal
// process id at all, so a caller can never mistake "no slug" for "not a process".
export function splitVariant(id) {
  if (typeof id !== "string" || !PROCESS_RE.test(id)) return null;
  const plus = id.indexOf("+");
  if (plus === -1) return { base: id, slug: null };
  return { base: id.slice(0, plus), slug: id.slice(plus + 1) };
}
