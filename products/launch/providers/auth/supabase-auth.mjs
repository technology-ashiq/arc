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

// auth slot on Supabase Auth (ADR-1704, ADR-1734): email magic links, a cookie session through @supabase/ssr, and the
// four routes a person and the probe both use. Generated venture code lives in single-quoted strings below, so the
// adapter scanner reads it as text, never as this adapter's own capabilities.
const ENV_NAMES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const TEMPLATE = '<h2>Log in</h2><p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Log in to {{ .SiteURL }}</a></p>';
const FILES = {
  "lib/supabase/server.js": [
    '// Supabase on the server, from the request cookies (arc launch, auth slot).',
    'import { cookies } from "next/headers";',
    'import { createServerClient } from "@supabase/ssr";',
    '',
    'export async function supabase() {',
    '  const store = await cookies();',
    '  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {',
    '    cookies: {',
    '      getAll: () => store.getAll(),',
    '      setAll: (list) => { for (const c of list) store.set(c.name, c.value, c.options); },',
    '    },',
    '  });',
    '}',
    '',
  ].join("\n"),
  "app/auth/confirm/route.js": [
    '// The magic link lands here: the token hash becomes a session cookie (arc launch, auth slot).',
    'import { NextResponse } from "next/server";',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export async function GET(request) {',
    '  const url = new URL(request.url);',
    '  const token_hash = url.searchParams.get("token_hash");',
    '  const type = url.searchParams.get("type");',
    '  if (!token_hash || type !== "magiclink") return NextResponse.json({ error: "bad link" }, { status: 400 });',
    '  const db = await supabase();',
    '  const { error } = await db.auth.verifyOtp({ token_hash, type });',
    '  if (error) return NextResponse.json({ error: "link expired or used" }, { status: 401 });',
    '  return NextResponse.redirect(new URL("/", url.origin), 303);',
    '}',
    '',
  ].join("\n"),
  "app/api/me/route.js": [
    '// Who is signed in, or 401 (arc launch, auth slot).',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export const dynamic = "force-dynamic";',
    '',
    'export async function GET() {',
    '  const db = await supabase();',
    '  const { data, error } = await db.auth.getUser();',
    '  if (error || !data.user) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  return Response.json({ id: data.user.id, email: data.user.email });',
    '}',
    '',
  ].join("\n"),
  "app/api/logout/route.js": [
    '// Ends the session and clears its cookies (arc launch, auth slot).',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export async function POST() {',
    '  const db = await supabase();',
    '  await db.auth.signOut();',
    '  return Response.json({ ok: true });',
    '}',
    '',
  ].join("\n"),
  "app/api/login/route.js": [
    '// Sends the magic link to an email address (arc launch, auth slot).',
    'import { supabase } from "../../../lib/supabase/server.js";',
    '',
    'export async function POST(request) {',
    '  const body = await request.json().catch(() => ({}));',
    '  const email = typeof body.email === "string" ? body.email.trim() : "";',
    '  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return Response.json({ error: "an email address" }, { status: 400 });',
    '  const db = await supabase();',
    '  const { error } = await db.auth.signInWithOtp({ email });',
    '  if (error) return Response.json({ error: "could not send the link" }, { status: 502 });',
    '  return Response.json({ sent: true });',
    '}',
    '',
  ].join("\n"),
};

// Upstream: the shell's repo (frontend) and the project (database). Read there, validated, re-reported for the slots
// after this one, which see only their direct dependency (ADR-1734).
function upstreamOf(ctx) {
  const shells = list(ctx.upstream && ctx.upstream.frontend).filter((r) => r.kind === "frontend-shell");
  const full = shells.length ? String(shells[shells.length - 1].id).split(":")[0] : "";
  if (!repoShape(full)) throw refuse("UPSTREAM_MISSING", "frontend reported no shell repo; the auth routes are written beside it");
  const projects = list(ctx.upstream && ctx.upstream.database).filter((r) => r.kind === "supabase-project" || r.kind === "supabase-project-found");
  if (projects.length !== 1 || !REF.test(String(projects[0].id))) throw refuse("UPSTREAM_MISSING", "database reported no single Supabase project");
  return { full, ref: String(projects[0].id) };
}

export function envContract() {
  return ["SUPABASE_ACCESS_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const { full, ref } = upstreamOf(ctx);
  const domain = domainOf(ctx);
  const site = `https://${domain}`;
  // The project's site URL is the owner's if it already points at another site; Supabase's localhost value is not.
  const conf = (await sb(ctx, "GET", `/projects/${ref}/config/auth`)).body || {};
  const now = typeof conf.site_url === "string" ? conf.site_url.replace(/\/$/, "") : "";
  if (now && now !== site && !/^http:\/\/localhost(:\d+)?$/.test(now)) throw refuse("SITE_URL_FOREIGN", `the project's site URL is ${say(now, 80)}; launch does not repoint it`);
  await sb(ctx, "PATCH", `/projects/${ref}/config/auth`, { site_url: site, uri_allow_list: `${site}/**`, mailer_subjects_magic_link: "Your login link", mailer_templates_magic_link_content: TEMPLATE });
  ctx.report({ kind: "auth-config", id: `${ref}:site_url=${site}` });
  // .env.example is shared (ADR-1729): this slot adds its names, never a value, and never removes a line.
  const sha = await commitFiles(ctx, full, FILES, {
    ".env.example": (text) => {
      const have = new Set(text.split("\n").map((l) => l.split("=")[0].trim()));
      const add = ENV_NAMES.filter((n) => !have.has(n)).map((n) => `${n}=`);
      return add.length ? `${text}${text && !text.endsWith("\n") ? "\n" : ""}${add.join("\n")}\n` : text;
    },
  }, "auth: magic-link login, session cookie, logout (ADR-1734)");
  ctx.report({ kind: "auth-routes", id: `${full}:${sha}` });
  ctx.report({ kind: "venture-repo", id: full });
  ctx.report({ kind: "supabase-ref", id: ref });
  return { files: Object.keys(FILES), resources: [{ kind: "auth-routes", id: `${full}:${sha}` }, { kind: "venture-repo", id: full }, { kind: "supabase-ref", id: ref }], notes: [] };
}

// Asked of the live app as a browser: a minted link signs in, /api/me knows the user, logout clears it, /api/me is 401.
async function probe(ctx) {
  const { full, ref } = upstreamOf(ctx);
  const domain = domainOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const key = await serviceKey(ctx, ref);
  let a;
  for (let i = 0; i < 5; i++) {
    if (i) await wait(30000, ctx.signal);
    try { a = await signIn(ctx, domain, ref, key, "a"); break; } catch (e) { if (e && e.code === "ABORTED") throw e; if (i === 4) return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` }; }
  }
  const me = await page(ctx, domain, a.cookies, "GET", "/api/me");
  if (me.status !== 200 || !me.body || me.body.email !== a.email) return { ok: false, reason: `/api/me after login answered ${me.status}, not the signed-in user` };
  const out = await page(ctx, domain, a.cookies, "POST", "/api/logout");
  if (out.status !== 200) return { ok: false, reason: `/api/logout answered ${out.status}` };
  const after = await page(ctx, domain, a.cookies, "GET", "/api/me");
  if (after.status !== 401) return { ok: false, reason: `/api/me after logout answered ${after.status}, not 401` };
  return { ok: true, answerer: `${domain} + ${ref}.supabase.co`, evidence: { user: a.email, login: 303, me: 200, logout: 200, after: 401 } };
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

// The probe user goes; the routes are venture code and stay with the repo.
export async function teardown(ctx) {
  const steps = [{ action: "delete-probe-users (launch-probe-a/b/c)", resource: (ctx.resources.find((r) => r.kind === "supabase-ref") || {}).id || "unknown" }];
  return { steps: steps.map((s, i) => ({ order: i + 1, ...s })) };
}
