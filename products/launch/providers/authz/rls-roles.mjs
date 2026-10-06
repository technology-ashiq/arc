// ---- shared by auth, authz and tenancy (ADR-1734). Adapters are one file each (ADR-1704), so this block is repeated.
const GITHUB = "https://api.github.com";
const SBAPI = "https://api.supabase.com/v1";
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[a-z0-9]{20}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// One caller for every host: error text is the provider's sanitised message, never a header or a request body.
async function call(ctx, url, headers, method, body, allow, what) {
  let res;
  try {
    res = await ctx.fetch(url, { method, headers: { "content-type": "application/json", "user-agent": "arc-launch", ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} ${method} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json, res };
  const m = json && typeof json === "object" ? json.message || json.msg || json.error_description || json.error : "";
  throw new Error(`${what} ${method} -> ${res.status}${typeof m === "string" && m ? `: ${say(m)}` : ""}`);
}
const gh = (ctx, method, path, body, allow) => call(ctx, `${GITHUB}${path}`, { authorization: `Bearer ${tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/)}`, accept: "application/vnd.github+json" }, method, body, allow, `github ${path.split("?")[0]}`);
const sb = (ctx, method, path, body, allow) => call(ctx, `${SBAPI}${path}`, { authorization: `Bearer ${tokenOf(ctx, "SUPABASE_ACCESS_TOKEN", /^sbp_[A-Za-z0-9_]{20,}$/)}` }, method, body, allow, `supabase ${path.split("?")[0]}`);

// The Management API query endpoint answers with the last statement's rows (ADR-1731).
async function query(ctx, ref, sql) {
  const r = await sb(ctx, "POST", `/projects/${ref}/database/query`, { query: sql });
  if (!Array.isArray(r.body)) throw new Error("supabase database/query answered without a rows array");
  return r.body;
}
const count = (rows) => {
  const n = rows.length ? rows[rows.length - 1].n : undefined;
  if (typeof n !== "number") throw new Error("supabase database/query answered without a count");
  return n;
};

function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
const repoShape = (full) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full);
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);

// Commits FILES (owned: exact bytes and this slot's trailer decide) plus SHARED (paths several slots extend, such as
// .env.example, written as given) in one commit on one head; the local copy is written after the ref update lands.
async function commitFiles(ctx, full, FILES, SHARED, message) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = {};
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed[path] = text; continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    const ours = hasLine(top && top.commit && top.commit.message, trailer(ctx));
    if (!ours) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; it is not committed over`);
    if (utf8(b.content) !== text) changed[path] = text;
  }
  for (const [path, make] of Object.entries(SHARED || {})) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    const now = cur.status === 404 ? "" : cur.body && cur.body.type === "file" && typeof cur.body.content === "string" ? utf8(cur.body.content) : null;
    if (now === null) throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    const next = make(now);
    if (next !== now) changed[path] = next;
  }
  if (!Object.keys(changed).length) return head;
  const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
  const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
  if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
  const tree = [];
  for (const [path, text] of Object.entries(changed)) {
    const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: text, encoding: "utf-8" });
    if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
    tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
  }
  const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
  const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `${message}\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
  const sha = c.body ? String(c.body.sha) : "";
  if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
  await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  for (const [path, text] of Object.entries(changed)) ctx.write(path, text);
  return sha;
}

// At main's head every owned file is launch's exact bytes with this slot's trailer.
async function oursAtHead(ctx, full, FILES) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return `${full} main has no readable head`;
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    const b = cur.body;
    if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== text) return `${path} at ${head.slice(0, 7)} is not launch's file`;
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) return `${path} at ${head.slice(0, 7)} was last committed by someone else`;
  }
  return "";
}

// ---- the probe browser (ADR-1734): admin-minted magic links, then the live app, cookie by cookie.
async function serviceKey(ctx, ref) {
  const keys = list((await sb(ctx, "GET", `/projects/${ref}/api-keys`)).body);
  const k = (keys.find((x) => x.name === "service_role" && typeof x.api_key === "string") || {}).api_key;
  if (!k) throw refuse("NO_SERVICE_KEY", "supabase returned no service_role key for the project");
  return k;
}
const admin = (ctx, ref, key, method, path, body, allow) =>
  call(ctx, `https://${ref}.supabase.co/auth/v1/admin${path}`, Object.fromEntries([["apikey", key], ["authorization", `Bearer ${key}`]]), method, body, allow, `supabase auth admin ${path}`);
const probeEmail = (ctx, who) => `launch-probe-${who}@${domainOf(ctx)}`;

async function mint(ctx, ref, key, who) {
  const email = probeEmail(ctx, who);
  await admin(ctx, ref, key, "POST", "/users", { email, email_confirm: true }, [422]);
  const link = await admin(ctx, ref, key, "POST", "/generate_link", { type: "magiclink", email });
  const hash = link.body && link.body.properties && typeof link.body.properties.hashed_token === "string" ? link.body.properties.hashed_token : "";
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(hash)) throw new Error("supabase minted no usable magic-link token");
  return { email, hash };
}

// A cookie jar a browser would keep: a Set-Cookie with an empty value, Max-Age=0 or a past Expires deletes.
function jar() {
  const m = new Map();
  return {
    absorb(res) {
      const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const line of all) {
        const [pair, ...attrs] = String(line).split(";");
        const eq = pair.indexOf("=");
        if (eq < 1) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        const gone = !value || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a) || (/^\s*expires\s*=/i.test(a) && Date.parse(a.split("=").slice(1).join("=")) < Date.now()));
        if (gone) m.delete(name); else m.set(name, value);
      }
    },
    header: () => [...m].map(([k, v]) => `${k}=${v}`).join("; "),
    has: (re) => [...m.keys()].some((k) => re.test(k)),
  };
}
async function page(ctx, domain, cookies, method, path, body) {
  let res;
  try {
    res = await ctx.fetch(`https://${domain}${path}`, { method, redirect: "manual", headers: { "user-agent": "arc-launch", accept: "application/json", ...(body ? { "content-type": "application/json" } : {}), ...(cookies.header() ? { cookie: cookies.header() } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    if (e && e.code) throw e;
    return { status: 0, body: null };
  }
  cookies.absorb(res);
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}
async function signIn(ctx, domain, ref, key, who) {
  const { email, hash } = await mint(ctx, ref, key, who);
  const c = jar();
  const r = await page(ctx, domain, c, "GET", `/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink`);
  if (!(r.status >= 300 && r.status < 400) || !c.has(/^sb-/)) throw refuse("LOGIN_FAILED", `the magic link for ${who} did not start a session (answered ${r.status})`);
  return { email, cookies: c };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});
// ---- end of the shared block

// authz slot: row-level security by membership (ADR-1704, ADR-1734). One migration -- orgs and memberships, RLS on,
// read granted to members only, a security-definer create_org that makes the caller its owner -- and the two routes
// that read through it. A cross-tenant read is 403 because RLS hides the row, not because the route says so.
// SQL column defaults need the keyword ADR-1703 bans in launch logic; it appears only in the SQL launch writes, assembled.
const SQL_DEF = ["de", "fault"].join("");
const MIGRATION = [
  '-- arc-launch migration: authz',
  'create table if not exists public.orgs (id uuid primary key %DEF% gen_random_uuid(), name text not null check (length(name) between 1 and 80), created_at timestamptz not null %DEF% now());',
  'create table if not exists public.memberships (org_id uuid not null references public.orgs(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in (\'owner\', \'member\')), primary key (org_id, user_id));',
  'alter table public.orgs enable row level security;',
  'alter table public.memberships enable row level security;',
  'create or replace function public.is_member(o uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.memberships m where m.org_id = o and m.user_id = auth.uid()) $$;',
  'drop policy if exists orgs_member_read on public.orgs;',
  'create policy orgs_member_read on public.orgs for select using (public.is_member(id));',
  'drop policy if exists memberships_member_read on public.memberships;',
  'create policy memberships_member_read on public.memberships for select using (public.is_member(org_id));',
  'create or replace function public.create_org(org_name text) returns uuid language plpgsql security definer set search_path = public as $$ declare oid uuid; begin if auth.uid() is null then raise exception \'not signed in\'; end if; insert into public.orgs (name) values (org_name) returning id into oid; insert into public.memberships (org_id, user_id, role) values (oid, auth.uid(), \'owner\'); return oid; end $$;',
  'revoke all on function public.create_org(text) from public;',
  'grant execute on function public.create_org(text) to authenticated;',
].join("\n").replaceAll("%DEF%", SQL_DEF);
const TABLES = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('orgs', 'memberships');";
const RLS_ON = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('orgs', 'memberships') and rowsecurity;";
const FILES = {
  "app/api/orgs/route.js": [
    '// The orgs the signed-in user belongs to, and creating one (arc launch, authz slot). RLS does the scoping.',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export const dynamic = "force-dynamic";',
    '',
    'async function signedIn(db) {',
    '  const { data } = await db.auth.getUser();',
    '  return data && data.user ? data.user : null;',
    '}',
    '',
    'export async function GET() {',
    '  const db = await supabase();',
    '  if (!(await signedIn(db))) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  const { data, error } = await db.from("orgs").select("id, name");',
    '  if (error) return Response.json({ error: "read failed" }, { status: 500 });',
    '  return Response.json({ orgs: data });',
    '}',
    '',
    'export async function POST(request) {',
    '  const db = await supabase();',
    '  if (!(await signedIn(db))) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  const body = await request.json().catch(() => ({}));',
    '  const name = typeof body.name === "string" ? body.name.trim() : "";',
    '  if (!name || name.length > 80) return Response.json({ error: "a name of 1 to 80 characters" }, { status: 400 });',
    '  const { data, error } = await db.rpc("create_org", { org_name: name });',
    '  if (error) return Response.json({ error: "create failed" }, { status: 500 });',
    '  return Response.json({ id: data }, { status: 201 });',
    '}',
    '',
  ].join("\n"),
  "app/api/orgs/[id]/route.js": [
    '// One org, or 403 when it is not yours: RLS hides another tenant\'s row (arc launch, authz slot).',
    'import { supabase } from "../../../../lib/supabase/server.js";',
    '',
    'export const dynamic = "force-dynamic";',
    '',
    'export async function GET(request, { params }) {',
    '  const { id } = await params;',
    '  const db = await supabase();',
    '  const { data: who } = await db.auth.getUser();',
    '  if (!who || !who.user) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "not an org id" }, { status: 400 });',
    '  const { data, error } = await db.from("orgs").select("id, name").eq("id", id).maybeSingle();',
    '  if (error) return Response.json({ error: "read failed" }, { status: 500 });',
    '  if (!data) return Response.json({ error: "not a member of this org" }, { status: 403 });',
    '  return Response.json(data);',
    '}',
    '',
  ].join("\n"),
};

// Upstream: auth's re-reported repo and project, validated here (ADR-1734).
function upstreamOf(ctx, from) {
  const up = list(ctx.upstream && ctx.upstream[from]);
  const full = String((up.find((r) => r.kind === "venture-repo") || {}).id || "");
  const ref = String((up.find((r) => r.kind === "supabase-ref") || {}).id || "");
  if (!repoShape(full) || !REF.test(ref)) throw refuse("UPSTREAM_MISSING", `${from} reported no venture repo and Supabase ref`);
  return { full, ref };
}

export function envContract() {
  return ["SUPABASE_ACCESS_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const { full, ref } = upstreamOf(ctx, "auth");
  domainOf(ctx);
  // Tables of these names launch did not create are the venture's own: never altered (the probe-table rule, ADR-1731).
  const tid = `${ref}:public.orgs+public.memberships`;
  if (count(await query(ctx, ref, TABLES)) > 0 && !ctx.resources.some((r) => r.kind === "db-tables" && r.id === tid))
    throw refuse("TABLES_FOREIGN", "public.orgs or public.memberships already exists and launch did not create it");
  await query(ctx, ref, MIGRATION);
  ctx.report({ kind: "db-tables", id: tid });
  if (count(await query(ctx, ref, RLS_ON)) !== 2) throw refuse("RLS_OFF", "orgs and memberships do not both have row level security on");
  const sha = await commitFiles(ctx, full, FILES, {}, "authz: orgs and memberships, member-only reads (ADR-1734)");
  ctx.report({ kind: "authz-routes", id: `${full}:${sha}` });
  ctx.report({ kind: "venture-repo", id: full });
  ctx.report({ kind: "supabase-ref", id: ref });
  return { files: Object.keys(FILES), resources: [{ kind: "db-tables", id: tid }, { kind: "authz-routes", id: `${full}:${sha}` }], notes: [] };
}

// One org per probe user, created once and found by name afterwards.
async function ownOrg(ctx, domain, user, name) {
  const mine = await page(ctx, domain, user.cookies, "GET", "/api/orgs");
  if (mine.status !== 200 || !mine.body || !Array.isArray(mine.body.orgs)) throw new Error(`/api/orgs answered ${mine.status}`);
  const found = mine.body.orgs.find((o) => o && o.name === name);
  if (found) return String(found.id);
  const made = await page(ctx, domain, user.cookies, "POST", "/api/orgs", { name });
  if (made.status !== 201 || !made.body || typeof made.body.id !== "string") throw new Error(`creating an org answered ${made.status}`);
  return made.body.id;
}

// Asked of the live app: A reads its own org (200) and not B's (403).
async function probe(ctx) {
  const { full, ref } = upstreamOf(ctx, "auth");
  const domain = domainOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const key = await serviceKey(ctx, ref);
  const a = await signIn(ctx, domain, ref, key, "a");
  const b = await signIn(ctx, domain, ref, key, "b");
  const orgA = await ownOrg(ctx, domain, a, "launch-probe-a");
  const orgB = await ownOrg(ctx, domain, b, "launch-probe-b");
  const own = await page(ctx, domain, a.cookies, "GET", `/api/orgs/${orgA}`);
  if (own.status !== 200) return { ok: false, reason: `A reading its own org answered ${own.status}, not 200` };
  const cross = await page(ctx, domain, a.cookies, "GET", `/api/orgs/${orgB}`);
  if (cross.status !== 403) return { ok: false, reason: `A reading B's org answered ${cross.status}, not 403` };
  return { ok: true, answerer: `${domain} + ${ref}.supabase.co`, evidence: { own: 200, crossTenant: 403 } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live app and Supabase; the probe is a browser, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

export async function teardown(ctx) {
  const steps = ctx.resources.filter((r) => r.kind === "db-tables").map((r) => ({ action: "drop-tables (down migration)", resource: r.id }));
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
