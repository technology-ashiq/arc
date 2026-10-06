// The outside world the frontend verify asks: the venture's own domain and PageSpeed Insights. The domain serves the
// shell's HTML only once main holds an app AND its production build ran (the hold lifted) -- read from the GitHub
// fake, so a test cannot pass by asserting the page into being. Everything else routes to the wrapped fetch.
//   scores      Lighthouse scores (0-100) per category PageSpeed returns
//   pagespeed   an HTTP status PageSpeed answers instead (429, 500), or "unreachable"
export function makeLive({ github, full, domain, inner, scores = { performance: 98, accessibility: 100, "best-practices": 100, seo: 100 }, pagespeed = 200, healthBody = null } = {}) {
  const calls = [];
  const html = (s, body) => new Response(body, { status: s, headers: { "content-type": "text/html" } });
  const json = (s, body) => new Response(JSON.stringify(body), { status: s, headers: { "content-type": "application/json" } });
  const serving = () => {
    const r = github.store.get(full);
    if (!r) return false;
    const held = r.commits.filter((c) => typeof c.hold === "boolean").pop();
    return !!held && held.hold === false && r.commits.some((c) => c.app);
  };
  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    calls.push(`${url.hostname}${url.pathname}`);
    if (url.hostname === domain) {
      if (!serving()) return html(404, "<h1>404: NOT_FOUND</h1>");
      // /api/health answers only once the route file is on main, with what the route would answer.
      if (url.pathname === "/api/health") {
        const route = github.store.get(full).files["app/api/health/route.js"];
        if (!route) return html(404, "<h1>404: NOT_FOUND</h1>");
        const src = Buffer.from(route.content, "base64").toString("utf8");
        const version = (src.match(/version: "([^"]+)"/) || [])[1] || "";
        return json(200, healthBody || { ok: true, service: "venture", version });
      }
      const layout = Buffer.from(github.store.get(full).files["app/layout.js"].content, "base64").toString("utf8");
      const gen = (layout.match(/generator: "([^"]+)"/) || [])[1] || "";
      return html(200, `<!DOCTYPE html><html lang="en"><head><meta name="generator" content="${gen}"/></head><body><main>shell</main></body></html>`);
    }
    if (url.hostname === "www.googleapis.com") {
      if (pagespeed === "unreachable") throw new TypeError("fetch failed");
      if (pagespeed !== 200) return json(pagespeed, { error: { code: pagespeed, message: "Quota exceeded for quota metric 'Queries'" } });
      if (!serving()) return json(200, { error: { code: 500, message: "Lighthouse returned error: FAILED_DOCUMENT_REQUEST" } });
      return json(200, { lighthouseResult: { categories: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { id: k, score: v === null ? null : v / 100 }])) } });
    }
    return inner(input, init);
  }
  return { fetch, calls };
}
