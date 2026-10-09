// Contract arms for the security-headers slot (ADR-1742): the REAL next-headers adapter under the REAL ctx. The live
// response headers come from the REAL `next.config.mjs` it committed (the headers fake imports main's bytes); only the
// transport is in-memory GitHub + the venture's domain + the Observatory. Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-headers.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeHeaders } from "./fakes/headers.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "next-headers");
if (!row) { console.error("no next-headers row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const ENV = { GITHUB_TOKEN: "gho_fixtureToken0123456789" };
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const opts = {
  "csp-dropped": { serve: (src) => src.replace("\"key\": \"Content-Security-Policy\"", "\"key\": \"X-Csp-Disabled\"") },
  "host-hsts": { hostHeaders: { "Strict-Transport-Security": "max-age=63072000" } },
  "grade-b": { observatory: { status: 200, grade: "B", score: 75 } },
  "rate-limited": { observatory: { status: 429 } },
  "unreachable": { observatory: "unreachable" },
  "down": { up: false },
}[scenario] || {};
const live = makeHeaders({ github, full: FULL, domain: DOMAIN, inner: (i, o) => github.fetch(i, o), ...opts });
globalThis.fetch = live.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-headers-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = [];
const UP = { hosting: [{ kind: "vercel-project", id: "prj_fixture01" }, { kind: "github-file", id: `${FULL}:vercel.json` }] };
const ctxNow = ({ domain = DOMAIN, upstream = UP } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } }, board: {}, slot: { id: "security-headers" }, row,
  root: ROOT, resources: state, upstream, tag: "arc-sandbox@security-headers@next-headers", attempt: 1, signal: undefined, env: ENV,
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("security-headers:")).length;

const out = { scenario };
switch (scenario) {
  case "thread": {
    out.verifyBefore = (await adapter.verify(ctxNow())).ok;
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.commits = commits();
    out.kinds = state.map((r) => r.kind);
    out.config = Buffer.from(repo().files["next.config.mjs"].content, "base64").toString("utf8");
    out.verify = await adapter.verify(ctxNow());
    out.observatoryCalls = live.calls.filter((c) => c.includes("observatory")).length;
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  }
  case "csp-dropped":
  case "host-hsts":
  case "grade-b":
  case "rate-limited":
  case "unreachable":
  case "down":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    break;
  case "foreign-config": {
    // The owner's own next.config.mjs is never committed over.
    repo().files["next.config.mjs"] = { sha: "c".repeat(40), content: Buffer.from("mine\n").toString("base64") };
    repo().commits.push({ sha: "c".repeat(40), message: "owner config", files: { "next.config.mjs": "c".repeat(40) } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.commits = commits();
    break;
  }
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { hosting: [{ kind: "vercel-project", id: "prj_fixture01" }] } })));
    out.calls = github.calls.length + live.calls.length;
    break;
  case "host-refused":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow({ domain: "pay.evil-example.com" }));
    out.siteCalls = live.calls.filter((c) => !c.includes("observatory")).length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
