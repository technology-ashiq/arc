// In-memory Vercel, wired to an in-memory GitHub (fakes/github.mjs): a project linked to a repo gets one git-triggered
// deployment per commit that lands on main after the link, the way Vercel's GitHub integration answers a push.
// It replaces only the transport; `fetch` routes api.github.com to the GitHub fake. Deterministic ids from a counter.
//   cname        the CNAME Vercel recommends for any domain (null: it recommends none)
//   projects     seed projects: [{ name, link: { type, org, repo } }]
//   failDeployments  the deployments list answers 500
//   previewState     readyState of every preview deployment
import { tick } from "./clock.mjs";

export function makeVercel({ github, token = "vercel_fixture_token_0123456789", cname = "abc123.vercel-dns-017.com", projects = [], failDeployments = false, previewState = "READY", servedLag = false } = {}) {
  let n = 0;
  const id = (p) => `${p}_${String(++n).padStart(6, "0")}`;
  const store = new Map(projects.map((p) => [p.name, { id: id("prj"), domains: [], linkedAt: 0, ...p }]));
  const calls = [];
  let decryptAsked = false;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, code, message) => json(status, { error: { code, message } });
  const byIdOrName = (k) => store.get(k) || [...store.values()].find((p) => p.id === k);

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com") return github.fetch(input, init);
    if (url.hostname !== "api.vercel.com") throw new Error(`fake vercel: unexpected host ${url.hostname}`);
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);
    if ((init.headers || {}).authorization !== `Bearer ${token}`) return err(403, "forbidden", "Not authorized");
    const body = init.body ? JSON.parse(init.body) : null;
    const p = url.pathname;

    if (method === "POST" && p === "/v11/projects") {
      if (store.has(body.name)) return err(409, "conflict", "Project already exists");
      const [org, repo] = body.gitRepository.repo.split("/");
      if (!github.store.has(body.gitRepository.repo)) return err(400, "bad_request", "Repository not found or the GitHub App has no access");
      const proj = { id: id("prj"), name: body.name, framework: body.framework, createdFramework: body.framework, link: { type: "github", org, repo }, domains: [], linkedAt: github.store.get(body.gitRepository.repo).commits.length };
      store.set(body.name, proj);
      return json(200, proj);
    }
    let m = p.match(/^\/v9\/projects\/([^/]+)$/);
    if (m && method === "GET") { const proj = byIdOrName(m[1]); return proj ? json(200, proj) : err(404, "not_found", "Project not found"); }
    // The preset a later commit builds with: `presetFrom` is the commit count when it changed, so a test can see
    // whether the preset landed before or after a push.
    if (m && method === "PATCH") {
      const proj = byIdOrName(m[1]);
      if (!proj) return err(404, "not_found", "Project not found");
      if ("framework" in body) { proj.framework = body.framework; proj.presetFrom = github.store.get(`${proj.link.org}/${proj.link.repo}`).commits.length; }
      return json(200, proj);
    }
    // The env list carries a value per key, as Vercel's does (encrypted unless decrypt=true); a test asserts the
    // adapter never asks for decryption and never echoes one.
    m = p.match(/^\/v10\/projects\/([^/]+)\/env$/);
    if (m && method === "GET") {
      const proj = byIdOrName(m[1]);
      if (!proj) return err(404, "not_found", "Project not found");
      if (url.searchParams.has("decrypt")) decryptAsked = true;
      // Vercel answers each variable's own id and its times; auth's stale-build check reads updatedAt.
      return json(200, { envs: (proj.envs || []).map((e, i) => ({ id: e.id || `env_${i}`, key: e.key, target: e.target, type: "encrypted", value: e.value, createdAt: e.createdAt, updatedAt: e.updatedAt })) });
    }
    // auth places the two public Supabase values (ADR-1757); a production rebuild from main is only counted.
    if (m && method === "POST") {
      const proj = byIdOrName(m[1]);
      if (!proj) return err(404, "not_found", "Project not found");
      proj.envs = proj.envs || [];
      // Vercel refuses a name only where its targets overlap: production beside a preview-only value is allowed.
      const tg = (t) => (Array.isArray(t) ? t : [t]);
      if (proj.envs.some((e) => e.key === body.key && tg(e.target).some((t) => tg(body.target).includes(t)))) return err(400, "ENV_CONFLICT", "A variable with the name already exists for this target");
      const envId = id("env");
      const now = tick();
      proj.envs.push({ id: envId, key: body.key, target: body.target, value: body.value, createdAt: now, updatedAt: now });
      return json(201, { created: { id: envId, key: body.key, target: body.target } });
    }
    if (method === "POST" && p === "/v13/deployments") {
      const proj = byIdOrName(body.project);
      if (!proj) return err(404, "not_found", "Project not found");
      proj.rebuilds = (proj.rebuilds || 0) + 1;
      (proj.rebuiltAt = proj.rebuiltAt || []).push(tick());
      return json(200, { id: id("dpl"), readyState: "QUEUED" });
    }
    m = p.match(/^\/v9\/projects\/([^/]+)\/domains\/([^/]+)$/);
    if (m && method === "GET") {
      const proj = byIdOrName(m[1]);
      return proj && proj.domains.includes(m[2]) ? json(200, { name: m[2], projectId: proj.id, verified: true }) : err(404, "not_found", "Domain not found");
    }
    m = p.match(/^\/v10\/projects\/([^/]+)\/domains$/);
    if (m && method === "POST") {
      const proj = byIdOrName(m[1]);
      if (!proj) return err(404, "not_found", "Project not found");
      if ([...store.values()].some((x) => x.domains.includes(body.name))) return err(409, "domain_already_in_use", "Domain is already in use");
      proj.domains.push(body.name);
      return json(200, { name: body.name, projectId: proj.id, verified: true });
    }
    m = p.match(/^\/v6\/domains\/([^/]+)\/config$/);
    if (m && method === "GET") return json(200, { misconfigured: true, recommendedCNAME: cname ? [{ rank: 1, value: `${cname}.` }] : [], recommendedIPv4: [] });
    if (failDeployments) return err(500, "internal", "An unexpected error occurred");
    // Debt D30: the deployment serving a domain -- the project holding it, at main's head unless `servedLag` holds it
    // back one commit (a production deploy that lags main).
    m = p.match(/^\/v13\/deployments\/([^/]+)$/);
    if (m && method === "GET" && !m[1].startsWith("dpl_")) {
      const host = decodeURIComponent(m[1]);
      const proj = [...store.values()].find((x) => (x.domains || []).some((d) => (d.name || d) === host)) || (store.size === 1 ? [...store.values()][0] : null);
      const r = proj && proj.link ? github.store.get(`${proj.link.org}/${proj.link.repo}`) : null;
      const cs = r ? r.commits : [];
      const c = cs[cs.length - 1 - (servedLag && cs.length > 1 ? 1 : 0)];
      if (!c) return err(404, "not_found", "no deployment serves that host");
      return json(200, { uid: `dpl_${c.sha.slice(0, 8)}_served`, readyState: "READY", target: "production", meta: { githubCommitSha: c.sha } });
    }
    if (method === "GET" && p === "/v6/deployments") {
      const proj = byIdOrName(url.searchParams.get("projectId"));
      if (!proj || !proj.link) return json(200, { deployments: [] });
      const r = github.store.get(`${proj.link.org}/${proj.link.repo}`);
      const after = r ? r.commits.slice(proj.linkedAt) : [];
      const sha = url.searchParams.get("sha");
      // Production state per commit, as Vercel answers it: held by vercel.json (ADR-1727) -> skipped (CANCELED). Built
      // under the Next preset: an app on main -> READY, no app yet -> ERROR (NEXT_NO_VERSION). Built with no preset: a
      // static site, READY. The preset a commit builds with is the one the project held when it landed (`presetFrom`).
      const all = r ? r.commits : [];
      const presetAt = (i) => (proj.presetFrom === undefined || i >= proj.presetFrom ? proj.framework : proj.createdFramework);
      const stateOf = (c) => { const i = all.indexOf(c); const upto = all.slice(0, i + 1); const h = upto.filter((x) => typeof x.hold === "boolean").pop(); if (!(h && h.hold === false)) return "CANCELED"; return presetAt(i) === "nextjs" ? (upto.some((x) => x.app) ? "READY" : "ERROR") : "READY"; };
      const target = url.searchParams.get("target");
      const prod = (target && target !== "production" ? [] : after).filter((c) => !sha || c.sha === sha).reverse().map((c, i) => ({ uid: `dpl_${c.sha.slice(0, 8)}_${i}`, readyState: stateOf(c), target: "production", createdAt: c.at ?? 0, meta: { githubDeployment: "1", githubCommitOrg: proj.link.org, githubCommitRepo: proj.link.repo, githubCommitSha: c.sha } }));
      // Every branch commit is a preview, READY unless previewState says otherwise, at a vercel.app URL.
      const previews = proj.previewDeploymentsDisabled || target === "production" ? [] : Object.entries((r && r.branches) || {}).flatMap(([b, cs]) => cs.slice(1).filter((c) => !sha || c.sha === sha)
        .map((c) => ({ uid: `dpl_prev_${c.sha.slice(0, 8)}`, readyState: previewState, target: null, url: `arc-sandbox-git-${b.replace(/[^a-z0-9]/g, "-")}.vercel.app`, meta: { githubDeployment: "1", githubCommitOrg: proj.link.org, githubCommitRepo: proj.link.repo, githubCommitSha: c.sha, githubCommitRef: b } })));
      // A rebuild from main is the newest production deployment, of main's head, when no commit filter is asked.
      const head = r && r.commits[r.commits.length - 1];
      const rebuilt = !sha && head && (!target || target === "production") ? (proj.rebuiltAt || []).map((at, i) => ({ uid: `dpl_rebuild_${i}`, readyState: stateOf(head), target: "production", createdAt: at, meta: { githubCommitSha: head.sha } })) : [];
      const prodAll = [...rebuilt, ...prod].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return json(200, { deployments: [...previews, ...prodAll] });
    }
    return err(404, "not_found", `fake vercel: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls, get decryptAsked() { return decryptAsked; } };
}
