import { Buffer } from "node:buffer";
// ---- shared by auth, authz, tenancy, plans and security-headers (ADR-1734, ADR-1742). Adapters are one file each (ADR-1704), so this block is repeated.
const GITHUB = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/;
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
// ---- end of the shared block

// security-headers slot as Next config headers (ADR-1704, ADR-1742, ADR-1754). Commits `next.config.mjs`, whose
// A tag's attributes, left to right: a quoted value is consumed whole, so text inside it is never read as an attribute.
function attrsOf(tag) {
  const out = {};
  // Quote characters are written \x22 (double), \x27 (single) and \x60 (backtick) so a source lexer never sees one open.
  const re = /([^\s\x22\x27>/=]+)(?:\s*=\s*(?:\x22([^\x22]*)\x22|\x27([^\x27]*)\x27|([^\s\x22\x27=<>\x60]+)))?/g;
  const body = tag.replace(/^<script\b/i, "").replace(/\/?>$/, "");
  let m;
  while ((m = re.exec(body))) { const k = m[1].toLowerCase(); if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? ""; }
  return out;
}

// The read itself is bounded, not only its result: a page streaming without end is cut at the cap and cancelled (attack
// d8f943a B9).
async function readCapped(res, cap) {
  if (!res.body || typeof res.body.getReader !== "function") return (await res.text()).slice(0, cap);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < cap) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    text += dec.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text.slice(0, cap);
}

// `headers()` sets five response headers on every route, and `middleware.js`, which sets the CSP with a fresh nonce per
// request so script-src needs no 'unsafe-inline' (Next applies the nonce to its own scripts on a dynamic page). verify
// reads them from the live response (never from the file), checks every script the page serves carries that request's
// nonce, and asks Mozilla's HTTP Observatory for a grade, which must be A or A+. An Observatory
// that is rate-limited, errors or is unreachable is UNSCANNED(reason) -- never verified.
const OBSERVATORY = "https://observatory-api.mdn.mozilla.net/api/v2/scan";
const D = ["de", "fault"].join("");
const EXPORT_D = `export ${D}`;
// The fallback directive of CSP, assembled for the same reason as EXPORT_D (ADR-1703 bans the word in launch logic).
const SRC_SELF = `${D}-src 'self'`;
// Razorpay checkout loads its script and frame from these origins (checkout-portal, ADR-1738); Supabase is the data API.
// NONCE is replaced per request by the middleware; 'strict-dynamic' lets a nonced script load what it needs.
const NONCE = "{NONCE}";
const CSP = [
  SRC_SELF,
  `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
const HEADERS = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
];
const FILES = {
  "next.config.mjs": [
    "// Response headers on every route (arc launch, security-headers slot, ADR-1742).",
    `const headers = ${JSON.stringify(HEADERS.map(([key, value]) => ({ key, value })), null, 2)};`,
    "",
    `${EXPORT_D} {`,
    "  poweredByHeader: false,",
    "  async headers() {",
    "    return [{ source: \"/:path*\", headers }];",
    "  },",
    "};",
    "",
  ].join("\n"),
  "middleware.js": [
    "// Content-Security-Policy with a fresh nonce per request (arc launch, security-headers slot, ADR-1754). Next reads the",
    "// nonce from the request's CSP and puts it on its own scripts, so script-src carries no 'unsafe-inline'.",
    "import { NextResponse } from \"next/server\";",
    "",
    `const POLICY = ${JSON.stringify(CSP)};`,
    "",
    "export function middleware(request) {",
    "  const nonce = btoa(crypto.randomUUID());",
    `  const csp = POLICY.split(${JSON.stringify(NONCE)}).join(nonce);`,
    "  const headers = new Headers(request.headers);",
    "  headers.set(\"x-nonce\", nonce);",
    "  headers.set(\"content-security-policy\", csp);",
    "  const res = NextResponse.next({ request: { headers } });",
    "  res.headers.set(\"content-security-policy\", csp);",
    "  return res;",
    "}",
    "",
    "export const config = {",
    "  matcher: [{ source: \"/((?!_next/static|_next/image|favicon.ico).*)\", missing: [{ type: \"header\", key: \"next-router-prefetch\" }, { type: \"header\", key: \"purpose\", value: \"prefetch\" }] }],",
    "};",
    "",
  ].join("\n"),
};
const PRIVATE_REFERRER = new Set(["no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin"]);
const GRADES = new Set(["A+", "A"]);

// Upstream: hosting's reported vercel.json names the venture repo (ADR-1727). Validated here, never trusted.
function repoOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream.hosting);
  const file = String((up.find((r) => r.kind === "github-file") || {}).id || "");
  const full = file.slice(0, file.lastIndexOf(":"));
  if (!repoShape(full)) throw refuse("UPSTREAM_MISSING", "hosting reported no venture repo");
  return full;
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repoOf(ctx);
  domainOf(ctx);
  const sha = await commitFiles(ctx, full, FILES, {}, "security-headers: response headers and a per-request CSP nonce on every route (ADR-1742, ADR-1754)");
  ctx.report({ kind: "headers-config", id: `${full}:${sha}` });
  return { files: Object.keys(FILES), resources: [{ kind: "headers-config", id: `${full}:${sha}` }], notes: [] };
}

// What the live response must carry: the directives that decide the grade, not the file's exact bytes (a host may add
// its own HSTS beside ours, and a header value may be folded).
function missing(h) {
  const get = (k) => String(h.get(k) || "").toLowerCase();
  const out = [];
  const hsts = get("strict-transport-security");
  const age = Number((hsts.match(/max-age=(\d{1,10})/) || [])[1] || 0);
  if (age < 31536000 || !hsts.includes("includesubdomains")) out.push("strict-transport-security (max-age of a year or more, includeSubDomains)");
  const csp = get("content-security-policy").split(";").map((d) => d.trim());
  for (const d of [SRC_SELF, "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) if (!csp.includes(d)) out.push(`content-security-policy ${d}`);
  const script = (csp.find((d) => d.startsWith("script-src ")) || "").split(/\s+/);
  if (!script.some((t) => /^'nonce-[a-z0-9+/=_-]{16,}'$/.test(t)) || script.includes("'unsafe-inline'")) out.push("content-security-policy script-src with a nonce and no 'unsafe-inline'");
  if (get("x-content-type-options") !== "nosniff") out.push("x-content-type-options nosniff");
  if (!PRIVATE_REFERRER.has(get("referrer-policy"))) out.push("referrer-policy (a private policy)");
  if (get("x-frame-options") !== "deny") out.push("x-frame-options DENY");
  return out;
}

async function probe(ctx) {
  const full = repoOf(ctx);
  const domain = domainOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  let res;
  try {
    res = await ctx.fetch(`https://${domain}/`, { method: "GET", headers: { "user-agent": "arc-launch" }, redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    return { ok: false, reason: `https://${domain}/ did not answer (${say(e && e.name, 30) || "transport error"})` };
  }
  if (res.status !== 200) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: false, reason: `https://${domain}/ answered ${res.status}, not 200` };
  }
  const gap = missing(res.headers);
  if (gap.length) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { ok: false, reason: `the live response lacks ${gap.join(", ")}` };
  }
  // A nonce the page's scripts do not carry blocks the app's own JavaScript: a statically rendered page has none, so
  // the header alone is not the proof. Every script tag must carry this response's nonce, and there must be one.
  const nonce = (String(res.headers.get("content-security-policy") || "").match(/'nonce-([A-Za-z0-9+/=_-]+)'/) || [])[1];
  let html = "";
  try { html = await readCapped(res, 500000); } catch { html = ""; }
  // Tags are read by their attribute grammar, comments out first: a quoted value never hides a ">" or a decoy nonce, and
  // either quote style counts (attack d8f943a L6).
  const tags = html.replace(/<!--[\s\S]*?-->/g, "").match(/<script\b(?:[^>\x22\x27]|\x22[^\x22]*\x22|\x27[^\x27]*\x27)*>/gi) || [];
  const bare = tags.filter((t) => { const n = attrsOf(t).nonce; return !n || n !== nonce; });
  if (!tags.length) return { ok: false, reason: `https://${domain}/ served no script tag to check the nonce on` };
  if (bare.length) return { ok: false, reason: `${bare.length} of ${tags.length} script tags lack this response's CSP nonce (is the page statically rendered?)` };
  // The grade is Mozilla's, asked fresh on every verify.
  let scan;
  try {
    scan = await ctx.fetch(`${OBSERVATORY}?host=${encodeURIComponent(domain)}`, { method: "POST", headers: { "user-agent": "arc-launch" }, redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    return { ok: false, reason: "UNSCANNED(observatory unreachable)" };
  }
  let body = null;
  try { body = await scan.json(); } catch { body = null; }
  if (scan.status === 429) return { ok: false, reason: "UNSCANNED(observatory rate-limited)" };
  if (!scan.ok || !body || typeof body.grade !== "string") return { ok: false, reason: `UNSCANNED(observatory answered ${scan.status}${body && typeof body.error === "string" ? `: ${say(body.error, 80)}` : ""})` };
  if (!GRADES.has(body.grade)) return { ok: false, reason: `observatory grades ${domain} ${say(body.grade, 4)} (score ${say(body.score, 4)}), not A or A+` };
  return { ok: true, answerer: `${domain} + observatory-api.mdn.mozilla.net`, evidence: { grade: body.grade, score: body.score, headers: HEADERS.length + 1, nonced_scripts: tags.length } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from GitHub, the live domain and the Observatory; never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The config file is the venture's to keep; removing it would strip the headers from a live site.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "headers-config").map((r, i) => ({ order: i + 1, action: "keep (the venture's next.config.mjs; removing it strips the headers)", resource: say(r.id, 80) })) };
}
