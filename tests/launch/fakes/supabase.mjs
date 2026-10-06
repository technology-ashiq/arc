// In-memory Supabase Management API: organizations, projects, and a tiny SQL engine for exactly the statements the
// database adapter sends (create/alter/insert/select on public.launch_probe, the pg_policies count, `set local role`).
// RLS is modelled: a table with RLS on and no policy returns 0 rows to `anon` and all rows to the owner role.
//   orgs          organizations the token sees
//   projects      seed projects [{ id, name, status }]
//   becomeHealthy how many GETs a new project answers COMING_UP before ACTIVE_HEALTHY
//   rlsOff        the probe table's RLS is ignored (a broken database) -- anon sees every row
//   policy        a policy exists on the probe table
export function makeSupabase({ token = "sbp_fixture_token_0123456789abcd", orgs = [{ id: "org_fixture", name: "ashiq" }], projects = [], becomeHealthy = 1, rlsOff = false, policy = false, queryShape = "rows" } = {}) {
  const store = projects.map((p) => ({ status: "ACTIVE_HEALTHY", tables: {}, polls: 0, ...p }));
  const calls = [];
  const bodies = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, message) => json(status, { message });

  // Answers with the LAST statement's rows only, as the real endpoint does: a trailing `commit` answers [].
  function run(p, sql) {
    // A launch migration runs whole (its function bodies hold semicolons); the marker line says which one.
    const mig = String(sql).match(/^-- arc-launch migration: (authz|tenancy)/);
    if (mig) {
      if (mig[1] === "tenancy" && !p.tables.orgs) return { error: "relation \"public.orgs\" does not exist" };
      for (const t of mig[1] === "authz" ? ["orgs", "memberships"] : ["invites"]) p.tables[t] = p.tables[t] || { rls: !rlsOff, rows: [] };
      return { rows: [] };
    }
    const inList = String(sql).match(/from pg_tables where schemaname = 'public' and tablename in \(([^)]*)\)( and rowsecurity)?;/);
    if (inList) {
      const names = inList[1].split(",").map((x) => x.trim().replace(/^'|'$/g, ""));
      return { rows: [{ n: names.filter((t) => p.tables[t] && (!inList[2] || p.tables[t].rls)).length }] };
    }
    let out = [];
    const anon = /set local role anon/i.test(sql);
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      out = [];
      if (/^(begin|commit|set local role anon)$/i.test(stmt)) continue;
      if (/^select count\(\*\)::int as n from pg_tables/i.test(stmt)) out = [{ n: p.tables.launch_probe ? 1 : 0 }];
      else if (/^select \(count\(\*\) = 1 and bool_and\(id = 1 and note = 'owner-only'\)\)::int as n/i.test(stmt)) {
        const rows = (p.tables.launch_probe || { rows: [] }).rows;
        out = [{ n: rows.length === 1 && rows[0].id === 1 && (rows[0].note || "owner-only") === "owner-only" ? 1 : 0 }];
      }
      else if (/^create table if not exists public\.launch_probe/i.test(stmt)) p.tables.launch_probe = p.tables.launch_probe || { rls: false, rows: [] };
      else if (/^alter table public\.launch_probe enable row level security/i.test(stmt)) p.tables.launch_probe.rls = true;
      else if (/^insert into public\.launch_probe/i.test(stmt)) { const t = p.tables.launch_probe; if (!t.rows.some((r) => r.id === 1)) t.rows.push({ id: 1 }); }
      else if (/^select count\(\*\)::int as n from pg_policies/i.test(stmt)) out = [{ n: policy ? 1 : 0 }];
      else if (/^select count\(\*\)::int as n from public\.launch_probe/i.test(stmt)) {
        const t = p.tables.launch_probe;
        if (!t) return { error: "relation \"public.launch_probe\" does not exist" };
        const visible = anon && t.rls && !rlsOff && !policy ? 0 : t.rows.length;
        out = [{ n: visible }];
      }
    }
    return { rows: out };
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    // PostgREST at <ref>.supabase.co with the anon key: RLS on and no policy answers [] to anon, as the real one does.
    const rest = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
    if (rest) {
      const proj = store.find((x) => x.id === rest[1]);
      calls.push(`GET ${url.hostname}${url.pathname}`);
      if (!proj) return err(404, "project not found");
      if ((init.headers || {}).apikey !== `anon-key-${proj.id}`) return err(401, "Invalid API key");
      const t = proj.tables.launch_probe;
      if (!t) return err(404, "relation does not exist");
      return json(200, t.rls && !rlsOff && !policy ? [] : t.rows.map((r) => ({ id: r.id })));
    }
    if (url.hostname !== "api.supabase.com") throw new Error(`fake supabase: unexpected host ${url.hostname}`);
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);
    if ((init.headers || {}).authorization !== `Bearer ${token}`) return err(401, "Unauthorized");
    const body = init.body ? JSON.parse(init.body) : null;
    if (body) bodies.push(body);
    const p = url.pathname.replace(/^\/v1/, "");
    if (method === "GET" && p === "/organizations") return json(200, orgs);
    if (method === "GET" && p === "/projects") return json(200, store.map(({ id, name, status }) => ({ id, name, status, organization_id: orgs[0] && orgs[0].id })));
    if (method === "POST" && p === "/projects") {
      if (!orgs.some((o) => o.id === body.organization_id)) return err(400, "organization not found");
      if (typeof body.db_pass !== "string" || body.db_pass.length < 16) return err(400, "db_pass too weak");
      const proj = { id: `fixtureref${String(++n).padStart(10, "0")}`, name: body.name, region: body.region, status: "COMING_UP", tables: {}, polls: 0 };
      store.push(proj);
      return json(201, { id: proj.id, ref: proj.id, name: proj.name, status: proj.status });
    }
    let m = p.match(/^\/projects\/([a-z0-9]{20})$/);
    if (m && method === "GET") {
      const proj = store.find((x) => x.id === m[1]);
      if (!proj) return err(404, "project not found");
      if (proj.status === "COMING_UP" && ++proj.polls >= becomeHealthy) proj.status = "ACTIVE_HEALTHY";
      return json(200, { id: proj.id, name: proj.name, status: proj.status });
    }
    m = p.match(/^\/projects\/([a-z0-9]{20})\/config\/auth$/);
    if (m) {
      const proj = store.find((x) => x.id === m[1]);
      if (!proj) return err(404, "project not found");
      proj.auth = proj.auth || { site_url: "http://localhost:3000" };
      if (method === "GET") return json(200, proj.auth);
      if (method === "PATCH") { Object.assign(proj.auth, body); return json(200, proj.auth); }
    }
    m = p.match(/^\/projects\/([a-z0-9]{20})\/api-keys$/);
    if (m && method === "GET") return store.some((x) => x.id === m[1]) ? json(200, ["anon", "service_role"].map((name) => Object.fromEntries([["name", name], ["api_key", `${name === "anon" ? "anon" : "service"}-key-${m[1]}`]]))) : err(404, "project not found");
    m = p.match(/^\/projects\/([a-z0-9]{20})\/database\/query$/);
    if (m && method === "POST") {
      const proj = store.find((x) => x.id === m[1]);
      if (!proj) return err(404, "project not found");
      if (proj.status !== "ACTIVE_HEALTHY") return err(400, "project is not ready");
      const r = run(proj, body.query);
      if (r.error) return err(400, r.error);
      return json(201, queryShape === "object" ? { result: r.rows } : r.rows);
    }
    return err(404, `fake supabase: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls, bodies };
}
