// database slot on Neon (ADR-1704, ADR-1721). The second database provider, entering by this file and its row only
// (REQ-08). One project per venture, named by the slot's tag and found before it is created. One migration creates
// `launch_probe` with RLS on and no policy, holding one owner-written row, and a `launch_anon` role without BYPASSRLS;
// verify proves RLS over Neon's SQL-over-HTTP endpoint: the owner reads 1 row, `launch_anon` reads 0. The connection
// string comes from the Neon API on every call and is recorded nowhere.
const API = "https://console.neon.tech/api/v2";
const REGION = { in: "aws-ap-southeast-1", us: "aws-us-east-2", eu: "aws-eu-central-1", any: "aws-us-east-2" };
const MIGRATION = [
  "create table if not exists public.launch_probe (id int primary key, note text not null)",
  "alter table public.launch_probe enable row level security",
  "insert into public.launch_probe (id, note) values (1, 'owner-only') on conflict (id) do nothing",
  "do $$ begin if not exists (select 1 from pg_roles where rolname = 'launch_anon') then create role launch_anon nologin nobypassrls; end if; end $$",
  "grant usage on schema public to launch_anon",
  "grant select on public.launch_probe to launch_anon",
];
const PROJECT_ID = /^[a-z0-9-]{4,60}$/;
const HOST = /^[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.neon\.tech$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

function tokenOf(ctx) {
  const t = String(ctx.env.NEON_API_KEY || "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(t)) throw refuse("BAD_TOKEN", "NEON_API_KEY is not a key shape; its value is not printed");
  return t;
}

async function neon(ctx, method, path, body, allow = []) {
  let res;
  try {
    res = await ctx.fetch(`${API}${path}`, { method, redirect: "manual",
      headers: { authorization: `Bearer ${tokenOf(ctx)}`, accept: "application/json", "content-type": "application/json", "user-agent": "arc-launch" },
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`neon ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body: json };
  const m = json && typeof json.message === "string" ? `: ${say(json.message)}` : "";
  throw new Error(`neon ${method} ${path.split("?")[0]} -> ${res.status}${m}`);
}

// The connection string, fresh from the API: never stored, never printed. Its host must be a neon.tech host.
async function connection(ctx, id) {
  const r = await neon(ctx, "GET", `/projects/${id}/connection_uri?database_name=neondb&role_name=neondb_owner`);
  const uri = r.body && typeof r.body.uri === "string" ? r.body.uri : "";
  let host = "";
  try { host = new URL(uri).hostname; } catch { host = ""; }
  if (!HOST.test(host)) throw new Error("neon answered no connection string on a neon.tech host");
  return { uri, host };
}

// One transaction over SQL-over-HTTP; `role` runs the last query as that role (set local role), so a role check is
// the database's answer, not a model of it.
async function sql(ctx, conn, queries) {
  let res;
  try {
    res = await ctx.fetch(`https://${conn.host}/sql`, { method: "POST", redirect: "manual",
      headers: { "content-type": "application/json", "neon-connection-string": conn.uri, "neon-batch-isolation-level": "Serializable", "user-agent": "arc-launch" },
      body: JSON.stringify({ queries: queries.map((query) => ({ query, params: [] })) }) });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`neon sql -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (!res.ok || !json || !Array.isArray(json.results)) throw new Error(`neon sql -> ${res.status}${json && typeof json.message === "string" ? `: ${say(json.message)}` : ""}`);
  return json.results;
}
const countOf = (result) => {
  const n = result && Array.isArray(result.rows) && result.rows[0] ? Number(result.rows[0].n) : NaN;
  if (!Number.isSafeInteger(n)) throw new Error("neon sql answered without a count");
  return n;
};

// The project launch made for this slot: found by its tag-derived name across every page; another of that name that
// the token can see but launch did not record is refused, never adopted.
function nameOf(ctx) {
  if (typeof ctx.tag !== "string" || !ctx.tag) throw refuse("BAD_TAG", "the slot has no resource tag");
  const slug = String((ctx.profile && ctx.profile.slug) || "");
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug)) throw refuse("BAD_SLUG", "the venture slug is not a Neon project name");
  return `arc-launch-${slug}`;
}

async function findProject(ctx, name) {
  const hits = [];
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const r = await neon(ctx, "GET", `/projects?limit=100&search=${encodeURIComponent(name)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!r.body || !Array.isArray(r.body.projects)) throw new Error("neon answered the project list without a projects array; nothing was created");
    hits.push(...list(r.body.projects).filter((p) => p.name === name));
    cursor = r.body.pagination && typeof r.body.pagination.cursor === "string" ? r.body.pagination.cursor : "";
    if (!cursor || r.body.projects.length < 100) break;
  }
  return hits;
}

export function envContract() {
  return ["NEON_API_KEY"];
}

export async function scaffold(ctx) {
  const name = nameOf(ctx);
  const recorded = ctx.resources.filter((r) => r.kind === "neon-project").map((r) => r.id);
  const hits = await findProject(ctx, name);
  if (hits.length > 1) throw refuse("NEON_AMBIGUOUS", `${hits.length} Neon projects are named ${name}`);
  let id = hits[0] && typeof hits[0].id === "string" ? hits[0].id : "";
  if (id && !recorded.includes(id) && recorded.length) throw refuse("FOREIGN_PROJECT", `a Neon project named ${name} exists that launch did not record`);
  if (!id) {
    const region = REGION[ctx.profile && ctx.profile.region] || REGION.any;
    const made = await neon(ctx, "POST", "/projects", { project: { name, region_id: region } });
    id = made.body && made.body.project && typeof made.body.project.id === "string" ? made.body.project.id : "";
    if (!PROJECT_ID.test(id)) throw new Error("neon returned no usable project id");
  }
  if (!PROJECT_ID.test(id)) throw new Error("neon listed a project without a usable id");
  ctx.report({ kind: "neon-project", id });
  await sql(ctx, await connection(ctx, id), MIGRATION);
  return { files: [], resources: [{ kind: "neon-project", id }], notes: [] };
}

async function probe(ctx) {
  const rec = ctx.resources.filter((r) => r.kind === "neon-project");
  if (rec.length !== 1 || !PROJECT_ID.test(rec[0].id)) return { ok: false, reason: `state records ${rec.length} usable neon-project resources; verify needs exactly one` };
  const id = rec[0].id;
  const got = await neon(ctx, "GET", `/projects/${id}`, undefined, [404]);
  if (got.status === 404) return { ok: false, reason: `neon has no project ${id} for this key` };
  if (!got.body || !got.body.project || got.body.project.name !== nameOf(ctx)) return { ok: false, reason: `neon project ${id} is not named ${nameOf(ctx)}` };
  const conn = await connection(ctx, id);
  const [rls, owner] = await sql(ctx, conn, [
    "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = 'launch_probe' and rowsecurity",
    "select count(*)::int as n from public.launch_probe",
  ]);
  if (countOf(rls) !== 1) return { ok: false, reason: "launch_probe is missing or does not have row level security on" };
  if (countOf(owner) !== 1) return { ok: false, reason: `the owner reads ${countOf(owner)} rows of launch_probe, not 1` };
  const anon = await sql(ctx, conn, ["set local role launch_anon", "select count(*)::int as n from public.launch_probe"]);
  if (countOf(anon[1]) !== 0) return { ok: false, reason: `launch_anon reads ${countOf(anon[1])} rows; RLS must deny without a policy` };
  return { ok: true, answerer: `console.neon.tech + ${conn.host}`, evidence: { project: id, rls: true, owner_rows: 1, anon_rows: 0 } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the Neon API and the project's SQL endpoint; never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The project and everything in it go with the exit plan; Neon deletes a project in one call.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "neon-project").map((r, i) => ({ order: i + 1, action: "delete the Neon project (export first)", resource: say(r.id, 60) })) };
}
