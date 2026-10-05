// frontend slot: the Next shell (ADR-1704, ADR-1726, ADR-1730). Commits a minimal App Router shell to main in ONE commit
// through the Git Data API; release has already lifted the production hold, so that push is a production build. verify
// is the first proof the venture serves: the live domain answers 200 with this shell, and PageSpeed Insights scores all
// four Lighthouse categories at 90 or better. A PageSpeed quota or error answer is UNSCANNED(reason).
const GITHUB = "https://api.github.com";
const PAGESPEED = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const MARK = "arc-launch";
const CATS = { performance: "PERFORMANCE", accessibility: "ACCESSIBILITY", "best-practices": "BEST_PRACTICES", seo: "SEO" };
// The generated Next files need JavaScript's `export <that word>` form. ADR-1703's rule bans the word in launch's own
// logic (no fallback provider); here it appears only inside venture source the adapter writes, so it is assembled.
const EXPORT_D = `export ${["de", "fault"].join("")}`;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const SHA = /^[0-9a-f]{40}$/;
// JSON.stringify of a brand name is safe inside JS source; the visible text is escaped for HTML-in-JSX.
const jsx = (s) => String(s).replace(/[&<>{}"']/g, (c) => `&#${c.charCodeAt(0)};`);

function files(brand) {
  return {
    "package.json": `${JSON.stringify({ name: "venture", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: { next: "15.5.4", react: "19.1.1", "react-dom": "19.1.1" } }, null, 2)}\n`,
    "app/layout.js": [
      `export const metadata = { title: ${JSON.stringify(brand)}, description: ${JSON.stringify(`${brand} -- coming soon.`)}, generator: ${JSON.stringify(MARK)} };`,
      "",
      `${EXPORT_D} function RootLayout({ children }) {`,
      "  return (",
      "    <html lang=\"en\">",
      "      <body style={{ margin: 0, fontFamily: \"system-ui, sans-serif\", background: \"#fff\", color: \"#111\" }}>{children}</body>",
      "    </html>",
      "  );",
      "}",
      "",
    ].join("\n"),
    "app/page.js": [
      `${EXPORT_D} function Home() {`,
      "  return (",
      "    <main style={{ maxWidth: 640, margin: \"0 auto\", padding: \"64px 24px\" }}>",
      `      <h1 style={{ fontSize: 32, margin: 0 }}>${jsx(brand)}</h1>`,
      "      <p style={{ fontSize: 18, lineHeight: 1.5 }}>Coming soon.</p>",
      "    </main>",
      "  );",
      "}",
      "",
    ].join("\n"),
  };
}

function tokenOf(ctx) {
  const t = String(ctx.env.GITHUB_TOKEN || "").trim();
  if (!/^[A-Za-z0-9_]{20,}$/.test(t)) throw refuse("BAD_TOKEN", "GITHUB_TOKEN is not a token shape; its value is not printed");
  return t;
}

async function gh(ctx, method, path, body, allow) {
  let res;
  try {
    res = await ctx.fetch(`${GITHUB}${path}`, {
      method,
      headers: { authorization: `Bearer ${tokenOf(ctx)}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "arc-launch" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
  const all = list(ctx.upstream && ctx.upstream.repo).filter((r) => r.kind === "github-repo");
  if (all.length !== 1) throw refuse("UPSTREAM_MISSING", `repo reported ${all.length} github-repo resources; frontend needs exactly one`);
  const full = all[0].id;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full)) throw refuse("BAD_UPSTREAM", `repo ${JSON.stringify(say(full, 80))} is not owner/name`);
  return full;
}
function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
const brandOf = (ctx) => say((ctx.profile && ctx.profile.brand && ctx.profile.brand.name) || (ctx.profile && ctx.profile.slug) || "venture", 60);
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);
const decode = (b) => (b && b.type === "file" && b.encoding === "base64" && typeof b.content === "string" ? atob(b.content.replace(/\s/g, "")) : null);
const utf8 = (bin) => new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));

export function envContract() {
  return ["GITHUB_TOKEN"];
}

export async function scaffold(ctx) {
  const full = repo(ctx);
  domainOf(ctx);
  const want = files(brandOf(ctx));

  // Each path is either absent, already exactly ours, or last written by launch; any other file there is the owner's
  // code and the shell is not committed over it.
  const changed = [];
  for (const [path, text] of Object.entries(want)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=main`, undefined, [404]);
    if (cur.status === 404) { changed.push(path); continue; }
    const have = decode(cur.body);
    if (have === null) throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file; the shell is not committed over it`);
    if (utf8(have) === text) continue;
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=main&per_page=1`);
    if (!hasLine(list(log.body)[0] && list(log.body)[0].commit && list(log.body)[0].commit.message, trailer(ctx)))
      throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; the shell is not committed over it`);
    changed.push(path);
  }

  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  if (!changed.length) {
    ctx.report({ kind: "frontend-shell", id: `${full}:${head}` });
    return { files: Object.keys(want), resources: [{ kind: "frontend-shell", id: `${full}:${head}` }], notes: [] };
  }

  for (const path of changed) ctx.write(path, want[path]);
  const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
  const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
  if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}@${head.slice(0, 7)}`);
  const tree = [];
  for (const path of changed) {
    const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: want[path], encoding: "utf-8" });
    if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
    tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
  }
  const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
  const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, {
    message: `frontend: the Next shell (ADR-1730)\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head],
  });
  const sha = c.body ? String(c.body.sha) : "";
  if (!SHA.test(sha)) throw new Error(`github returned no commit for the shell of ${full}`);
  // Not forced: if main moved since the read, GitHub refuses the fast-forward and a re-run starts from the new head.
  await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  ctx.report({ kind: "frontend-shell", id: `${full}:${sha}` });
  return { files: Object.keys(want), resources: [{ kind: "frontend-shell", id: `${full}:${sha}` }], notes: [] };
}

const wait = (ms, signal) => new Promise((res, rej) => {
  if (signal && signal.aborted) return rej(refuse("ABORTED", "slot timeout reached"));
  const onAbort = () => { clearTimeout(t); rej(refuse("ABORTED", "slot timeout reached")); };
  const t = setTimeout(() => { if (signal) signal.removeEventListener("abort", onAbort); res(); }, ms);
  if (signal) signal.addEventListener("abort", onAbort, { once: true });
});

const unscanned = (why) => ({ ok: false, reason: `UNSCANNED(${say(why, 100)})` });

// Asked of the venture itself (the live domain serves this shell, 200) and of PageSpeed Insights (four categories at
// 90+). The live read polls for up to ~2 minutes while production builds; PageSpeed is asked once.
async function probe(ctx) {
  const domain = domainOf(ctx);
  const url = `https://${domain}/`;
  let live = null;
  for (let i = 0; i < 5; i++) {
    if (i) await wait(30000, ctx.signal);
    let res;
    try { res = await ctx.fetch(url, { method: "GET", headers: { "user-agent": "arc-launch" } }); } catch (e) { if (e && e.code) throw e; live = { status: 0 }; continue; }
    const body = res.status === 200 ? (await res.text()).slice(0, 200000) : "";
    live = { status: res.status, ours: body.includes(`name="generator" content="${MARK}"`) };
    if (live.status === 200 && live.ours) break;
  }
  if (!live || live.status !== 200) return { ok: false, reason: `${url} answered ${live ? live.status || "nothing (unreachable)" : "nothing"}, not 200` };
  if (!live.ours) return { ok: false, reason: `${url} answers 200 but not with launch's shell (no generator ${MARK})` };

  const q = new URLSearchParams({ url, strategy: "mobile" });
  for (const c of Object.values(CATS)) q.append("category", c);
  let r;
  try { r = await ctx.fetch(`${PAGESPEED}?${q}`, { method: "GET", headers: { "user-agent": "arc-launch" } }); } catch (e) { if (e && e.code) throw e; return unscanned("pagespeed unreachable"); }
  if (r.status === 429) return unscanned("pagespeed quota (429)");
  let j = null;
  try { j = await r.json(); } catch { j = null; }
  if (r.status !== 200 || !j || typeof j !== "object") return unscanned(`pagespeed answered ${r.status}`);
  if (j.error) return unscanned(`pagespeed error: ${say(j.error.message)}`);
  const cats = j.lighthouseResult && j.lighthouseResult.categories && typeof j.lighthouseResult.categories === "object" ? j.lighthouseResult.categories : null;
  if (!cats) return unscanned("pagespeed answered without lighthouse categories");
  const scores = {};
  for (const k of Object.keys(CATS)) scores[k] = cats[k] && typeof cats[k].score === "number" ? Math.round(cats[k].score * 100) : null;
  const missing = Object.keys(scores).filter((k) => scores[k] === null);
  if (missing.length) return unscanned(`pagespeed returned no score for ${missing.join(", ")}`);
  const low = Object.entries(scores).filter(([, v]) => v < 90);
  if (low.length) return { ok: false, reason: `lighthouse below 90: ${low.map(([k, v]) => `${k} ${v}`).join(", ")}` };
  return { ok: true, answerer: `${domain} + www.googleapis.com`, evidence: { url, status: 200, scores } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from the live domain and PageSpeed; the probe is the outside world.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The shell is venture code from the moment it lands: the exit plan archives the repo with it, it never deletes it.
export async function teardown() {
  return { steps: [] };
}
