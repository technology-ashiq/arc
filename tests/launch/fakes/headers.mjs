// The live site's response headers and Mozilla's HTTP Observatory, for the security-headers slot (ADR-1742). The headers
// the domain serves are computed by the REAL `next.config.mjs` launch committed, read from main in the GitHub fake and
// imported from its own bytes, so a test cannot pass by asserting a header into being. Everything else goes to `inner`.
//   serve        (src) => src -- the config that is deployed; a test may serve something other than main's file
//   hostHeaders  headers the host adds beside the build's (Vercel's own HSTS, say)
//   observatory  { status, grade, score } the Observatory answers, or "unreachable"
//   up           false = the domain answers 404 (nothing deployed)
export function makeHeaders({ github, full, domain, inner, serve = (src) => src, hostHeaders = {}, observatory = { status: 200, grade: "A", score: 90 }, up = true } = {}) {
  const FILE = "next.config.mjs";
  const calls = [];
  const loaded = new Map();
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  async function served() {
    const f = github.store.get(full).files[FILE];
    if (!f) return [];
    const src = serve(Buffer.from(f.content, "base64").toString("utf8"));
    if (!loaded.has(src)) loaded.set(src, await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`));
    const cfg = loaded.get(src)[["de", "fault"].join("")];
    const rules = cfg && typeof cfg.headers === "function" ? await cfg.headers() : [];
    return rules.filter((r) => r.source === "/:path*").flatMap((r) => r.headers || []);
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    if (url.hostname === domain) {
      calls.push(`${method} ${url.pathname}`);
      if (!up) return new Response("<h1>404: NOT_FOUND</h1>", { status: 404, headers: { "content-type": "text/html" } });
      const h = new Headers({ "content-type": "text/html" });
      // The host's own headers first; the build's config headers win where both set one (Vercel's order).
      for (const [k, v] of Object.entries(hostHeaders)) h.set(k, v);
      for (const { key, value } of await served()) h.set(key, value);
      return new Response("<!DOCTYPE html><html><body>shell</body></html>", { status: 200, headers: h });
    }
    if (url.hostname === "observatory-api.mdn.mozilla.net") {
      calls.push(`${method} observatory ${url.searchParams.get("host")}`);
      if (observatory === "unreachable") throw new TypeError("fetch failed");
      if (observatory.status !== 200) return json(observatory.status, { error: "rate-limited" });
      // A site serving no CSP cannot grade A, whatever the arm asked for: the grade follows what is served.
      if (!(await served()).some((h) => h.key.toLowerCase() === "content-security-policy")) return json(200, { id: 1, grade: "D", score: 40 });
      return json(200, { id: 1, grade: observatory.grade, score: observatory.score, tests_passed: 10, tests_failed: 0 });
    }
    return inner(input, init);
  }
  return { fetch, calls };
}
