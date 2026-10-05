// hosting slot on Vercel (ADR-1704, ADR-1725, ADR-1727). One project per venture repo, linked to it through Vercel's
// GitHub integration; production is held by a committed vercel.json until gate 2 is decided (release lifts it). The
// brand domain is attached and the CNAME target Vercel recommends is reported as `dns-target` for the dns slot.
// A project of that name linked to any other repo is someone else's and is never touched.
import { Buffer } from "node:buffer";

const VERCEL = "https://api.vercel.com";
const GITHUB = "https://api.github.com";
const FILE = "vercel.json";
// Exit 0 skips the build (Vercel's ignored-build step): production is skipped, previews build.
const HOLD =`${JSON.stringify({ ignoreCommand: "[ \"$VERCEL_ENV\" = production ]" }, null, 2)}\n`;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const bare = (h) => String(h || "").trim().toLowerCase().replace(/\.$/, "");
const b64 = (text) => Buffer.from(text, "utf8").toString("base64");
const unb64 = (text) => Buffer.from(String(text || "").replace(/\s/g, ""), "base64").toString("utf8");

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// One caller for both APIs: the body's error text is sanitised, a transport error never echoes its headers.
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

// Upstream values are another adapter's output: exactly one repo, shaped owner/name.
function repo(ctx) {
  const all = list(ctx.upstream && ctx.upstream.repo).filter((r) => r.kind === "github-repo");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `repo reported ${all.length} github-repo resources; hosting needs exactly one`);
  const full = all[0].id;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full)) throw refuse("BAD_UPSTREAM", `repo ${JSON.stringify(say(full, 80))} is not owner/name`);
  return full;
}

function domainOf(ctx) {
  const d = bare(ctx.profile && ctx.profile.brand && ctx.profile.brand.domain);
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}

// The project is launch's when Vercel links it to exactly this repo.
function own(project, full) {
  if (!project || typeof project !== "object" || typeof project.id !== "string") throw new Error("vercel returned no project");
  const link = project.link && typeof project.link === "object" ? project.link : null;
  const linked = link && link.type === "github" && `${link.org}/${link.repo}`.toLowerCase() === full.toLowerCase();
  if (!linked) throw refuse("FOREIGN_PROJECT", `vercel project ${say(project.name, 64)} exists and is not linked to ${full}; launch never adopts it`);
  return project;
}

// The newest commit touching the file carries this slot's trailer: content alone is not ownership.
async function wroteIt(ctx, full, path) {
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=main&per_page=1`);
  const top = list(log.body)[0];
  const msg = top && top.commit && typeof top.commit.message === "string" ? top.commit.message : "";
  const release = `Arc-Launch-Tag: ${ctx.tag.split("@")[0]}@release@`;
  return msg.split("\n").some((l) => l.trim() === `Arc-Launch-Tag: ${ctx.tag}` || l.trim().startsWith(release));
}

export function envContract() {
  return ["VERCEL_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repo(ctx);
  const domain = domainOf(ctx);
  const name = full.split("/")[1];

  let found = await vc(ctx, "GET", `/v9/projects/${name}`, undefined, [404]);
  if (found.status === 404) found = await vc(ctx, "POST", "/v11/projects", { name, framework: "nextjs", gitRepository: { type: "github", repo: full } });
  const project = own(found.body, full);
  ctx.report({ kind: "vercel-project", id: project.id });

  // The hold is written once. A file release has since lifted is left as it is: a re-run of hosting never re-holds a
  // live venture. A vercel.json launch did not write is refused, never overwritten.
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${FILE}?ref=main`, undefined, [404]);
  if (cur.status === 404) {
    await gh(ctx, "PUT", `/repos/${full}/contents/${FILE}`, {
      message: `hosting: hold production until gate 2 (ADR-1727)\n\nArc-Launch-Tag: ${ctx.tag}`, content: b64(HOLD), branch: "main",
    });
    ctx.report({ kind: "github-file", id: `${full}:${FILE}` });
  } else if (!(await wroteIt(ctx, full, FILE))) {
    throw refuse("FOREIGN_FILE", `${full}:${FILE} exists and launch did not write it; the production hold is not placed over it`);
  } else if (unb64(cur.body && cur.body.content) === HOLD) {
    ctx.report({ kind: "github-file", id: `${full}:${FILE}` });
  }

  const has = await vc(ctx, "GET", `/v9/projects/${project.id}/domains/${domain}`, undefined, [404]);
  if (has.status === 404) await vc(ctx, "POST", `/v10/projects/${project.id}/domains`, { name: domain });
  ctx.report({ kind: "vercel-domain", id: `${project.id}:${domain}` });

  const conf = await vc(ctx, "GET", `/v6/domains/${domain}/config?projectIdOrName=${encodeURIComponent(project.id)}`);
  const recs = (conf.body && Array.isArray(conf.body.recommendedCNAME) ? conf.body.recommendedCNAME : [])
    .map((r) => (typeof r === "string" ? { rank: 1, value: r } : r && typeof r === "object" ? r : null))
    .filter((r) => r && typeof r.value === "string")
    .sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
  const target = recs.length ? bare(recs[0].value) : "";
  if (!HOST.test(target)) throw refuse("NO_TARGET", `vercel recommended no usable CNAME for ${domain} (got ${JSON.stringify(say(target, 80))})`);
  ctx.report({ kind: "dns-target", id: target });
  return {
    files: [],
    resources: [{ kind: "vercel-project", id: project.id }, { kind: "vercel-domain", id: `${project.id}:${domain}` }, { kind: "dns-target", id: target }],
    notes: [],
  };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of Vercel: the project is linked to the repo and a deployment that a git push triggered exists
// (meta.githubDeployment "1"). With production held that deployment is the skipped one; that it exists is the proof.
async function probe(ctx) {
  const full = repo(ctx);
  const name = full.split("/")[1];
  const found = await vc(ctx, "GET", `/v9/projects/${name}`, undefined, [404]);
  if (found.status === 404) return { ok: false, reason: `no vercel project ${name}` };
  const project = own(found.body, full);
  for (let i = 0; i < 20; i++) {
    if (i) await wait(30000, ctx.signal);
    const deps = await vc(ctx, "GET", `/v6/deployments?projectId=${encodeURIComponent(project.id)}&limit=20`);
    const git = list(deps.body && deps.body.deployments).find((d) => d.meta && d.meta.githubDeployment === "1" && String(d.meta.githubCommitRepo || "").toLowerCase() === name);
    if (git) return { ok: true, answerer: "api.vercel.com", evidence: { project: project.id, deployment: say(git.uid, 64), sha: say(git.meta.githubCommitSha, 40), state: say(git.readyState || git.state, 20) } };
  }
  return { ok: false, reason: `no git-triggered deployment for ${name} yet` };
}

// verify answers; a coded refusal becomes a not-ok answer, never a throw out of a read. Only the slot timeout propagates.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.vercel.com; the probe is Vercel, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code && e.code !== "ABORTED") return { ok: false, reason: `${e.code}: ${say(e.message)}` };
    throw e;
  }
}

// The exit plan removes only what launch made: the domain, then the project, then the hold file.
export async function teardown(ctx) {
  const order = { "vercel-domain": "remove-domain", "vercel-project": "delete-project", "github-file": "delete" };
  const mine = ctx.resources.filter((r) => order[r.kind]).sort((a, b) => Object.keys(order).indexOf(a.kind) - Object.keys(order).indexOf(b.kind));
  return { steps: mine.map((r, i) => ({ order: i + 1, action: order[r.kind], resource: r.id })) };
}
