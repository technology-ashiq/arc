// In-memory SSL Labs v3 analyze endpoint, plus Vercel's domain config for the tls slot. Replaces only the transport.
//   pendingPolls  how many analyze reads answer IN_PROGRESS before READY
//   endpoints     what READY returns: [{ ipAddress, grade, hsts }]
//   status        an HTTP status every analyze read answers instead (429, 529, 503), or "unreachable"
//   misconfigured what Vercel's domain config says
//   stale         what a READY answer returns until a startNew=on scan is asked for (an old cached scan); null = none
//   endpoints[].http  the HTTP status SSL Labs' own request got (default 200); 403 = the host refused the scanner
//   liveHsts      the venture's own strict-transport-security header, or null for none
//   liveRedirect  the venture's "/" answers this redirect (no HSTS on it) and serves liveHsts at the target
export function makeSslLabs({ pendingPolls = 0, endpoints = [{ ipAddress: "76.76.21.21", grade: "A+", hsts: true }], status = 200, misconfigured = false, stale = null, liveHsts = null, liveRedirect = null, vercelToken = "vercel_fixture_token_0123456789" } = {}) {
  const calls = [];
  let left = pendingPolls;
  let fresh = !stale;
  const json = (s, body) => new Response(JSON.stringify(body), { status: s, headers: { "content-type": "application/json" } });
  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    calls.push(`${url.hostname}${url.pathname}?${url.searchParams.toString()}`);
    if (url.hostname === "api.vercel.com") {
      if ((init.headers || {}).authorization !== `Bearer ${vercelToken}`) return json(403, { error: { code: "forbidden", message: "Not authorized" } });
      return json(200, { misconfigured, recommendedCNAME: [], configuredBy: misconfigured ? null : "CNAME" });
    }
    if (url.hostname === "sandbox.automemory.ai" && liveRedirect && url.pathname === "/")
      return new Response(null, { status: liveRedirect.status, headers: { location: liveRedirect.location } });
    if (url.hostname === "sandbox.automemory.ai")
      return new Response("<html></html>", { status: 200, headers: liveHsts ? { "strict-transport-security": liveHsts } : {} });
    if (url.hostname !== "api.ssllabs.com") throw new Error(`fake ssllabs: unexpected host ${url.hostname}`);
    if (status === "unreachable") throw new TypeError("fetch failed");
    if (status !== 200) return json(status, { errors: [{ message: "Running at full capacity. Please try again later." }] });
    if (url.searchParams.get("startNew") === "on") { fresh = true; return json(200, { host: url.searchParams.get("host"), status: "DNS" }); }
    if (left > 0) { left--; return json(200, { host: url.searchParams.get("host"), status: "IN_PROGRESS" }); }
    return json(200, {
      host: url.searchParams.get("host"), status: "READY",
      endpoints: (fresh ? endpoints : stale).map((e) => ({ ipAddress: e.ipAddress, grade: e.grade, details: { httpStatusCode: e.http || 200, hstsPolicy: { status: e.hsts ? "present" : "absent", maxAge: e.hsts ? 63072000 : 0 } } })),
    });
  }
  return { fetch, calls };
}
