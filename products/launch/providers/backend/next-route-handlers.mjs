// backend slot: Next route handlers (ADR-1704, ADR-1726, ADR-1733). Commits the zod contract of /api/health and the
// route that validates its own answer against it, in one commit through the Git Data API. verify reads the live route
// from the venture's own domain and checks the answer's exact shape -- the outside world answering, not the file.
const GITHUB = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SERVICE = "venture";
// The route answers this exact version, so the live answer can be tied to launch's route (attack 3f04230 L14).
const VERSION = "0.1.0";
// Next route files need JavaScript's `export` of a request handler and nothing that ADR-1703 bans; plain names only.
const FILES = {
  "lib/contract.js": [
    "// The contract of /api/health, written by arc launch (backend slot). Shared by the route and its callers.",
    "import { z } from \"zod\";",
    "",
    `export const Health = z.object({ ok: z.literal(true), service: z.literal(${JSON.stringify(SERVICE)}), version: z.string().min(1) }).strict();`,
    "",
  ].join("\n"),
  "app/api/health/route.js": [
    "// GET /api/health -- answers only what the contract allows, validated before it leaves (arc launch, backend slot).",
    "import { Health } from \"../../../lib/contract.js\";",
    "",
    "export const dynamic = \"force-dynamic\";",
    "",
    "export async function GET() {",
    `  const body = Health.parse({ ok: true, service: ${JSON.stringify(SERVICE)}, version: ${JSON.stringify(VERSION)} });`,
    "  return Response.json(body, { headers: { \"cache-control\": \"no-store\" } });",
    "}",
    "",
  ].join("\n"),
};

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);

function tokenOf(ctx) {
  const t = String(ctx.env.GITHUB_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "GITHUB_TOKEN is not a token shape; its value is not printed");
  return t;
}
async function gh(ctx, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${GITHUB}${path}`, { method, headers: { authorization: `Bearer ${tokenOf(ctx)}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "arc-launch" }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`github ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json };
  const msg = json && typeof json === "object" && typeof json.message === "string" ? `: ${say(json.message)}` : "";
  throw new Error(`github ${method} ${path.split("?")[0]} -> ${res.status}${msg}`);
}
function repo(ctx) {
  const all = list(ctx.upstream && ctx.upstream.frontend).filter((r) => r.kind === "frontend-shell");
  if (all.length < 1) throw refuse("UPSTREAM_MISSING", "frontend reported no shell; backend writes beside it");
  const full = String(all[all.length - 1].id).split(":")[0];
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full)) throw refuse("BAD_UPSTREAM", `frontend's shell id names no owner/name repo`);
  return full;
}
function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

// At `head`, `path` holds launch's exact bytes AND its newest commit carries this slot's trailer (attack 3f04230 B1/B4/L5).
async function oursAt(ctx, full, head, path) {
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
  const b = cur.body;
  if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== FILES[path]) return false;
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
  const top = list(log.body)[0];
  return hasLine(top && top.commit && top.commit.message, trailer(ctx));
}

export function envContract() {
  return ["GITHUB_TOKEN"];
}

// One commit on one head: head read first, every file checked at that sha, a non-forced ref update (ADR-1730 pattern).
export async function scaffold(ctx) {
  const full = repo(ctx);
  domainOf(ctx);
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = [];
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed.push(path); continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    // Identical bytes are still the owner's unless launch committed them: the trailer decides, content alone never
    // does (attack 3f04230 L3/L4).
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (utf8(b.content) === text && hasLine(top && top.commit && top.commit.message, trailer(ctx))) continue;
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; it is not committed over`);
    changed.push(path);
  }
  let sha = head;
  if (changed.length) {
    for (const path of changed) ctx.write(path, FILES[path]);
    const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
    const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
    if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
    const tree = [];
    for (const path of changed) {
      const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: FILES[path], encoding: "utf-8" });
      if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
      tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
    }
    const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
    const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `backend: the /api/health contract and route (ADR-1733)\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
    sha = c.body ? String(c.body.sha) : "";
    if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
    await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  }
  ctx.report({ kind: "backend-route", id: `${full}:${sha}` });
  return { files: Object.keys(FILES), resources: [{ kind: "backend-route", id: `${full}:${sha}` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of the live venture: /api/health answers 200, JSON, exactly { ok: true, service, version } and nothing more.
async function probe(ctx) {
  const url = `https://${domainOf(ctx)}/api/health`;
  // The route on main is launch's own; a live answer from someone else's route proves nothing (attack 3f04230 B4).
  const full = repo(ctx);
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return { ok: false, reason: `${full} main has no readable head` };
  for (const path of Object.keys(FILES))
    if (!(await oursAt(ctx, full, head, path))) return { ok: false, reason: `${full}@${head.slice(0, 7)}: ${path} is not launch's file` };
  let last = "no answer";
  for (let i = 0; i < 6; i++) {
    if (i) await wait(30000, ctx.signal);
    let res;
    try { res = await ctx.fetch(url, { method: "GET", headers: { "user-agent": "arc-launch", accept: "application/json" } }); } catch (e) { if (e && e.code) throw e; last = "unreachable"; continue; }
    if (res.status !== 200) { last = `answered ${res.status}`; continue; }
    if (!/^application\/json\b/i.test(String(res.headers.get("content-type") || ""))) return { ok: false, reason: `${url} answers 200 but not JSON` };
    let b = null;
    try { b = await res.json(); } catch { return { ok: false, reason: `${url} answers malformed JSON` }; }
    const keys = b && typeof b === "object" && !Array.isArray(b) ? Object.keys(b).sort().join(",") : "";
    if (keys !== "ok,service,version" || b.ok !== true || b.service !== SERVICE || b.version !== VERSION)
      return { ok: false, reason: `${url} answers outside the contract (keys: ${say(keys, 60) || "none"})` };
    return { ok: true, answerer: domainOf(ctx), evidence: { url, version: say(b.version, 40) } };
  }
  return { ok: false, reason: `${url} ${last}` };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live domain; the probe is the venture itself, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// Venture code from the moment it lands: the exit plan archives the repo with it, it never deletes it.
export async function teardown() {
  return { steps: [] };
}
