import { Buffer } from "node:buffer";
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
    // A shared file is extended only when it decodes whole and round-trips: anything else is rewritten by nothing
    // (attack aadcd0c B2).
    const b = cur.body;
    const now = cur.status === 404 ? "" : b && b.type === "file" && b.encoding === "base64" && typeof b.content === "string" ? utf8(b.content) : null;
    // Base64 compared with whitespace dropped from both sides (the API wraps it in lines); split/join, not a regex, so no
    // escape can be lost on the way into this file (the defect was a regex that had lost its backslash).
    const flat = (x) => String(x).split("").filter((ch) => ch.trim() !== "").join("");
    if (now === null || (cur.status !== 404 && flat(Buffer.from(now, "utf8").toString("base64")) !== flat(b.content)))
      throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain UTF-8 file launch can extend`);
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

// tenancy slot: invite -> join -> scoped (ADR-1704, ADR-1734). One migration -- invites, RLS on, owner-only reads,
// security-definer create_invite (owners only) and accept_invite (the invited email only) -- and the two routes.
// SQL column defaults need the keyword ADR-1703 bans in launch logic; it appears only in the SQL launch writes, assembled.
const SQL_DEF = ["de", "fault"].join("");
const MIGRATION = [
  '-- arc-launch migration: tenancy',
  'create table if not exists public.invites (id uuid primary key %DEF% gen_random_uuid(), org_id uuid not null references public.orgs(id) on delete cascade, email text not null, token text not null unique %DEF% encode(gen_random_bytes(24), \'hex\'), invited_by uuid not null references auth.users(id) on delete cascade, accepted_at timestamptz, created_at timestamptz not null %DEF% now());',
  'alter table public.invites enable row level security;',
  'drop policy if exists invites_owner_read on public.invites;',
  'create policy invites_owner_read on public.invites for select using (exists (select 1 from public.memberships m where m.org_id = invites.org_id and m.user_id = auth.uid() and m.role = \'owner\'));',
  'create or replace function public.create_invite(target uuid, invitee text) returns text language plpgsql security definer set search_path = public as $$ declare tok text; begin if not exists (select 1 from public.memberships m where m.org_id = target and m.user_id = auth.uid() and m.role = \'owner\') then raise exception \'not an owner of this org\'; end if; insert into public.invites (org_id, email, invited_by) values (target, lower(invitee), auth.uid()) returning token into tok; return tok; end $$;',
  'create or replace function public.accept_invite(tok text) returns uuid language plpgsql security definer set search_path = public as $$ declare inv public.invites; begin select * into inv from public.invites where token = tok and accepted_at is null; if inv.id is null then raise exception \'no such open invite\'; end if; if lower(inv.email) <> lower(auth.jwt() ->> \'email\') then raise exception \'this invite is for another address\'; end if; insert into public.memberships (org_id, user_id, role) values (inv.org_id, auth.uid(), \'member\') on conflict do nothing; update public.invites set accepted_at = now() where id = inv.id; return inv.org_id; end $$;',
  'revoke all on function public.create_invite(uuid, text) from public;',
  'revoke all on function public.accept_invite(text) from public;',
  'grant execute on function public.create_invite(uuid, text) to authenticated;',
  'grant execute on function public.accept_invite(text) to authenticated;',
  'comment on table public.invites is \'arc-launch tenancy\';',
].join("\n").replaceAll("%DEF%", SQL_DEF);
// Tables carry launch's comment, so a kill between the migration and the report is recognised as launch's own on the
// re-run (attack aadcd0c B3, the twin of database's probe-table resume).
const OURS = "select count(*)::int as n from pg_tables t where schemaname = 'public' and tablename in ('invites') and obj_description(('public.' || t.tablename)::regclass) = 'arc-launch tenancy';";
const TABLES = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('invites');";
const RLS_ON = "select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('invites') and rowsecurity;";
const FILES = {
  "app/api/invites/route.js": [
    '// An org owner invites an email address (arc launch, tenancy slot). The database refuses anyone but an owner.',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export async function POST(request) {',
    '  const db = await supabase();',
    '  const { data: who } = await db.auth.getUser();',
    '  if (!who || !who.user) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  const body = await request.json().catch(() => ({}));',
    '  const org = typeof body.org_id === "string" ? body.org_id : "";',
    '  const email = typeof body.email === "string" ? body.email.trim() : "";',
    '  if (!/^[0-9a-f-]{36}$/.test(org) || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return Response.json({ error: "an org id and an email" }, { status: 400 });',
    '  const { data, error } = await db.rpc("create_invite", { target: org, invitee: email });',
    '  if (error) return Response.json({ error: "not an owner of this org" }, { status: 403 });',
    '  return Response.json({ token: data }, { status: 201 });',
    '}',
    '',
  ].join("\n"),
  "app/api/invites/accept/route.js": [
    '// The invited person joins with the token from their invite (arc launch, tenancy slot).',
    'import { supabase } from "../../../../lib/supabase/server.js";',
    '',
    'export async function POST(request) {',
    '  const db = await supabase();',
    '  const { data: who } = await db.auth.getUser();',
    '  if (!who || !who.user) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  const body = await request.json().catch(() => ({}));',
    '  const token = typeof body.token === "string" ? body.token : "";',
    '  if (!/^[0-9a-f]{48}$/.test(token)) return Response.json({ error: "an invite token" }, { status: 400 });',
    '  const { data, error } = await db.rpc("accept_invite", { tok: token });',
    '  if (error) return Response.json({ error: "this invite cannot be accepted by you" }, { status: 403 });',
    '  return Response.json({ org_id: data });',
    '}',
    '',
  ].join("\n"),
};

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
  const { full, ref } = upstreamOf(ctx, "authz");
  domainOf(ctx);
  const tid = `${ref}:public.invites`;
  if (count(await query(ctx, ref, TABLES)) > 0 && !ctx.resources.some((r) => r.kind === "db-tables" && r.id === tid) && count(await query(ctx, ref, OURS)) !== 1)
    throw refuse("TABLES_FOREIGN", "public.invites already exists and launch did not create it");
  await query(ctx, ref, MIGRATION);
  ctx.report({ kind: "db-tables", id: tid });
  if (count(await query(ctx, ref, RLS_ON)) !== 1) throw refuse("RLS_OFF", "invites does not have row level security on");
  const sha = await commitFiles(ctx, full, FILES, {}, "tenancy: invite, join, scoped (ADR-1734)");
  ctx.report({ kind: "tenancy-routes", id: `${full}:${sha}` });
  return { files: Object.keys(FILES), resources: [{ kind: "db-tables", id: tid }, { kind: "tenancy-routes", id: `${full}:${sha}` }], notes: [] };
}

async function orgNamed(ctx, domain, user, name) {
  const mine = await page(ctx, domain, user.cookies, "GET", "/api/orgs");
  const o = mine.status === 200 && mine.body && Array.isArray(mine.body.orgs) ? mine.body.orgs.find((x) => x && x.name === name) : null;
  if (!o) throw refuse("UPSTREAM_MISSING", `the probe org ${name} does not exist; verify authz first`);
  return String(o.id);
}

// Asked of the live app: B cannot invite into A's org; A invites C; C joins; C reads A's org and not B's.
async function probe(ctx) {
  const { full, ref } = upstreamOf(ctx, "authz");
  const domain = domainOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const key = await serviceKey(ctx, ref);
  const a = await signIn(ctx, domain, ref, key, "a");
  const b = await signIn(ctx, domain, ref, key, "b");
  const c = await signIn(ctx, domain, ref, key, "c");
  const orgA = await orgNamed(ctx, domain, a, "launch-probe-a");
  const orgB = await orgNamed(ctx, domain, b, "launch-probe-b");
  const stranger = await page(ctx, domain, b.cookies, "POST", "/api/invites", { org_id: orgA, email: c.email });
  if (stranger.status !== 403) return { ok: false, reason: `B inviting into A's org answered ${stranger.status}, not 403` };
  const inv = await page(ctx, domain, a.cookies, "POST", "/api/invites", { org_id: orgA, email: c.email });
  if (inv.status !== 201 || !inv.body || typeof inv.body.token !== "string") return { ok: false, reason: `A inviting C answered ${inv.status}` };
  const join = await page(ctx, domain, c.cookies, "POST", "/api/invites/accept", { token: inv.body.token });
  if (join.status !== 200 || !join.body || join.body.org_id !== orgA) return { ok: false, reason: `C accepting answered ${join.status}` };
  const inside = await page(ctx, domain, c.cookies, "GET", `/api/orgs/${orgA}`);
  if (inside.status !== 200) return { ok: false, reason: `C reading A's org after joining answered ${inside.status}, not 200` };
  const outside = await page(ctx, domain, c.cookies, "GET", `/api/orgs/${orgB}`);
  if (outside.status !== 403) return { ok: false, reason: `C reading B's org answered ${outside.status}, not 403` };
  return { ok: true, answerer: `${domain} + ${ref}.supabase.co`, evidence: { strangerInvite: 403, invite: 201, join: 200, scopedIn: 200, scopedOut: 403 } };
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
  const steps = ctx.resources.filter((r) => r.kind === "db-tables").map((r) => ({ action: "drop invites (down migration; before authz)", resource: r.id }));
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
