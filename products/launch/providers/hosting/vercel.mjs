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

// The project is launch's when Vercel links it to exactly this repo. An unlinked project is told apart from one
// linked elsewhere: the first usually means the Vercel GitHub App has no access yet (attack 1406e29 L5).
function own(project, full) {
  if (!project || typeof project !== "object" || typeof project.id !== "string") throw new Error("vercel returned no project");
  const link = project.link && typeof project.link === "object" ? project.link : null;
  if (!link || typeof link.repo !== "string")
    throw refuse("UNLINKED_PROJECT", `vercel project ${say(project.name, 64)} has no git link; install the Vercel GitHub App with access to ${full}, then link it`);
  const linked = link.type === "github" && `${link.org}/${link.repo}`.toLowerCase() === full.toLowerCase();
  if (!linked) throw refuse("FOREIGN_PROJECT", `vercel project ${say(project.name, 64)} is linked to another repo, not ${full}; launch never adopts it`);
  return project;
}

// The trailers that may own vercel.json: hosting's own and release's, as exact lines -- a prefix pasted into any
// commit message is not ownership (attack 1406e29 L1).
const owners = (ctx) => {
  const slug = ctx.tag.split("@")[0];
  return new Set([`Arc-Launch-Tag: ${ctx.tag}`, `Arc-Launch-Tag: ${slug}@release@arc-ship-release`]);
};
const tagged = (c, set) => {
  const msg = c && c.commit && typeof c.commit.message === "string" ? c.commit.message : "";
  return msg.split("\n").some((l) => set.has(l.trim()));
};

// The file's history on main, newest first. Ownership is that launch ever wrote it, not that the newest commit is
// launch's: an owner edit after release must not lock hosting out (attack 1406e29 L3).
async function history(ctx, full) {
  const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(FILE)}&sha=main&per_page=100`);
  return list(log.body);
}

const holds = (text) => {
  try { const v = JSON.parse(text); return !!v && v.ignoreCommand === JSON.parse(HOLD).ignoreCommand; } catch { return false; }
};

export function envContract() {
  return ["VERCEL_TOKEN", "GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repo(ctx);
  const domain = domainOf(ctx);
  const name = full.split("/")[1];
  const before = (kind, id) => ctx.resources.some((r) => r.kind === kind && r.id === id);

  // Launch claims only what it created (attack 1406e29 B1): a project or domain that was already there is recorded
  // as found, and the exit plan leaves it alone. One this slot created on an earlier attempt stays its own.
  let found = await vc(ctx, "GET", `/v9/projects/${name}`, undefined, [404]);
  let made = false;
  if (found.status === 404) { found = await vc(ctx, "POST", "/v11/projects", { name, framework: "nextjs", gitRepository: { type: "github", repo: full } }); made = true; }
  const project = own(found.body, full);
  const pkind = made || before("vercel-project", project.id) ? "vercel-project" : "vercel-project-found";
  ctx.report({ kind: pkind, id: project.id });

  // The hold is placed once in the file's life. Absent with a launch commit in its history means release (or the
  // owner) lifted it: a re-run never holds a live venture again (attack 1406e29 B2). Present without one is the
  // owner's file and is refused.
  const cur = await gh(ctx, "GET", `/repos/${full}/contents/${FILE}?ref=main`, undefined, [404]);
  const log = await history(ctx, full);
  const ours = log.some((c) => tagged(c, owners(ctx)));
  if (cur.status === 404 && !ours) {
    await gh(ctx, "PUT", `/repos/${full}/contents/${FILE}`, {
      message: `hosting: hold production until gate 2 (ADR-1727)\n\nArc-Launch-Tag: ${ctx.tag}`, content: b64(HOLD), branch: "main",
    });
    ctx.report({ kind: "github-file", id: `${full}:${FILE}` });
  } else if (cur.status !== 404 && !ours) {
    throw refuse("FOREIGN_FILE", `${full}:${FILE} exists and launch never wrote it; the production hold is not placed over it`);
  } else if (cur.status !== 404 && holds(unb64(cur.body && cur.body.content))) {
    ctx.report({ kind: "github-file", id: `${full}:${FILE}` });
  }

  const dId = `${project.id}:${domain}`;
  const has = await vc(ctx, "GET", `/v9/projects/${project.id}/domains/${domain}`, undefined, [404]);
  if (has.status === 404) await vc(ctx, "POST", `/v10/projects/${project.id}/domains`, { name: domain });
  const dkind = has.status === 404 || before("vercel-domain", dId) ? "vercel-domain" : "vercel-domain-found";
  ctx.report({ kind: dkind, id: dId });

  const conf = await vc(ctx, "GET", `/v6/domains/${domain}/config?projectIdOrName=${encodeURIComponent(project.id)}`);
  const recs = (conf.body && Array.isArray(conf.body.recommendedCNAME) ? conf.body.recommendedCNAME : [])
    .map((r) => (typeof r === "string" ? { rank: 1, value: r } : r && typeof r === "object" ? r : null))
    .filter((r) => r && typeof r.value === "string")
    .sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
  const target = recs.length ? bare(recs[0].value) : "";
  if (!HOST.test(target)) throw refuse("NO_TARGET", `vercel recommended no usable CNAME for ${domain} (got ${JSON.stringify(say(target, 80))})`);
  ctx.report({ kind: "dns-target", id: target });
  return { files: [], resources: [{ kind: pkind, id: project.id }, { kind: dkind, id: dId }, { kind: "dns-target", id: target }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

// Asked of Vercel: the project is linked to the repo, and the deployment of the commit that placed the hold exists
// as a git-triggered one (meta.githubDeployment "1", same org and repo). Any other git deployment -- a preview, a push
// before the hold -- is not the proof (attack 1406e29 B5/L8). Eight polls, 30 s apart, stay far inside the slot's
// 900 s timeout and the runner's stale-lock window (attack 1406e29 B4).
async function probe(ctx) {
  const full = repo(ctx);
  const [org, name] = full.toLowerCase().split("/");
  const found = await vc(ctx, "GET", `/v9/projects/${name}`, undefined, [404]);
  if (found.status === 404) return { ok: false, reason: `no vercel project ${name}` };
  const project = own(found.body, full);
  const hold = (await history(ctx, full)).filter((c) => tagged(c, new Set([`Arc-Launch-Tag: ${ctx.tag}`])) && typeof c.sha === "string").pop();
  if (!hold) return { ok: false, reason: `${full}:${FILE} has no commit from hosting; the production hold was never placed` };
  for (let i = 0; i < 8; i++) {
    if (i) await wait(30000, ctx.signal);
    // Filtered by the hold commit sha, so the proof never ages out of a page window (attack 21d7acb B3).
    const deps = await vc(ctx, "GET", `/v6/deployments?projectId=${encodeURIComponent(project.id)}&sha=${hold.sha}&limit=20`);
    const git = list(deps.body && deps.body.deployments).find((d) => d.meta && d.meta.githubDeployment === "1" && d.meta.githubCommitSha === hold.sha &&
      String(d.meta.githubCommitRepo || "").toLowerCase() === name && String(d.meta.githubCommitOrg || org).toLowerCase() === org);
    if (git) return { ok: true, answerer: "api.vercel.com", evidence: { project: project.id, deployment: say(git.uid, 64), sha: hold.sha, state: say(git.readyState || git.state, 20) } };
  }
  return { ok: false, reason: `no git-triggered deployment of the hold commit ${hold.sha.slice(0, 7)} yet` };
}

// verify answers; any failure inside the probe -- a coded refusal, a 5xx, a 429, a transport error -- is a not-ok
// answer, never a throw out of a read (attack 1406e29 B3/L2/L4). Only the slot timeout propagates.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.vercel.com; the probe is Vercel, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The exit plan removes only what launch made: the domain, then the project, then the hold file.
export async function teardown(ctx) {
  // The hold file is deleted only if it is still the hold launch wrote: an owner may have taken it over (attack 21d7acb B2).
  const order = { "vercel-domain": "remove-domain", "vercel-project": "delete-project", "github-file": "delete-if-unchanged" };
  const mine = ctx.resources.filter((r) => order[r.kind]).sort((a, b) => Object.keys(order).indexOf(a.kind) - Object.keys(order).indexOf(b.kind));
  return { steps: mine.map((r, i) => ({ order: i + 1, action: order[r.kind], resource: r.id })) };
}
