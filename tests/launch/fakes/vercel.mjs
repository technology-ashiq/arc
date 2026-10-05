// In-memory Vercel, wired to an in-memory GitHub (fakes/github.mjs): a project linked to a repo gets one git-triggered
// deployment per commit that lands on main after the link, the way Vercel's GitHub integration answers a push.
// It replaces only the transport; `fetch` routes api.github.com to the GitHub fake. Deterministic ids from a counter.
//   cname        the CNAME Vercel recommends for any domain (null: it recommends none)
//   projects     seed projects: [{ name, link: { type, org, repo } }]
//   failDeployments  the deployments list answers 500
//   previewState     readyState of every preview deployment
export function makeVercel({ github, token = "vercel_fixture_token_0123456789", cname = "abc123.vercel-dns-017.com", projects = [], failDeployments = false, previewState = "READY" } = {}) {
  let n = 0;
  const id = (p) => `${p}_${String(++n).padStart(6, "0")}`;
  const store = new Map(projects.map((p) => [p.name, { id: id("prj"), domains: [], linkedAt: 0, ...p }]));
  const calls = [];
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
      const proj = { id: id("prj"), name: body.name, framework: body.framework, link: { type: "github", org, repo }, domains: [], linkedAt: github.store.get(body.gitRepository.repo).commits.length };
      store.set(body.name, proj);
      return json(200, proj);
    }
    let m = p.match(/^\/v9\/projects\/([^/]+)$/);
    if (m && method === "GET") { const proj = byIdOrName(m[1]); return proj ? json(200, proj) : err(404, "not_found", "Project not found"); }
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
    if (method === "GET" && p === "/v6/deployments") {
      const proj = byIdOrName(url.searchParams.get("projectId"));
      if (!proj || !proj.link) return json(200, { deployments: [] });
      const r = github.store.get(`${proj.link.org}/${proj.link.repo}`);
      const after = r ? r.commits.slice(proj.linkedAt) : [];
      const sha = url.searchParams.get("sha");
      // Production state per commit, as Vercel answers it: held by vercel.json (ADR-1727) -> skipped (CANCELED); built
      // with an app on main -> READY; built with no app yet -> ERROR. The hold and app flags are what the GitHub fake records.
      const all = r ? r.commits : [];
      const stateOf = (c) => { const upto = all.slice(0, all.indexOf(c) + 1); const h = upto.filter((x) => typeof x.hold === "boolean").pop(); return h && h.hold === false ? (upto.some((x) => x.app) ? "READY" : "ERROR") : "CANCELED"; };
      const target = url.searchParams.get("target");
      const prod = (target && target !== "production" ? [] : after).filter((c) => !sha || c.sha === sha).reverse().map((c, i) => ({ uid: `dpl_${c.sha.slice(0, 8)}_${i}`, readyState: stateOf(c), target: "production", meta: { githubDeployment: "1", githubCommitOrg: proj.link.org, githubCommitRepo: proj.link.repo, githubCommitSha: c.sha } }));
      // Every branch commit is a preview, READY unless previewState says otherwise, at a vercel.app URL.
      const previews = proj.previewDeploymentsDisabled ? [] : Object.entries((r && r.branches) || {}).flatMap(([b, cs]) => cs.slice(1).filter((c) => !sha || c.sha === sha)
        .map((c) => ({ uid: `dpl_prev_${c.sha.slice(0, 8)}`, readyState: previewState, target: null, url: `arc-sandbox-git-${b.replace(/[^a-z0-9]/g, "-")}.vercel.app`, meta: { githubDeployment: "1", githubCommitOrg: proj.link.org, githubCommitRepo: proj.link.repo, githubCommitSha: c.sha, githubCommitRef: b } })));
      return json(200, { deployments: [...previews, ...prod] });
    }
    return err(404, "not_found", `fake vercel: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls };
}
