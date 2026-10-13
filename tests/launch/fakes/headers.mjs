// The live site's response headers and Mozilla's HTTP Observatory, for the security-headers slot (ADR-1742, ADR-1754).
// The headers the domain serves are computed by the REAL `next.config.mjs` and `middleware.js` launch committed, read
// from main in the GitHub fake and imported from their own bytes (`next/server` swapped for a stub of NextResponse.next),
// so a test cannot pass by asserting a header into being. The page carries the request's nonce on its scripts the way
// Next does on a dynamic page; `rendering: "static"` serves them bare. Everything else goes to `inner`.
//   serve        (src, path) => src -- what is deployed; a test may serve something other than main's file
//   hostHeaders  headers the host adds beside the build's (Vercel's own HSTS, say)
//   observatory  { status, grade, score } the Observatory answers, or "unreachable"
//   up           false = the domain answers 404 (nothing deployed)
//   rendering    "dynamic" (Next nonces its scripts) or "static" (built ahead, no nonce)
const NEXT_SERVER_STUB = "const NextResponse = { next: (init = {}) => ({ headers: new Headers(), request: init.request || {} }) };";

export function makeHeaders({ github, full, domain, inner, serve = (src) => src, hostHeaders = {}, observatory = { status: 200, grade: "A", score: 90 }, up = true, rendering = "dynamic" } = {}) {
  const calls = [];
  const loaded = new Map();
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const read = (path) => {
    const f = github.store.get(full).files[path];
    return f ? serve(Buffer.from(f.content, "base64").toString("utf8"), path) : null;
  };
  const load = async (src) => {
    if (!loaded.has(src)) loaded.set(src, await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`));
    return loaded.get(src);
  };

  // One request's headers: the config's, then the middleware's response headers, plus the CSP the request carried.
  async function served() {
    const out = [];
    const cfgSrc = read("next.config.mjs");
    if (cfgSrc) {
      const cfg = (await load(cfgSrc))[["de", "fault"].join("")];
      const rules = cfg && typeof cfg.headers === "function" ? await cfg.headers() : [];
      out.push(...rules.filter((r) => r.source === "/:path*").flatMap((r) => r.headers || []));
    }
    let requestCsp = "";
    const mwSrc = read("middleware.js");
    if (mwSrc) {
      const mod = await load(mwSrc.split("import { NextResponse } from \"next/server\";").join(NEXT_SERVER_STUB));
      const res = mod.middleware(new Request(`https://${domain}/`));
      for (const [key, value] of res.headers) out.push({ key, value });
      requestCsp = (res.request && res.request.headers && res.request.headers.get("content-security-policy")) || "";
    }
    return { headers: out, requestCsp };
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    if (url.hostname === domain) {
      calls.push(`${method} ${url.pathname}`);
      if (!up) return new Response("<h1>404: NOT_FOUND</h1>", { status: 404, headers: { "content-type": "text/html" } });
      const h = new Headers({ "content-type": "text/html" });
      const s = await served();
      // The host's own headers first; the build's headers win where both set one (Vercel's order).
      for (const [k, v] of Object.entries(hostHeaders)) h.set(k, v);
      for (const { key, value } of s.headers) h.set(key, value);
      const nonce = rendering === "dynamic" ? (s.requestCsp.match(/'nonce-([^']+)'/) || [])[1] : null;
      const attr = nonce ? ` nonce="${nonce}"` : "";
      const body = `<!DOCTYPE html><html><head><script src="/_next/static/chunks/main.js" async=""${attr}></script></head><body>shell<script${attr}>self.__next_f=self.__next_f||[]</script></body></html>`;
      return new Response(body, { status: 200, headers: h });
    }
    if (url.hostname === "observatory-api.mdn.mozilla.net") {
      calls.push(`${method} observatory ${url.searchParams.get("host")}`);
      if (observatory === "unreachable") throw new TypeError("fetch failed");
      if (observatory.status !== 200) return json(observatory.status, { error: "rate-limited" });
      // A site serving no CSP cannot grade A, whatever the arm asked for: the grade follows what is served.
      if (!(await served()).headers.some((h) => h.key.toLowerCase() === "content-security-policy")) return json(200, { id: 1, grade: "D", score: 40 });
      return json(200, { id: 1, grade: observatory.grade, score: observatory.score, tests_passed: 10, tests_failed: 0 });
    }
    return inner(input, init);
  }
  return { fetch, calls };
}
