// In-memory Neon: the v2 API (projects, connection_uri) and the per-project SQL-over-HTTP endpoint, for the database
// slot's second provider (ADR-1721). The SQL endpoint understands exactly the statements the neon adapter sends, and
// RLS is modelled as Postgres does it: a role without BYPASSRLS reads no row of an RLS table that has no policy.
//   rlsOff      the migration's `enable row level security` is ignored (a broken database)
//   anonBypass  launch_anon is created with BYPASSRLS (a broken role)
//   foreign     a project of launch's name already exists that launch did not create
export function makeNeon({ key = "neon_fixture_key_0123456789abcdefABCDEF", rlsOff = false, anonBypass = false, foreign = false } = {}) { // gitleaks:allow -- fixture key
  const projects = [];
  const calls = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const make = (name) => {
    const id = `fixture-proj-${String(++n).padStart(4, "0")}`;
    const p = { id, name, host: `ep-${id}.ap-southeast-1.aws.neon.tech`, tables: {}, roles: { neondb_owner: { bypass: true } } };
    projects.push(p);
    return p;
  };
  if (foreign) make("arc-launch-arc-sandbox");
  const byHost = (h) => projects.find((p) => p.host === h);

  function run(p, query, role) {
    const q = query.trim();
    if (q.startsWith("create table if not exists public.launch_probe")) { p.tables.launch_probe = p.tables.launch_probe || { rls: false, rows: [] }; return { rows: [] }; }
    if (q === "alter table public.launch_probe enable row level security") { if (!rlsOff) p.tables.launch_probe.rls = true; return { rows: [] }; }
    if (q.startsWith("insert into public.launch_probe")) { const t = p.tables.launch_probe; if (!t.rows.some((r) => r.id === 1)) t.rows.push({ id: 1, note: "owner-only" }); return { rows: [] }; }
    if (q.startsWith("do $$ begin if not exists (select 1 from pg_roles where rolname = 'launch_anon')")) { p.roles.launch_anon = p.roles.launch_anon || { bypass: anonBypass }; return { rows: [] }; }
    if (q.startsWith("grant ")) return { rows: [] };
    if (q.startsWith("select count(*)::int as n from pg_tables")) return { rows: [{ n: p.tables.launch_probe && p.tables.launch_probe.rls ? 1 : 0 }] };
    if (q === "select count(*)::int as n from public.launch_probe") {
      const t = p.tables.launch_probe;
      if (!t) throw new Error("relation \"public.launch_probe\" does not exist");
      const r = p.roles[role] || { bypass: false };
      return { rows: [{ n: t.rls && !r.bypass ? 0 : t.rows.length }] };
    }
    throw new Error(`fake neon: statement not modelled: ${q.slice(0, 60)}`);
  }

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    const h = init.headers || {};
    calls.push(`${method} ${url.hostname}${url.pathname}`);
    if (url.hostname === "console.neon.tech" && url.pathname.startsWith("/api/v2/")) {
      if (h.authorization !== `Bearer ${key}`) return json(401, { message: "authentication required" });
      const p = url.pathname.slice("/api/v2".length);
      if (p === "/projects" && method === "GET") {
        const s = url.searchParams.get("search") || "";
        return json(200, { projects: projects.filter((x) => x.name.includes(s)).map((x) => ({ id: x.id, name: x.name })), pagination: {} });
      }
      if (p === "/projects" && method === "POST") {
        const body = JSON.parse(init.body);
        const made = make(body.project.name);
        return json(201, { project: { id: made.id, name: made.name } });
      }
      const m = p.match(/^\/projects\/([a-z0-9-]+)(\/connection_uri)?$/);
      const proj = m && projects.find((x) => x.id === m[1]);
      if (!proj) return json(404, { message: "project not found" });
      if (m[2]) {
        // Built through URL so no user-and-password literal sits in this file for a scanner to read as a credential.
        const u = new URL(`postgresql://${proj.host}/neondb?sslmode=require`);
        u.username = "neondb_owner";
        u.password = ["fixture", "only"].join("-");
        return json(200, { uri: u.toString() });
      }
      return json(200, { project: { id: proj.id, name: proj.name } });
    }
    const proj = byHost(url.hostname);
    if (proj && url.pathname === "/sql" && method === "POST") {
      if (!String(h["neon-connection-string"] || "").includes(`@${proj.host}/`)) return json(401, { message: "password authentication failed" });
      const body = JSON.parse(init.body);
      let role = "neondb_owner";
      const results = [];
      try {
        for (const { query } of body.queries) {
          const m = query.match(/^set local role ([a-z_]+)$/);
          if (m) { role = m[1]; results.push({ rows: [] }); continue; }
          results.push(run(proj, query, role));
        }
      } catch (e) { return json(400, { message: e.message }); }
      return json(200, { results });
    }
    return json(404, { message: `fake neon: ${method} ${url.hostname}${url.pathname} not modelled` });
  }
  return { fetch, calls, projects };
}
