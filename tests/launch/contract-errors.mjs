// Contract arms for the errors slot (ADR-1747): the REAL sentry adapter under the REAL ctx. The probe route that answers
// is the one it committed, run from main's bytes by the Sentry fake, which turns its store calls into issues. Prints
// `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-errors.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeSentry } from "./fakes/sentry.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "sentry");
if (!row) { console.error("no sentry row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const opts = {
  "no-project": { projects: [{ slug: "someone-else", org: "automemory" }] },
  "two-projects": { projects: [{ slug: "arc-sandbox", org: "automemory" }, { slug: "arc-sandbox", org: "other-org" }] },
  "no-key": { keys: false },
  "no-ingest": { ingest: false },
  "swallows": { serve: (src) => src.replace("throw new Error(\"arc-launch probe \" + probe + \" \" + nonce);", "return answer(200, { ok: true });") },
}[scenario] || {};
const sentry = makeSentry({ github, full: FULL, domain: DOMAIN, inner: (i, o) => github.fetch(i, o), ...opts });
globalThis.fetch = sentry.fetch;
const ROOT = mkdtempSync(join(tmpdir(), "launch-errors-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = [];
const ENV = { SENTRY_AUTH_TOKEN: "sntrys_fixtureToken0123456789abcdef", GITHUB_TOKEN: "gho_fixtureToken0123456789" }; // gitleaks:allow
const UP = { hosting: [{ kind: "vercel-project", id: "prj_fixture01" }, { kind: "github-file", id: `${FULL}:vercel.json` }] };
const ctxNow = ({ domain = DOMAIN, upstream = UP } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } }, board: {}, slot: { id: "errors" }, row,
  root: ROOT, resources: state, upstream, tag: "arc-sandbox@errors@sentry", attempt: 1, signal: undefined, env: ENV,
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("errors:")).length;
const route = () => (repo().files["app/api/arc-error-probe/route.js"] ? Buffer.from(repo().files["app/api/arc-error-probe/route.js"].content, "base64").toString("utf8") : "");

const out = { scenario };
switch (scenario) {
  case "thread":
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.commits = commits();
    out.kinds = state.map((r) => r.kind);
    out.dsnInRoute = route().includes(sentry.DSN);
    out.verify = await adapter.verify(ctxNow());
    out.issues = sentry.issues.map((i) => `${i.title}:${i.count}`);
    out.verifyAgain = (await adapter.verify(ctxNow())).ok;
    out.issueCount = sentry.issues.length;
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "no-project":
  case "two-projects":
  case "no-key":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.commits = commits();
    break;
  case "no-ingest":
  case "swallows":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    out.issues = sentry.issues.length;
    break;
  case "host-refused":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow({ domain: "pay.evil-example.com" }));
    out.routeCalls = sentry.calls.filter((c) => c.includes("route")).length;
    break;
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { hosting: [] } })));
    out.calls = github.calls.length + sentry.calls.length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
