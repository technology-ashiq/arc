// The namespaces a venture's `brand.domain` may never be (ADR-1765). `hostAllowed()` admits every subdomain of an
// entry, so a `@venture` that resolved to `vercel.app` or `co.uk` would hand an adapter every tenant under it (kickoff
// attack A4). Not a full public-suffix list: the lane carries zero dependencies, and these are the shapes a launch
// venture's own domain could plausibly be mistaken for. ctx and launch-lint both read this one module.

export const MULTI_TENANT = ["vercel.app", "github.io", "pages.dev", "netlify.app", "web.app", "herokuapp.com", "workers.dev", "supabase.co"];

// A bare hostname of two or more labels, lower-case, no scheme, port, path, wildcard or trailing dot.
export const BARE_HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

// A second-level registry suffix under a two-letter TLD (`co.uk`, `co.in`, `com.au`).
export const CC_SECOND_LEVEL = /^(co|com|net|org|gov|ac|edu)\.[a-z]{2}$/;

export function isSharedSuffix(name) {
  const n = String(name).toLowerCase();
  return MULTI_TENANT.includes(n) || CC_SECOND_LEVEL.test(n);
}
