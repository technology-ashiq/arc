// In-memory Resend domains API, wired to the in-memory Cloudflare (fakes/cloudflare.mjs): a domain verifies only when
// every record Resend lists is present in the zone with the exact content -- read from the Cloudflare fake, so a test
// cannot pass by asserting verification into being. It replaces only the transport; other hosts go to `inner`.
//   records     what Resend lists for a new domain (TXT/CNAME/MX)
//   domains     seed domains [{ id, name }]
export function makeResend({ cloudflare, inner, token = "re_fixture_token_0123456789", records = null, domains = [], zoneApex = "automemory.ai" } = {}) {
  const store = domains.map((d) => ({ status: "not_started", ...d }));
  const calls = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, message) => json(status, { statusCode: status, name: "error", message });
  // Names RELATIVE to the zone apex, as Resend lists them: `send.sandbox` for sandbox.automemory.ai under automemory.ai.
  const rel = (name) => (name.endsWith(`.${zoneApex}`) ? name.slice(0, -(zoneApex.length + 1)) : name);
  const abs = (n) => (n === zoneApex || n.endsWith(`.${zoneApex}`) ? n : `${n}.${zoneApex}`);
  const listed = (name) => records || [
    { record: "SPF", name: `send.${rel(name)}`, type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", priority: 10 },
    { record: "SPF", name: `send.${rel(name)}`, type: "TXT", value: "v=spf1 include:amazonses.com ~all" },
    { record: "DKIM", name: `resend._domainkey.${rel(name)}`, type: "TXT", value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfixture" },
  ];
  const present = (d) => d.records.every((r) => cloudflare.records.some((x) => x.type === r.type && x.name === abs(r.name) && String(x.content) === r.value));

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    if (url.hostname !== "api.resend.com") return inner(input, init);
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);
    if ((init.headers || {}).authorization !== `Bearer ${token}`) return err(401, "API key is invalid");
    const body = init.body ? JSON.parse(init.body) : null;
    const p = url.pathname;
    // Paged like the real list: `limit` rows, `has_more`, continue `after` an id.
    if (method === "GET" && p === "/domains") {
      const limit = Number(url.searchParams.get("limit") || 20);
      const after = url.searchParams.get("after");
      const start = after ? store.findIndex((d) => d.id === after) + 1 : 0;
      const rows = store.slice(start, start + limit);
      return json(200, { object: "list", has_more: start + limit < store.length, data: rows.map(({ id, name, status }) => ({ id, name, status })) });
    }
    if (method === "POST" && p === "/domains") {
      if (store.some((d) => d.name === body.name)) return err(422, "domain already exists");
      const d = { id: `dom_${String(++n).padStart(6, "0")}`, name: body.name, status: "not_started", records: listed(body.name) };
      store.push(d);
      return json(201, { id: d.id, name: d.name, status: d.status, records: d.records });
    }
    let m = p.match(/^\/domains\/([^/]+)$/);
    if (m && method === "GET") {
      const d = store.find((x) => x.id === decodeURIComponent(m[1]));
      if (!d) return err(404, "domain not found");
      d.records = d.records || listed(d.name);
      return json(200, { id: d.id, name: d.name, status: d.status, records: d.records.map((r) => ({ ...r, status: d.status === "verified" ? "verified" : "pending" })) });
    }
    m = p.match(/^\/domains\/([^/]+)\/verify$/);
    if (m && method === "POST") {
      const d = store.find((x) => x.id === decodeURIComponent(m[1]));
      if (!d) return err(404, "domain not found");
      d.status = present(d) ? "verified" : "failed";
      return json(200, { object: "domain", id: d.id });
    }
    return err(404, `fake resend: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls };
}
