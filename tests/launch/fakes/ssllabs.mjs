// In-memory SSL Labs v3 analyze endpoint, plus Vercel's domain config for the tls slot. Replaces only the transport.
//   pendingPolls  how many analyze reads answer IN_PROGRESS before READY
//   endpoints     what READY returns: [{ ipAddress, grade, hsts }]
//   status        an HTTP status every analyze read answers instead (429, 529, 503), or "unreachable"
//   misconfigured what Vercel's domain config says
export function makeSslLabs({ pendingPolls = 0, endpoints = [{ ipAddress: "76.76.21.21", grade: "A+", hsts: true }], status = 200, misconfigured = false, vercelToken = "vercel_fixture_token_0123456789" } = {}) {
  const calls = [];
  let left = pendingPolls;
  const json = (s, body) => new Response(JSON.stringify(body), { status: s, headers: { "content-type": "application/json" } });
  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    calls.push(`${url.hostname}${url.pathname}?${url.searchParams.toString()}`);
    if (url.hostname === "api.vercel.com") {
      if ((init.headers || {}).authorization !== `Bearer ${vercelToken}`) return json(403, { error: { code: "forbidden", message: "Not authorized" } });
      return json(200, { misconfigured, recommendedCNAME: [], configuredBy: misconfigured ? null : "CNAME" });
    }
    if (url.hostname !== "api.ssllabs.com") throw new Error(`fake ssllabs: unexpected host ${url.hostname}`);
    if (status === "unreachable") throw new TypeError("fetch failed");
    if (status !== 200) return json(status, { errors: [{ message: "Running at full capacity. Please try again later." }] });
    if (left > 0) { left--; return json(200, { host: url.searchParams.get("host"), status: "IN_PROGRESS" }); }
    return json(200, {
      host: url.searchParams.get("host"), status: "READY",
      endpoints: endpoints.map((e) => ({ ipAddress: e.ipAddress, grade: e.grade, details: { hstsPolicy: { status: e.hsts ? "present" : "absent", maxAge: e.hsts ? 63072000 : 0 } } })),
    });
  }
  return { fetch, calls };
}
