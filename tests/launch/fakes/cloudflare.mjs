// In-memory Cloudflare: one or more zones, a DNS record store, and the two DoH resolvers answering from that store.
// It replaces only the transport (globalThis.fetch); the adapter and ctx.fetch's host guard run as they do for real.
// A proxied record is answered as A records, the way Cloudflare's edge flattens it -- so a grey-cloud check is real.
export function makeCloudflare({ zones = [{ id: "zone-1", name: "automemory.ai" }], token = "cf-token-0123456789abcdef", seed = [] } = {}) {
  const records = seed.map((r, i) => ({ id: `seed-${i + 1}`, ...r }));
  const calls = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, code, message) => json(status, { success: false, errors: [{ code, message }], result: null });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.hostname}${url.pathname}${url.search}`);
    if (url.hostname === "dns.google" || url.hostname === "cloudflare-dns.com") {
      const name = url.searchParams.get("name");
      const hits = records.filter((r) => r.name === name);
      const answer = hits.flatMap((r) => (r.proxied
        ? [{ name: `${name}.`, type: 1, TTL: 300, data: "104.21.0.1" }]
        : r.type === "CNAME" ? [{ name: `${name}.`, type: 5, TTL: 300, data: `${r.content}.` }]
        : r.type === "TXT" && (url.searchParams.get("type") || "A") === "TXT" ? [{ name: `${name}.`, type: 16, TTL: 300, data: JSON.stringify(r.content) }] : []));
      return json(200, { Status: 0, Answer: answer });
    }
    if (url.hostname !== "api.cloudflare.com") throw new Error(`fake cloudflare: unexpected host ${url.hostname}`);
    const auth = (init.headers && (init.headers.authorization || init.headers.Authorization)) || "";
    if (auth !== `Bearer ${token}`) return err(401, 10000, "Authentication error");
    const p = url.pathname.replace(/^\/client\/v4/, "");
    if (method === "GET" && p === "/zones") return json(200, { success: true, errors: [], result: zones.filter((z) => z.name === url.searchParams.get("name")) });
    const m = p.match(/^\/zones\/([^/]+)\/dns_records(?:\/([^/]+))?$/);
    if (!m || !zones.some((z) => z.id === m[1])) return err(404, 7003, "Could not route to the requested resource");
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === "GET" && !m[2]) return json(200, { success: true, errors: [], result: records.filter((r) => r.zone === m[1] && r.name === url.searchParams.get("name") && (!url.searchParams.get("type") || r.type === url.searchParams.get("type"))) });
    if (method === "POST" && !m[2]) {
      if (records.some((r) => r.zone === m[1] && r.name === body.name && (r.type === "CNAME" || body.type === "CNAME")))
        return err(400, 81053, "An A, AAAA, or CNAME record with that host already exists.");
      const r = { ...body, id: `rec-${++n}`, zone: m[1] };
      records.push(r);
      return json(200, { success: true, errors: [], result: r });
    }
    if (method === "PATCH" && m[2]) {
      const r = records.find((x) => x.id === m[2] && x.zone === m[1]);
      if (!r) return err(404, 81044, "Record does not exist.");
      Object.assign(r, body);
      return json(200, { success: true, errors: [], result: r });
    }
    return err(405, 10405, `fake cloudflare: ${method} ${p} not modelled`);
  }
  return { fetch, records, calls };
}
