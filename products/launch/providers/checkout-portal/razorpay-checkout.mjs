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
  // The newest commit of launch's own that an unchanged file came from: the id a no-op run reports, never main's head,
  // which may be the owner's later commit (attack b1844e0 B1).
  let mine = "";
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
    else if (!mine && SHA.test(String(top.sha))) mine = String(top.sha);
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
  if (!Object.keys(changed).length) {
    if (!SHA.test(mine)) throw new Error(`github named no commit of launch's for the files in ${full}`);
    return mine;
  }
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

// checkout-portal slot on Razorpay Checkout, test mode (ADR-1704, ADR-1738). The venture's server creates the order with
// the secret key and hands the browser only the order id and the public key id. verify asks the live app for a checkout
// as probe user A and reads that order back from Razorpay: proven up to payment entry. The payment itself is proven by
// webhooks-ledger from Razorpay's own event. A live key refuses before any call here, and the venture's route answers
// 503 to one: gate 3 is never crossed (ADR-1720).
const EXPORT_D = `export ${["de", "fault"].join("")}`;
const RZ = "https://api.razorpay.com/v1";
const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";
const PAGE_MAX = 1024 * 1024;

// The page loads checkout.js only through a script tag whose src is exactly it; the URL in a comment or in text does
// not count (attack b1844e0 B6). Plain string search: no regex escape can be lost on the way into this file.
function loadsCheckout(text) {
  const lower = String(text).toLowerCase();
  let at = lower.indexOf("<script");
  while (at >= 0) {
    const end = lower.indexOf(">", at);
    if (end < 0) return false;
    const tag = lower.slice(at, end);
    if (tag.includes(`src="${CHECKOUT_JS}"`) && !lower.slice(0, at).includes("<!--", lower.slice(0, at).lastIndexOf("-->") + 1)) return true;
    at = lower.indexOf("<script", end);
  }
  return false;
}

// A body read to at most `max` bytes: a page that is huge or never ends reads as empty, never as a hang (attack
// b1844e0 B6).
async function capped(res, max) {
  if (!res.body || typeof res.body.getReader !== "function") return "";
  const reader = res.body.getReader();
  const parts = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.byteLength;
      if (n > max) { await reader.cancel().catch(() => {}); return ""; }
      parts.push(Buffer.from(value));
    }
  } catch { return ""; }
  return Buffer.concat(parts).toString("utf8");
}

// .env.example is shared (ADR-1729): names are added, never a value, never a line removed. `export NAME=` and
// ` NAME = ` name the same variable, and added lines keep the file's own line ending (attack b1844e0 B4).
function envNamesAdded(text, names) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const nameOf = (l) => { const k = l.split("=")[0].trim(); return k.startsWith("export ") ? k.slice(7).trim() : k; };
  const have = new Set(text.split("\n").map(nameOf));
  const add = names.filter((n) => !have.has(n)).map((n) => `${n}=`);
  return add.length ? `${text}${text && !text.endsWith("\n") ? eol : ""}${add.join(eol)}${eol}` : text;
}

const AMOUNT = 49900;
const CURRENCY = "INR";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ORDER = /^order_[A-Za-z0-9]{6,40}$/;
const ENV_NAMES = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
// The venture files hold no backslash, so no escape can be lost on the way into them (attack 6a5c24e B1), and every
// line is a quoted string, so the code inside them is never read as this adapter's own.
const FILES = {
  "lib/prices.js": [
    '// The paid plan and its price, in paise (arc launch, checkout-portal slot). pro is the only paid plan.',
    'export const PRICES = Object.freeze({ pro: Object.freeze({ amount: 49900, currency: "INR" }) });',
    '',
  ].join("\n"),
  "app/api/checkout/route.js": [
    '// Creates the Razorpay order for an org on the server (arc launch, checkout-portal slot). The secret key never leaves',
    '// the server: the browser gets the order id and the public key id. A key id that is not a test key answers 503, so',
    '// a launch-built route never sells live.',
    'import { supabase } from "../../../lib/supabase/server.js";',
    'import { PRICES } from "../../../lib/prices.js";',
    '',
    'export const dynamic = "force-dynamic";',
    '',
    'const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;',
    '',
    'export async function POST(request) {',
    '  const db = await supabase();',
    '  const { data: who } = await db.auth.getUser();',
    '  if (!who || !who.user) return Response.json({ error: "not signed in" }, { status: 401 });',
    '  let body = null;',
    '  try { body = await request.json(); } catch { body = null; }',
    '  const org = body && typeof body.org === "string" ? body.org : "";',
    '  if (!UUID.test(org)) return Response.json({ error: "not an org id" }, { status: 400 });',
    '  const { data: mine, error } = await db.from("orgs").select("id").eq("id", org).maybeSingle();',
    '  if (error) return Response.json({ error: "read failed" }, { status: 500 });',
    '  if (!mine) return Response.json({ error: "not a member of this org" }, { status: 403 });',
    '  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();',
    '  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();',
    '  if (!keyId.startsWith("rzp_test_") || !keySecret) return Response.json({ error: "checkout is not available" }, { status: 503 });',
    '  const price = PRICES.pro;',
    '  let res;',
    '  try {',
    '    res = await fetch("https://api.razorpay.com/v1/orders", {',
    '      method: "POST",',
    '      headers: { authorization: "Basic " + btoa(keyId + ":" + keySecret), "content-type": "application/json" },',
    '      body: JSON.stringify({ amount: price.amount, currency: price.currency, receipt: "org-" + org, notes: { org_id: org, plan: "pro" } }),',
    '    });',
    '  } catch {',
    '    return Response.json({ error: "payment provider unreachable" }, { status: 502 });',
    '  }',
    '  const order = await res.json().catch(() => null);',
    '  if (!res.ok || !order || typeof order.id !== "string") return Response.json({ error: "order not created" }, { status: 502 });',
    '  return Response.json({ order_id: order.id, key_id: keyId, amount: order.amount, currency: order.currency }, { status: 201 });',
    '}',
    '',
  ].join("\n"),
  "app/checkout/page.js": [
    '"use client";',
    '// Opens Razorpay Checkout for the org in ?org= (arc launch, checkout-portal slot). /api/checkout makes the order on the',
    '// server; this page hands its answer to checkout.js and never sees the secret key.',
    'import { useState } from "react";',
    'import { PRICES } from "../../lib/prices.js";',
    '',
    `${EXPORT_D} function Checkout() {`,
    '  const [status, setStatus] = useState("idle");',
    '  const [message, setMessage] = useState("");',
    '',
    '  async function pay() {',
    '    setStatus("loading");',
    '    setMessage("");',
    '    try {',
    '      const org = new URLSearchParams(window.location.search).get("org") || "";',
    '      const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ org }) });',
    '      const body = await res.json().catch(() => null);',
    '      if (res.status !== 201 || !body) throw new Error((body && body.error) || "checkout answered " + res.status);',
    '      if (typeof window.Razorpay !== "function") throw new Error("checkout.js did not load");',
    '      const rz = new window.Razorpay({',
    '        key: body.key_id,',
    '        order_id: body.order_id,',
    '        amount: body.amount,',
    '        currency: body.currency,',
    '        name: "Pro plan",',
    '        handler: () => { setStatus("paid"); setMessage("Payment received. Your plan changes once it is confirmed."); },',
    '        modal: { ondismiss: () => setStatus("idle") },',
    '      });',
    '      rz.on("payment.failed", () => { setStatus("error"); setMessage("The payment did not go through."); });',
    '      rz.open();',
    '      setStatus("open");',
    '    } catch (e) {',
    '      setStatus("error");',
    '      setMessage(e && e.message ? e.message : "checkout failed");',
    '    }',
    '  }',
    '',
    '  return (',
    '    <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 24px" }}>',
    '      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>',
    '      <h1 style={{ fontSize: 28, margin: 0 }}>Upgrade to Pro</h1>',
    '      <p style={{ fontSize: 18 }}>{PRICES.pro.currency} {PRICES.pro.amount / 100}, one payment.</p>',
    '      <button type="button" onClick={pay} disabled={status === "loading" || status === "open"}>',
    '        {status === "loading" ? "Starting checkout..." : "Pay now"}',
    '      </button>',
    '      {message ? <p role="status">{message}</p> : null}',
    '    </main>',
    '  );',
    '}',
    '',
  ].join("\n"),
};

const addEnvNames = (text) => envNamesAdded(text, ENV_NAMES);

// Upstream: plans' re-reported repo and project, validated here (ADR-1738).
function upstreamOf(ctx, from) {
  const up = list(ctx.upstream && ctx.upstream[from]);
  const full = String((up.find((r) => r.kind === "venture-repo") || {}).id || "");
  const ref = String((up.find((r) => r.kind === "supabase-ref") || {}).id || "");
  if (!repoShape(full) || !REF.test(ref)) throw refuse("UPSTREAM_MISSING", `${from} reported no venture repo and Supabase ref`);
  return { full, ref };
}

// Shapes, never values: a live id is named as live, and nothing else about either key is printed (as payment-test).
function keys(ctx) {
  const id = String(ctx.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(ctx.env.RAZORPAY_KEY_SECRET || "").trim();
  if (/^rzp_live_/.test(id)) throw refuse("LIVE_KEY", "RAZORPAY_KEY_ID is a live key; checkout-portal runs on test keys only (gate 3 is never crossed here, ADR-1720)");
  if (!/^rzp_test_[A-Za-z0-9]{14}$/.test(id)) throw refuse("BAD_TOKEN", "RAZORPAY_KEY_ID is not a test key shape (rzp_test_ and 14 letters or digits); its value is not printed");
  if (!/^[A-Za-z0-9]{16,64}$/.test(keySecret)) throw refuse("BAD_TOKEN", "RAZORPAY_KEY_SECRET is not a key shape (16 to 64 letters or digits); its value is not printed");
  return { id, basic: Buffer.from(`${id}:${keySecret}`, "utf8").toString("base64") };
}

async function rz(ctx, method, path, body, { allow = [] } = {}) {
  const { basic } = keys(ctx);
  let res;
  try {
    res = await ctx.fetch(`${RZ}${path}`, {
      method,
      // Never followed: a redirect would carry the Basic key pair to a host nobody checked (attack b1844e0 B3).
      redirect: "manual",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/json", "user-agent": "arc-launch" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`razorpay ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || allow.includes(res.status)) return { status: res.status, body: json };
  const desc = json && json.error && typeof json.error.description === "string" ? `: ${say(json.error.description)}` : "";
  throw new Error(`razorpay ${method} ${path.split("?")[0]} -> ${res.status}${desc}`);
}

// A page read as a browser reads it: the HTML text, no cookie, no redirect followed.
async function html(ctx, domain, path) {
  let res;
  try {
    res = await ctx.fetch(`https://${domain}${path}`, { method: "GET", redirect: "manual", headers: { "user-agent": "arc-launch", accept: "text/html" } });
  } catch (e) {
    if (e && e.code) throw e;
    return { status: 0, text: "" };
  }
  return { status: res.status, text: await capped(res, PAGE_MAX) };
}

export function envContract() {
  return ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "SUPABASE_ACCESS_TOKEN", "GITHUB_TOKEN"];
}

// Check-then-create: commitFiles reads main's head, refuses any file of these paths that is not launch's, and commits
// only what differs, so a re-run on an unchanged repo creates nothing.
export async function scaffold(ctx) {
  keys(ctx);
  const { full, ref } = upstreamOf(ctx, "plans");
  domainOf(ctx);
  const sha = await commitFiles(ctx, full, FILES, { ".env.example": addEnvNames }, "checkout-portal: the order made on the server and the checkout page (ADR-1738)");
  ctx.report({ kind: "checkout-routes", id: `${full}:${sha}` });
  ctx.report({ kind: "venture-repo", id: full });
  ctx.report({ kind: "supabase-ref", id: ref });
  return { files: Object.keys(FILES), resources: [{ kind: "checkout-routes", id: `${full}:${sha}` }], notes: ["the payment itself is proven by webhooks-ledger from Razorpay's own event (ADR-1738)"] };
}

// The probe user's own org, found by name or created once (the authz probe's org).
async function ownOrg(ctx, domain, user, name) {
  const mine = await page(ctx, domain, user.cookies, "GET", "/api/orgs");
  if (mine.status !== 200 || !mine.body || !Array.isArray(mine.body.orgs)) throw new Error(`/api/orgs answered ${mine.status}`);
  const found = mine.body.orgs.find((o) => o && o.name === name);
  if (found) return String(found.id);
  const made = await page(ctx, domain, user.cookies, "POST", "/api/orgs", { name });
  if (made.status !== 201 || !made.body || typeof made.body.id !== "string") throw new Error(`creating an org answered ${made.status}`);
  return made.body.id;
}

// Asked of the live app and of Razorpay: the page loads checkout.js, probe user A gets a 201 carrying this slot's own
// test key id, and Razorpay holds that order for the probe org at the plan's price. One INR 499 test order per verify.
async function probe(ctx) {
  const { id: keyId } = keys(ctx);
  const { full, ref } = upstreamOf(ctx, "plans");
  const domain = domainOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const shown = await html(ctx, domain, "/checkout");
  if (shown.status !== 200) return { ok: false, reason: `/checkout answered ${shown.status}, not 200` };
  if (!loadsCheckout(shown.text)) return { ok: false, reason: `/checkout does not load ${CHECKOUT_JS}` };
  const key = await serviceKey(ctx, ref);
  const a = await signIn(ctx, domain, ref, key, "a");
  const org = await ownOrg(ctx, domain, a, "launch-probe-a");
  if (!UUID.test(org)) return { ok: false, reason: `the probe org id ${JSON.stringify(say(org, 50))} is not a uuid` };
  const made = await page(ctx, domain, a.cookies, "POST", "/api/checkout", { org });
  if (made.status !== 201 || !made.body || typeof made.body !== "object") return { ok: false, reason: `POST /api/checkout answered ${made.status}, not 201` };
  const given = made.body;
  // The key id is public, but only its shape is named: a live one says live, a foreign one says foreign.
  if (typeof given.key_id !== "string" || !given.key_id.startsWith("rzp_test_")) return { ok: false, reason: "the key id /api/checkout gave is not a test key; a launch-built route never sells live" };
  if (given.key_id !== keyId) return { ok: false, reason: "the key id /api/checkout gave is not this slot's RAZORPAY_KEY_ID, so the site does not run the keys launch proved" };
  if (typeof given.order_id !== "string" || !ORDER.test(given.order_id)) return { ok: false, reason: "/api/checkout gave no usable order id" };
  const id = given.order_id;
  const r = await rz(ctx, "GET", `/orders/${encodeURIComponent(id)}`, undefined, { allow: [400, 404] });
  // Only Razorpay's own "does not exist" (or a 404) means absent; any other 400 is reported as itself (attack 1cb6b9a B6).
  const desc = r.body && r.body.error && typeof r.body.error.description === "string" ? r.body.error.description : "";
  if (r.status === 404 || (r.status === 400 && /does not exist/i.test(desc))) return { ok: false, reason: `razorpay has no order ${id} for these keys` };
  if (r.status !== 200) return { ok: false, reason: `razorpay GET /orders/${id} -> ${r.status}: ${say(desc)}` };
  const o = r.body;
  if (!o || typeof o !== "object" || o.id !== id) return { ok: false, reason: `razorpay answered order ${id} with another id` };
  if (o.amount !== AMOUNT || o.currency !== CURRENCY) return { ok: false, reason: `order ${id} is ${say(o.amount, 12)} ${say(o.currency, 6)}, not ${AMOUNT} ${CURRENCY}` };
  // The org is a checked uuid, so an order whose notes carry no org id (or an empty one) can never match it.
  const notes = o.notes && typeof o.notes === "object" && !Array.isArray(o.notes) ? o.notes : {};
  if (notes.org_id !== org) return { ok: false, reason: `order ${id} is not for the probe org launch-probe-a` };
  return { ok: true, answerer: `${domain} + api.razorpay.com`, evidence: { page: 200, checkout: 201, order: id, amount: AMOUNT } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live app, Supabase and Razorpay; the probe is a browser, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Nothing to undo: the committed files are the venture's to keep, Razorpay keeps its orders (a test order moves no
// money), and the .env.example lines are shared with other slots.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "checkout-routes").map((r, i) => ({ order: i + 1, action: "none (the checkout files stay with the venture; Razorpay keeps its test orders)", resource: say(r.id, 80) })) };
}
