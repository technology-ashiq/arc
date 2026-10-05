// database slot on Supabase (ADR-1704, ADR-1731). One project per venture slug in the token's only organization. The
// database password is generated, used once at creation and recorded nowhere. One migration creates `launch_probe` with
// RLS on and no policy, holding one owner-written row; verify proves RLS by reading it as `anon` (0 rows) and as the
// owner role (1 row), both through the Management API's query endpoint.
import { randomBytes } from "node:crypto";

const API = "https://api.supabase.com/v1";
const REGION = { in: "ap-south-1", us: "us-east-1", eu: "eu-central-1", any: "us-east-1" };
const UP = [
  "create table if not exists public.launch_probe (id int primary key, note text not null);",
  "alter table public.launch_probe enable row level security;",
  "insert into public.launch_probe (id, note) values (1, 'owner-only') on conflict (id) do nothing;",
].join("\n");
// The query endpoint answers with the LAST statement's rows, so the select is last and the transaction is left to end
// with the request (a trailing commit would answer with no rows, attack cc949ef B4).
const AS_ANON = "begin; set local role anon; select count(*)::int as n from public.launch_probe;";
const EXISTS = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = 'launch_probe';";
const AS_OWNER = "select count(*)::int as n from public.launch_probe;";
const POLICIES = "select count(*)::int as n from pg_policies where schemaname = 'public' and tablename = 'launch_probe';";

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const REF = /^[a-z0-9]{20}$/;

function tokenOf(ctx) {
  const t = String(ctx.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!/^sbp_[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "SUPABASE_ACCESS_TOKEN is not a token shape (sbp_...); its value is not printed");
  return t;
}

// The request body is never echoed into an error: a create body holds the generated password.
async function sb(ctx, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${tokenOf(ctx)}`, "content-type": "application/json", "user-agent": "arc-launch" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`supabase ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json };
  const msg = json && typeof json === "object" && typeof json.message === "string" ? `: ${say(json.message)}` : "";
  throw new Error(`supabase ${method} ${path.split("?")[0]} -> ${res.status}${msg}`);
}

async function query(ctx, ref, sql) {
  const r = await sb(ctx, "POST", `/projects/${ref}/database/query`, { query: sql });
  const rows = Array.isArray(r.body) ? r.body : null;
  if (!rows) throw new Error("supabase database/query answered without a rows array");
  return rows;
}
const count = (rows) => {
  const n = rows.length ? rows[rows.length - 1].n : undefined;
  if (typeof n !== "number") throw new Error("supabase database/query answered without a count");
  return n;
};

function slugOf(ctx) {
  const s = String((ctx.profile && ctx.profile.slug) || "");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(s)) throw refuse("BAD_SLUG", `venture slug ${JSON.stringify(say(s, 40))} is not a project name`);
  return s;
}

// The organization is the token's only one: several are refused by name, never picked between.
async function org(ctx) {
  const orgs = list((await sb(ctx, "GET", "/organizations")).body);
  if (orgs.length !== 1) throw refuse("ORG_AMBIGUOUS", `the token sees ${orgs.length} organizations (${orgs.slice(0, 5).map((o) => say(o.name, 40)).join(", ")}); one is required`);
  if (typeof orgs[0].id !== "string") throw new Error("supabase returned an organization without an id");
  return orgs[0].id;
}

async function find(ctx, name) {
  const all = list((await sb(ctx, "GET", "/projects")).body);
  return all.filter((p) => p.name === name);
}

export function envContract() {
  return ["SUPABASE_ACCESS_TOKEN"];
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Bounded at 7 minutes, under the runner's 10-minute stale-lock window: a slower project start is a failed attempt the
// next apply resumes (the project is already this slot's resource), never a held lock (attack cc949ef B1).
async function healthy(ctx, ref) {
  for (let i = 0; i < 14; i++) {
    if (i) await wait(30000, ctx.signal);
    const p = await sb(ctx, "GET", `/projects/${ref}`);
    const st = say(p.body && p.body.status, 30);
    if (st === "ACTIVE_HEALTHY") return;
    if (/^(INACTIVE|PAUSED|REMOVED|INIT_FAILED|GOING_DOWN)$/.test(st)) throw refuse("PROJECT_DOWN", `supabase project ${ref} is ${st}`);
  }
  throw refuse("PROJECT_NOT_READY", `supabase project ${ref} is not healthy after 7 minutes; apply again to resume`);
}

export async function scaffold(ctx) {
  const name = slugOf(ctx);
  const region = REGION[String((ctx.profile && ctx.profile.region) || "any")];
  if (!region) throw refuse("BAD_REGION", `profile.region ${JSON.stringify(say(ctx.profile && ctx.profile.region, 20))} has no Supabase region`);

  const have = await find(ctx, name);
  if (have.length > 1) throw refuse("PROJECT_AMBIGUOUS", `${have.length} supabase projects are named ${name}`);
  let ref, kind;
  if (have.length === 1) {
    ref = String(have[0].id || have[0].ref || "");
    // One this slot created on an earlier attempt stays its own; any other is the owner's (no marker exists, ADR-1731).
    kind = ctx.resources.some((r) => r.kind === "supabase-project" && r.id === ref) ? "supabase-project" : "supabase-project-found";
  } else {
    const organization_id = await org(ctx);
    // Used once, here, and recorded nowhere (ADR-1731). 32 random bytes as hex.
    const db_pass = randomBytes(32).toString("hex");
    const made = await sb(ctx, "POST", "/projects", { name, organization_id, region, db_pass });
    ref = String((made.body && (made.body.id || made.body.ref)) || "");
    kind = "supabase-project";
  }
  if (!REF.test(ref)) throw new Error(`supabase returned no usable project ref for ${name}`);
  ctx.report({ kind, id: ref });

  await healthy(ctx, ref);
  // A launch_probe table launch did not create is the owner's: it is never altered or written to (attack cc949ef B3).
  const tid = `${ref}:public.launch_probe`;
  const exists = count(await query(ctx, ref, EXISTS)) === 1;
  if (exists && !ctx.resources.some((r) => r.kind === "db-probe-table" && r.id === tid))
    throw refuse("PROBE_TABLE_FOREIGN", "public.launch_probe already exists and launch did not create it; it is not touched");
  await query(ctx, ref, UP);
  // Recorded the moment it exists, before the policy check that may refuse (attack cc949ef B2).
  ctx.report({ kind: "db-probe-table", id: tid });
  // A policy someone added would make the anon read succeed by design; the probe table must have none.
  if (count(await query(ctx, ref, POLICIES)) !== 0) throw refuse("PROBE_HAS_POLICY", "public.launch_probe has a policy; the RLS probe needs none");
  return { files: [], resources: [{ kind, id: ref }, { kind: "db-probe-table", id: `${ref}:public.launch_probe` }], notes: [] };
}

async function probe(ctx) {
  const name = slugOf(ctx);
  const have = await find(ctx, name);
  if (have.length !== 1) return { ok: false, reason: `${have.length} supabase projects named ${name}; verify needs exactly one` };
  const ref = String(have[0].id || have[0].ref || "");
  if (!REF.test(ref)) return { ok: false, reason: "supabase returned no usable project ref" };
  const p = await sb(ctx, "GET", `/projects/${ref}`);
  const st = say(p.body && p.body.status, 30);
  if (st === "INACTIVE" || st === "PAUSED") return { ok: false, reason: `PAUSED(supabase project ${ref} is ${st})` };
  if (st !== "ACTIVE_HEALTHY") return { ok: false, reason: `supabase project ${ref} is ${st || "unknown"}` };
  const owner = count(await query(ctx, ref, AS_OWNER));
  const anon = count(await query(ctx, ref, AS_ANON));
  if (owner < 1) return { ok: false, reason: "the owner role sees no probe row; the probe cannot tell denial from emptiness" };
  if (anon !== 0) return { ok: false, reason: `anon reads ${anon} probe row(s): RLS is not denying` };
  return { ok: true, answerer: "api.supabase.com", evidence: { project: ref, ownerRows: owner, anonRows: anon } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.supabase.com; the probe is the database, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The down migration first, then the project if launch made it; a found project is the owner's and stays.
export async function teardown(ctx) {
  const steps = [];
  for (const r of ctx.resources) {
    if (r.kind === "db-probe-table") steps.push({ action: "drop-table (down migration)", resource: r.id });
  }
  for (const r of ctx.resources) if (r.kind === "supabase-project") steps.push({ action: "pause-then-delete-project", resource: r.id });
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
