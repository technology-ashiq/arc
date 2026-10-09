import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
// ---- shared by auth, authz, tenancy, plans and the Phase 03 GitHub slots (ADR-1734, ADR-1747). Adapters are one file each (ADR-1704), so this block is repeated.
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

// errors slot on Sentry (ADR-1704, ADR-1747). Finds the venture's Sentry project (slug = venture slug; the owner creates
// it), reads its public DSN, and commits one probe route that throws a known error and reports it over Sentry's store
// API with no SDK (the shell owns package.json, ADR-1733). verify calls the live route with a probe id derived from the
// tag and a fresh nonce, then asks the Sentry API for an issue with exactly that message: "a thrown fixture error
// appears as a Sentry issue", answered by Sentry, never by the route's own word.
const SENTRY = "https://sentry.io/api/0";
const ROUTE = "app/api/arc-error-probe/route.js";
const DSN_SHAPE = /^https:\/\/[0-9a-f]{32}@o[0-9]{1,20}\.ingest(?:\.[a-z]{2,3})?\.sentry\.io\/[0-9]{1,20}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,49}$/;

const sentry = (ctx, method, path, allow) => call(ctx, `${SENTRY}${path}`, { authorization: `Bearer ${tokenOf(ctx, "SENTRY_AUTH_TOKEN", /^(?:sntrys_[A-Za-z0-9+/=_-]{20,400}|[0-9a-f]{64})$/)}` }, method, undefined, allow, `sentry ${path.split("?")[0]}`);

function routeFor(dsn) {
  return [
    "// Error probe (arc launch, errors slot, ADR-1747). Throws a known error and reports it to Sentry over the store API.",
    "export const dynamic = \"force-dynamic\";",
    "export const runtime = \"nodejs\";",
    "",
    `const DSN = ${JSON.stringify(dsn)};`,
    "const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { \"content-type\": \"application/json\" } });",
    "",
    "export async function GET(request) {",
    "  const q = new URL(request.url).searchParams;",
    "  const probe = q.get(\"probe\") || \"\";",
    "  const nonce = q.get(\"n\") || \"\";",
    "  if (!/^arcprobe[0-9a-f]{16}$/.test(probe) || !/^[0-9a-f]{8}$/.test(nonce)) return answer(400, { error: \"no probe id\" });",
    "  try {",
    "    throw new Error(\"arc-launch probe \" + probe + \" \" + nonce);",
    "  } catch (e) {",
    "    const u = new URL(DSN);",
    "    const store = u.protocol + \"//\" + u.host + \"/api\" + u.pathname + \"/store/\";",
    "    const auth = \"Sentry sentry_version=7, sentry_key=\" + u.username + \", sentry_client=arc-launch/0.1\";",
    "    const res = await fetch(store, {",
    "      method: \"POST\",",
    "      headers: { \"content-type\": \"application/json\", \"x-sentry-auth\": auth },",
    "      body: JSON.stringify({ message: e.message, level: \"error\", platform: \"javascript\", logger: \"arc-launch\", tags: { arc_launch_probe: probe } }),",
    "    }).catch(() => null);",
    "    return answer(500, { reported: !!(res && res.ok) });",
    "  }",
    "}",
    "",
  ].join("\n");
}

// Upstream: hosting's reported vercel.json names the venture repo (ADR-1727). Validated here, never trusted.
function repoOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream.hosting);
  const file = String((up.find((r) => r.kind === "github-file") || {}).id || "");
  const full = file.slice(0, file.lastIndexOf(":"));
  if (!repoShape(full)) throw refuse("UPSTREAM_MISSING", "hosting reported no venture repo");
  return full;
}

// The venture's Sentry project, found by slug across every page of the projects list; never created, never guessed.
async function projectOf(ctx) {
  const slug = String((ctx.profile && ctx.profile.slug) || "");
  if (!SLUG.test(slug)) throw refuse("BAD_SLUG", "the venture slug is not a Sentry project slug");
  const hits = [];
  let cursor = "";
  for (let page = 0; page < 20; page++) {
    const r = await sentry(ctx, "GET", `/projects/?per_page=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!Array.isArray(r.body)) throw new Error("sentry answered the projects list without an array");
    hits.push(...list(r.body).filter((p) => p.slug === slug));
    const link = String((r.res && r.res.headers && r.res.headers.get("link")) || "");
    // Sentry's Link header: rel="next"; results="true"; cursor="...". Split on the quote character, not a regex, so
    // the launch-lint string blanker never meets a quote inside a regex literal.
    const q = String.fromCharCode(34);
    const next = link.split(",").find((l) => l.includes(`rel=${q}next${q}`) && l.includes(`results=${q}true${q}`));
    if (!next) break;
    cursor = ((next.split(`cursor=${q}`)[1] || "").split(q)[0] || "").slice(0, 100);
    if (!cursor) break;
  }
  if (hits.length === 0) throw refuse("SENTRY_PROJECT_MISSING", `no Sentry project with slug ${slug}; the owner creates it`);
  if (hits.length > 1) throw refuse("SENTRY_PROJECT_AMBIGUOUS", `${hits.length} Sentry projects have slug ${slug}`);
  const org = String((hits[0].organization && hits[0].organization.slug) || "");
  if (!SLUG.test(org)) throw new Error("sentry answered the project without an organization slug");
  return { org, slug };
}

async function dsnOf(ctx, p) {
  const r = await sentry(ctx, "GET", `/projects/${p.org}/${p.slug}/keys/`);
  const keys = list(r.body).filter((k) => k.isActive !== false && k.dsn && typeof k.dsn.public === "string" && DSN_SHAPE.test(k.dsn.public));
  if (!keys.length) throw refuse("SENTRY_NO_DSN", `Sentry project ${p.org}/${p.slug} has no active client key`);
  return keys[0].dsn.public;
}

function probeId(ctx) {
  if (typeof ctx.tag !== "string" || !ctx.tag) throw refuse("BAD_TAG", "the slot has no resource tag; the probe has no identity");
  return `arcprobe${createHash("sha256").update(ctx.tag, "utf8").digest("hex").slice(0, 16)}`;
}

export function envContract() {
  return ["SENTRY_AUTH_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repoOf(ctx);
  probeId(ctx);
  const p = await projectOf(ctx);
  const dsn = await dsnOf(ctx, p);
  const sha = await commitFiles(ctx, full, { [ROUTE]: routeFor(dsn) }, {}, "errors: Sentry error probe route (ADR-1747)");
  ctx.report({ kind: "sentry-project", id: `${p.org}/${p.slug}` });
  ctx.report({ kind: "error-probe-route", id: `${full}:${sha}` });
  return { files: [ROUTE], resources: [{ kind: "sentry-project", id: `${p.org}/${p.slug}` }, { kind: "error-probe-route", id: `${full}:${sha}` }], notes: [] };
}

// An abort that already fired never notifies again: check it first, and drop the listener when the timer wins
// (attack b6ffd12 B3).
const pause = (ms, signal) => new Promise((res, rej) => {
  const stop = () => rej(Object.assign(new Error("aborted"), { code: "ABORTED" }));
  if (signal && signal.aborted) return stop();
  const onAbort = () => { clearTimeout(t); stop(); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

async function probe(ctx) {
  const full = repoOf(ctx);
  const domain = domainOf(ctx);
  const id = probeId(ctx);
  const p = await projectOf(ctx);
  const dsn = await dsnOf(ctx, p);
  const drift = await oursAtHead(ctx, full, { [ROUTE]: routeFor(dsn) });
  if (drift) return { ok: false, reason: drift };
  // A fresh nonce per verify: only this verify's event can match, never a stale one under the same probe id (b6ffd12 B10).
  const nonce = randomBytes(4).toString("hex");
  const msg = `arc-launch probe ${id} ${nonce}`;
  let res;
  try {
    res = await ctx.fetch(`https://${domain}/api/arc-error-probe?probe=${id}&n=${nonce}`, { method: "GET", headers: { "user-agent": "arc-launch" }, redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    return { ok: false, reason: `https://${domain}/api/arc-error-probe did not answer` };
  }
  if (res.status !== 500) return { ok: false, reason: `the probe route answered ${res.status}, not 500 (the thrown error)` };
  // Sentry ingests asynchronously: the issue is asked for a few times before the answer is "not seen".
  const query = encodeURIComponent(`"${msg}"`);
  for (let i = 0; i < 6; i++) {
    if (i) await pause(15000, ctx.signal);
    const r = await sentry(ctx, "GET", `/projects/${p.org}/${p.slug}/issues/?query=${query}&statsPeriod=24h`);
    const hit = list(r.body).find((x) => typeof x.title === "string" && x.title.includes(msg));
    if (hit) return { ok: true, answerer: "sentry.io", evidence: { project: `${p.org}/${p.slug}`, issue: say(hit.id, 30), probe: id, nonce } };
  }
  return { ok: false, reason: `Sentry shows no issue "${msg}" from this verify` };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from GitHub, the live route and sentry.io; never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The Sentry project is the owner's; the probe route is removed with the venture's code, not by launch.
export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "error-probe-route" || r.kind === "sentry-project").map((r, i) => ({ order: i + 1, action: r.kind === "sentry-project" ? "keep (the owner's Sentry project)" : "remove app/api/arc-error-probe at the venture's next cleanup", resource: say(r.id, 80) })) };
}
