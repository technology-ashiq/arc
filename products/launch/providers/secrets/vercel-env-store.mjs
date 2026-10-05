// secrets slot on Vercel's env store (ADR-1704, ADR-1729). The contract is the NAME= lines of the venture repo's
// .env.example on main; launch writes the file (no names) when it is absent, and never reads, writes or prints a value.
// verify asks Vercel which keys are set for production (no decrypt) and GitHub whether any .env file is in git.
import { Buffer } from "node:buffer";

const VERCEL = "https://api.vercel.com";
const GITHUB = "https://api.github.com";
const FILE = ".env.example";
const TEMPLATE = [
  "# Runtime keys this venture needs. NAMES only -- never a value. arc launch's secrets slot reads this file:",
  "# every NAME= line must be set for production in the host's env store, placed by the owner.",
  "",
].join("\n");
const NAME = /^[A-Z][A-Z0-9_]{0,127}$/;
// A committed env file other than the template is a key in git. `.env.example` and the template variants are not.
// A key file is judged on the path's LAST segment, length-capped, by patterns whose groups cannot overlap: the first
// form (`(\.[^/]+)*` over the whole path) backtracked exponentially on `.env.a.a.a…/x` and froze the worker past its
// own timeout (attack 07bcb38 B1). Caught: `.env` with any dot segments in any case, `*.env`, `.envrc`; a name whose
// last segment is example, sample or template is a template (attack 14d5374 B1, 07bcb38 B2).
const DOT_ENV = /^\.env(?:\.[^.]+)*$/i;
const TEMPLATE_END = /\.(?:example|sample|template)$/i;
function isKeyFile(path) {
  const seg = String(path).split("/").pop().slice(0, 255);
  if (TEMPLATE_END.test(seg)) return false;
  return DOT_ENV.test(seg) || /^[^.][^/]*\.env$/i.test(seg) || /^\.envrc$/i.test(seg);
}

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
const unb64 = (text) => Buffer.from(String(text || "").replace(/\s/g, ""), "base64").toString("utf8");

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// Error text never carries a response body beyond the provider's sanitised message: an env answer holds values.
async function call(ctx, base, auth, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${auth}`, "content-type": "application/json", "user-agent": "arc-launch", ...(base === GITHUB ? { accept: "application/vnd.github+json" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${base === GITHUB ? "github" : "vercel"} ${method} ${path.split("?")[0]} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json };
  const e = json && typeof json === "object" ? (json.error && typeof json.error === "object" ? json.error : json) : {};
  const msg = typeof e.message === "string" ? `: ${say(e.message)}` : "";
  throw new Error(`${base === GITHUB ? "github" : "vercel"} ${method} ${path.split("?")[0]} -> ${res.status}${msg}`);
}
const vc = (ctx, method, path, body, allow) => call(ctx, VERCEL, tokenOf(ctx, "VERCEL_TOKEN", /^[A-Za-z0-9_-]{20,}$/), method, path, body, allow);
const gh = (ctx, method, path, body, allow) => call(ctx, GITHUB, tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/), method, path, body, allow);

// Upstream: the project hosting created or found, and the repo the repo slot reported.
function project(ctx) {
  const all = list(ctx.upstream && ctx.upstream.hosting).filter((r) => r.kind === "vercel-project" || r.kind === "vercel-project-found");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `hosting reported ${all.length} vercel projects; secrets needs exactly one`);
  if (!/^prj_[A-Za-z0-9]{1,64}$/.test(all[0].id)) throw refuse("BAD_UPSTREAM", `vercel project id ${JSON.stringify(say(all[0].id, 80))} is not a project id`);
  return all[0].id;
}
async function linkedRepo(ctx, pid) {
  const p = await vc(ctx, "GET", `/v9/projects/${pid}`);
  const link = p.body && p.body.link && typeof p.body.link === "object" ? p.body.link : null;
  const full = link && link.type === "github" ? `${link.org}/${link.repo}` : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(full)) throw refuse("UNLINKED_PROJECT", `vercel project ${pid} is not linked to a GitHub repo`);
  return full;
}

// The contract: NAME= lines, comments and blanks skipped. A line that is neither is refused, never guessed at -- and a
// line that carries a value is refused too, since .env.example is committed (ADR-1729).
function contract(text) {
  const names = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([^=\s]+)=(.*)$/);
    if (!m || !NAME.test(m[1])) throw refuse("BAD_CONTRACT", `${FILE} line ${i + 1} is not NAME=`);
    if (m[2].trim() !== "") throw refuse("VALUE_IN_GIT", `${FILE} line ${i + 1} (${m[1]}) carries a value; the template holds names only`);
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

async function readContract(ctx, full) {
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${FILE}?ref=main`, undefined, [404]);
  if (cur.status === 404) return null;
  // Only a plain base64 file is read: a directory, a submodule or a file too large for the contents API answers with
  // no content, and an empty contract read from it would pass every check (attack 14d5374 B2).
  const b = cur.body;
  if (!b || Array.isArray(b) || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string")
    throw refuse("BAD_CONTRACT", `${FILE} on main is not a plain file the contents API returns whole`);
  return contract(unb64(b.content));
}

export function envContract() {
  return ["VERCEL_TOKEN", "GITHUB_TOKEN"];
}

// An existing .env.example is the venture's own: launch reads it and never rewrites it, so there is nothing of it to
// claim and the exit plan leaves it. One launch wrote is recorded and removed only if unchanged.
export async function scaffold(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);
  const names = await readContract(ctx, full);
  // The file launch wrote is recorded with the blob sha it wrote, so the exit plan deletes it only while that is
  // still what main holds (attack 14d5374 B4). A re-run after a kill between the PUT and the report recognises the
  // file by its trailer on the newest commit that touched it (B3).
  if (names === null) {
    const put = await gh(ctx, "PUT", `/repos/${full}/contents/${FILE}`, { message: `secrets: the env contract, names only (ADR-1729)\n\nArc-Launch-Tag: ${ctx.tag}`, content: b64(TEMPLATE), branch: "main" });
    const sha = put.body && put.body.content && typeof put.body.content.sha === "string" ? put.body.content.sha : "unknown";
    ctx.report({ kind: "github-file", id: `${full}:${FILE}@${sha}` });
  } else if (!ctx.resources.some((r) => r.kind === "github-file")) {
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(FILE)}&sha=main&per_page=1`);
    const top = list(log.body)[0];
    const msg = top && top.commit && typeof top.commit.message === "string" ? top.commit.message : "";
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${FILE}?ref=main`);
    if (msg.split("\n").some((l) => l.trim() === `Arc-Launch-Tag: ${ctx.tag}`) && cur.body && typeof cur.body.sha === "string")
      ctx.report({ kind: "github-file", id: `${full}:${FILE}@${cur.body.sha}` });
  }
  ctx.report({ kind: "env-contract", id: `${full}:${FILE}` });
  return { files: [], resources: [{ kind: "env-contract", id: `${full}:${FILE}` }], notes: [] };
}

// Asked of Vercel and GitHub, never of state.
async function probe(ctx) {
  const pid = project(ctx);
  const full = await linkedRepo(ctx, pid);
  const names = await readContract(ctx, full);
  if (names === null) return { ok: false, reason: `${full} has no ${FILE}; the env contract is missing` };
  const tree = await gh(ctx, "GET", `/repos/${full}/git/trees/main?recursive=1`);
  if (tree.body && tree.body.truncated === true) return { ok: false, reason: `${full}'s tree is too large to list in one answer; the no-key-in-git check cannot see all of it` };
  const leaked = list(tree.body && tree.body.tree).map((e) => String(e.path || "")).filter(isKeyFile);
  // The claim is about main's tip tree only: history and other branches are not read (attack 14d5374 B5, debt D20).
  if (leaked.length) return { ok: false, reason: `key file in git (main tip tree): ${leaked.slice(0, 5).map((p) => say(p, 80)).join(", ")}` };
  // Keys and targets only; the request carries no decrypt flag and no value is read from the answer.
  const env = await vc(ctx, "GET", `/v10/projects/${pid}/env`);
  const set = new Set(list(env.body && env.body.envs).filter((e) => {
    const t = Array.isArray(e.target) ? e.target : [e.target];
    return typeof e.key === "string" && t.includes("production");
  }).map((e) => e.key));
  const missing = names.filter((n) => !set.has(n));
  if (missing.length) return { ok: false, reason: `owner places for production: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` (+${missing.length - 10})` : ""}` };
  return { ok: true, answerer: "api.vercel.com + api.github.com", evidence: { project: pid, repo: full, names: names.length, keyFilesInMainTipTree: 0 } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.vercel.com and api.github.com; the probe is the providers.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

export async function teardown(ctx) {
  return { steps: ctx.resources.filter((r) => r.kind === "github-file").map((r, i) => ({ order: i + 1, action: "delete-if-unchanged", resource: r.id })) };
}
