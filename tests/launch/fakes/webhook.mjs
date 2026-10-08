// The venture's webhook route and its table, for the webhooks-ledger slot (ADR-1739). The route that answers is the
// REAL route file launch committed, read from main in the GitHub fake and imported from its own bytes, so the signature
// check and the dedupe under test are the shipped code, not a model of it. Around it, only the transport is faked:
// the Supabase Management API statements on razorpay_webhook_events and PostgREST's insert at <ref>.supabase.co.
// Everything else goes to `inner`.
//   hookKey    the RAZORPAY_WEBHOOK_SECRET placed in the venture's env (null = never placed)
//   serve      (src) => src -- the build that is deployed; a test may serve something other than main's file
//   policies   policies on the table (a broken venture that opened it to users)
//   foreign    the table already exists without launch's marker (the owner's own)
export function makeWebhook({ github, supabase, full, domain, inner, hookKey = null, serve = (src) => src, policies = 0, foreign = false, token = "sbp_fixture_token_0123456789abcd" } = {}) {
  const ROUTE = "app/api/webhooks/razorpay/route.js";
  const T = "razorpay_webhook_events";
  const calls = [];
  const loaded = new Map();
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const project = () => supabase.store[0];
  if (foreign) project().tables[T] = { rls: true, rows: [] };
  const table = () => project().tables[T];

  // The Management API, for the statements only this table has. The rest (marker, RLS, counts) is the Supabase fake's.
  function sql(text) {
    const s = String(text);
    if (s.startsWith("-- arc-launch migration: webhooks")) {
      project().tables[T] = table() || { rls: false, rows: [] };
      if (s.includes(`alter table public.${T} enable row level security;`)) table().rls = true;
      if (s.includes(`comment on table public.${T} is 'arc-launch webhooks';`)) table().comment = "arc-launch webhooks";
      return [];
    }
    if (s.includes("from pg_policies") && s.includes(`tablename = '${T}'`)) return [{ n: table() ? policies : 0 }];
    const lead = `from public.${T} where payment_id = '`;
    if (s.includes(lead)) {
      if (!table()) return { error: `relation "public.${T}" does not exist` };
      const pid = s.slice(s.indexOf(lead) + lead.length).split("'")[0];
      return table().rows.filter((r) => r.payment_id === pid).sort((a, b) => (a.event_id < b.event_id ? -1 : 1))
        .map((r) => ({ event_id: r.event_id, event: r.event, payment_id: r.payment_id, amount: r.amount, fee: r.fee, currency: r.currency, paid_at: r.paid_at === null ? null : Math.floor(Date.parse(r.paid_at) / 1000) }));
    }
    return null;
  }

  // PostgREST's insert, as the route calls it: the service key writes; RLS with no policy refuses everyone else.
  async function rest(url, init) {
    const p = project();
    const h = init.headers || {};
    if (String(init.method || "GET").toUpperCase() !== "POST" || url.pathname !== `/rest/v1/${T}`) return json(404, { message: "not modelled" });
    if (!table()) return json(404, { message: `relation "public.${T}" does not exist` });
    if (h.apikey !== `service-key-${p.id}` || h.authorization !== `Bearer service-key-${p.id}`) return json(401, { message: "new row violates row-level security policy" });
    const row = JSON.parse(init.body);
    const ignore = String(h.prefer || "").includes("resolution=ignore-duplicates") && url.searchParams.get("on_conflict") === "event_id";
    if (table().rows.some((r) => r.event_id === row.event_id)) return ignore ? json(201, []) : json(409, { message: "duplicate key value violates unique constraint" });
    table().rows.push(row);
    return json(201, String(h.prefer || "").includes("return=representation") ? [row] : []);
  }

  // The deployed route: main's file (as `serve` builds it), run under the venture's env, its fetch reaching this fake.
  async function route(input, init) {
    const f = github.store.get(full).files[ROUTE];
    if (!f) return json(404, { error: "NOT_FOUND" });
    const src = serve(Buffer.from(f.content, "base64").toString("utf8"));
    if (!loaded.has(src)) loaded.set(src, await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`));
    const mod = loaded.get(src);
    const keep = { s: process.env.RAZORPAY_WEBHOOK_SECRET, u: process.env.NEXT_PUBLIC_SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
    const put = (k, v) => { if (v === null || v === undefined) delete process.env[k]; else process.env[k] = v; };
    put("RAZORPAY_WEBHOOK_SECRET", hookKey);
    put("NEXT_PUBLIC_SUPABASE_URL", `https://${project().id}.supabase.co`);
    put("SUPABASE_SERVICE_ROLE_KEY", `service-key-${project().id}`);
    try {
      return await mod.POST(new Request(String(input), { method: "POST", headers: init.headers || {}, body: init.body }));
    } finally {
      put("RAZORPAY_WEBHOOK_SECRET", keep.s);
      put("NEXT_PUBLIC_SUPABASE_URL", keep.u);
      put("SUPABASE_SERVICE_ROLE_KEY", keep.k);
    }
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    if (url.hostname === domain && url.pathname === "/api/webhooks/razorpay") {
      calls.push(`${method} ${url.pathname}`);
      return method === "POST" ? route(input, init) : json(405, { error: "method not allowed" });
    }
    const p = project();
    if (p && url.hostname === `${p.id}.supabase.co` && url.pathname.startsWith("/rest/v1/")) return rest(url, init);
    const q = url.pathname.match(/^\/v1\/projects\/([a-z0-9]{20})\/database\/query$/);
    if (url.hostname === "api.supabase.com" && q && method === "POST" && (init.headers || {}).authorization === `Bearer ${token}` && p && q[1] === p.id) {
      const out = sql(JSON.parse(init.body).query);
      if (out && out.error) return json(400, { message: out.error });
      if (out) return json(201, out);
    }
    return inner(input, init);
  }
  return { fetch, calls, table };
}
