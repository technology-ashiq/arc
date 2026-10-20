// In-memory Cloudflare: one or more zones, a DNS record store, and the two DoH resolvers answering from that store.
// It replaces only the transport (globalThis.fetch); the adapter and ctx.fetch's host guard run as they do for real.
// A proxied record is answered as A records, the way Cloudflare's edge flattens it -- so a grey-cloud check is real.
// A zone carries `status` and `name_servers` (the zones API's own fields); the resolvers answer a zone apex's NS query
// with `publicNs[name]` when given (a delegation that disagrees), else the zone's own nameservers. `rdap[name]` is the
// .com/.net registry's answer for a domain (status 404 when absent), for the domain slot's zone check (ADR-1766).
// `addrs[host]` = { A, AAAA } is what an outside host (the hosting target) resolves to.
const NS = ["meera.ns.cloudflare.com", "noel.ns.cloudflare.com"];
export function makeCloudflare({ zones = [{ id: "zone-1", name: "automemory.ai" }], token = "cf-token-0123456789abcdef", seed = [], publicNs = {}, rdap = {}, addrs = {} } = {}) {
  zones = zones.map((z) => ({ status: "active", name_servers: NS, ...z }));
  const records = seed.map((r, i) => ({ id: `seed-${i + 1}`, ...r }));
  const calls = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, code, message) => json(status, { success: false, errors: [{ code, message }], result: null });

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.hostname}${url.pathname}${url.search}`);
    if (url.hostname === "rdap.verisign.com") {
      const name = decodeURIComponent(url.pathname.split("/").pop());
      const r = rdap[name];
      if (!r) return new Response(JSON.stringify({ errorCode: 404, title: "Not Found" }), { status: 404 });
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/rdap+json" } });
    }
    if (url.hostname === "dns.google" || url.hostname === "cloudflare-dns.com") {
      const name = url.searchParams.get("name");
      if ((url.searchParams.get("type") || "A") === "NS") {
        const z = zones.find((x) => x.name === name);
        const ns = publicNs[name] || (z && z.status === "active" ? z.name_servers : []);
        return json(200, { Status: 0, Answer: ns.map((d) => ({ name: `${name}.`, type: 2, TTL: 3600, data: `${d}.` })) });
      }
      const qtype = url.searchParams.get("type") || "A";
      const hits = records.filter((r) => r.name === name);
      const ip = (list, type) => (list || []).map((d) => ({ name: `${name}.`, type, TTL: 300, data: d }));
      if (!hits.length && addrs[name]) return json(200, { Status: 0, Answer: qtype === "AAAA" ? ip(addrs[name].AAAA, 28) : qtype === "A" ? ip(addrs[name].A, 1) : [] });
      const answer = hits.flatMap((r) => (r.proxied
        ? [{ name: `${name}.`, type: 1, TTL: 300, data: "104.21.0.1" }]
        // A CNAME at a zone apex is always flattened: the resolver sees the target's addresses, never the CNAME.
        : r.type === "CNAME" && zones.some((z) => z.name === name) ? (qtype === "AAAA" ? ip((addrs[r.content] || {}).AAAA, 28) : qtype === "A" ? ip((addrs[r.content] || {}).A, 1) : [])
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
