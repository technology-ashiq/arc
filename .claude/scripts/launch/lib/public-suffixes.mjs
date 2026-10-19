// The namespaces a venture's `brand.domain` may never be (ADR-1765). `hostAllowed()` admits every subdomain of an
// entry, so a `@venture` that resolved to `vercel.app` or `co.uk` would hand an adapter every tenant under it (kickoff
// attack A4). Not a full public-suffix list: the lane carries zero dependencies, and these are the shapes a launch
// venture's own domain could plausibly be mistaken for. ctx and launch-lint both read this one module.

// Hosting and storage platforms that hand every customer a subdomain. Still a closed list, so still incomplete by
// nature (attack 74ba8f0 L1/L2): a platform missing here is one more line, and launch-lint reads the same list.
export const MULTI_TENANT = [
  "vercel.app", "vercel.dev", "github.io", "githubusercontent.com", "gitlab.io", "pages.dev", "workers.dev", "r2.dev",
  "netlify.app", "web.app", "firebaseapp.com", "appspot.com", "herokuapp.com", "onrender.com", "fly.dev", "railway.app",
  "deno.dev", "replit.app", "repl.co", "glitch.me", "surge.sh", "ngrok.io", "ngrok-free.app", "trycloudflare.com",
  "amazonaws.com", "cloudfront.net", "azurewebsites.net", "azurestaticapps.net", "blogspot.com", "wordpress.com",
  "supabase.co", "neon.tech",
];

// A bare hostname of two or more labels, lower-case, no scheme, port, path, wildcard or trailing dot.
export const BARE_HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

// A second-level registry suffix under a two-letter TLD (`co.uk`, `co.in`, `com.au`).
export const CC_SECOND_LEVEL = /^(co|com|net|org|gov|ac|edu|ltd|plc|gen|firm|ind|nic|res|me|biz|info)\.[a-z]{2}$/;

export function isSharedSuffix(name) {
  const n = String(name).toLowerCase();
  return MULTI_TENANT.includes(n) || CC_SECOND_LEVEL.test(n);
}
