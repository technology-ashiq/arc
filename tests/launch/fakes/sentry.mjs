// Sentry and the venture's error-probe route, for the errors slot (ADR-1747). The route that answers is the REAL route
// file launch committed, read from main in the GitHub fake and imported from its own bytes; it reports over the store
// API to this fake, which groups events by message into issues the way Sentry does. Everything else goes to `inner`.
//   projects   [{ slug, org }] the token can see
//   keys       client keys per project (false = none active)
//   ingest     false = the store endpoint refuses (a revoked key), so no issue appears
//   serve      (src) => src -- the route that is deployed
const FIXTURE_TOKEN = "sntrys_fixtureToken0123456789abcdef"; // gitleaks:allow -- a fixture, never a real token
export function makeSentry({ github, full, domain, inner, token = FIXTURE_TOKEN, projects = [{ slug: "arc-sandbox", org: "automemory" }], keys = true, ingest = true, serve = (src) => src } = {}) {
  const ROUTE = "app/api/arc-error-probe/route.js";
  const KEY = "0123456789abcdef0123456789abcdef"; // gitleaks:allow -- a fixture DSN key
  const DSN = `https://${KEY}@o4500000000000001.ingest.sentry.io/4500000000000002`;
  const issues = [];
  const calls = [];
  const loaded = new Map();
  const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  async function route(input) {
    const f = github.store.get(full).files[ROUTE];
    if (!f) return json(404, { error: "NOT_FOUND" });
    const src = serve(Buffer.from(f.content, "base64").toString("utf8"));
    if (!loaded.has(src)) loaded.set(src, await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`));
    return loaded.get(src).GET(new Request(String(input)));
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    if (url.hostname === domain && url.pathname === "/api/arc-error-probe") { calls.push(`${method} route`); return route(input); }
    if (url.hostname === "o4500000000000001.ingest.sentry.io" && url.pathname === "/api/4500000000000002/store/" && method === "POST") {
      calls.push("POST store");
      const auth = String((init.headers || {})["x-sentry-auth"] || "");
      if (!ingest || !auth.includes(`sentry_key=${KEY}`)) return json(401, { detail: "invalid key" });
      const ev = JSON.parse(init.body);
      const now = new Date().toISOString();
      const hit = issues.find((i) => i.title === ev.message);
      if (hit) { hit.count += 1; hit.lastSeen = now; } else issues.push({ id: String(4000 + issues.length), title: ev.message, count: 1, lastSeen: now });
      return json(200, { id: "e".repeat(32) });
    }
    if (url.hostname === "sentry.io" && url.pathname.startsWith("/api/0/")) {
      calls.push(`${method} ${url.pathname}`);
      if ((init.headers || {}).authorization !== `Bearer ${token}`) return json(401, { detail: "Invalid token" });
      const p = url.pathname.slice("/api/0".length);
      if (p === "/projects/") return json(200, projects.map((x, i) => ({ id: String(i + 1), slug: x.slug, organization: { slug: x.org } })), { link: "<https://sentry.io/api/0/projects/?cursor=0:100:0>; rel=\"next\"; results=\"false\"; cursor=\"0:100:0\"" });
      const m = p.match(/^\/projects\/([^/]+)\/([^/]+)\/(keys|issues)\/$/);
      const proj = m && projects.find((x) => x.org === m[1] && x.slug === m[2]);
      if (!proj) return json(404, { detail: "The requested resource does not exist" });
      if (m[3] === "keys") return json(200, keys ? [{ id: "k1", isActive: true, dsn: { public: DSN } }] : []);
      const q = (url.searchParams.get("query") || "").replace(/^"|"$/g, "");
      return json(200, issues.filter((i) => i.title.includes(q)));
    }
    return inner(input, init);
  }
  return { fetch, calls, issues, DSN };
}
