// Contract arm for the ci slot: the REAL github-actions adapter under the REAL ctx, only the transport swapped for
// the in-memory GitHub. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-ci.mjs <scenario>
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "github-actions");
if (!row) { console.error("no github-actions row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const TAG = "arc-sandbox@ci@github-actions";
const TOKEN = "gho_fixtureToken0123456789";
const WF = ".github/workflows/arc-ci.yml";
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const seed = { name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40) }] };
const ghOpts = {
  "red-leg": { runConclusions: ["success", "failure", "success"] },
  "plan-limit": { planLimit: true },
  "verify-plan-limit": { planLimit: true },
  "absent-ruling": { planLimit: true },
  "absent-ruling-red": { planLimit: true, runConclusions: ["success", "failure", "success"] },
  "still-running": { pendingPolls: 50 },
  "owner-protection": { repos: [{ ...seed, protection: { contexts: ["lint"], strict: true, reviews: { required_approving_review_count: 2 } } }] },
  "owner-protection-no-checks": { repos: [{ ...seed, protection: { contexts: null, reviews: { required_approving_review_count: 2 } } }] },
}[scenario] || {};
const gh = makeGithub({ repos: [seed], ...ghOpts });
globalThis.fetch = gh.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-ci-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ upstream = { repo: [{ kind: "github-repo", id: FULL }] }, profile = { slug: "arc-sandbox" } } = {}) => makeCtx({
  profile, board: {}, slot: { id: "ci" }, row,
  root: ROOT, resources: reported, upstream, tag: TAG, attempt: 1, signal: undefined,
  env: { GITHUB_TOKEN: TOKEN }, report: (r) => { if (!reported.some((x) => x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => gh.store.get(FULL);

const out = { scenario };
switch (scenario) {
  case "twice":
    out.first = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    const second = await attempt(() => adapter.scaffold(ctxFor()));
    out.second = second.ok;
    out.secondKinds = second.ok ? second.value.resources.map((r) => r.kind) : [];
    out.workflowCommits = repo().commits.filter((c) => c.files && c.files[WF]).length;
    out.tagged = repo().commits.filter((c) => c.files && c.files[WF]).every((c) => c.message.includes(`Arc-Launch-Tag: ${TAG}`));
    out.contexts = repo().protection && repo().protection.contexts;
    out.local = existsSync(join(ROOT, WF)) && readFileSync(join(ROOT, WF), "utf8") === Buffer.from(repo().files[WF].content, "base64").toString("utf8");
    out.reported = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctxFor());
    break;
  case "owner-edited": {
    await adapter.scaffold(ctxFor());
    repo().files[WF] = { sha: "e".repeat(40), content: Buffer.from("name: hand-edited\n").toString("base64") };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.restored = Buffer.from(repo().files[WF].content, "base64").toString("utf8") === readFileSync(join(ROOT, WF), "utf8");
    out.lastTagged = repo().commits[repo().commits.length - 1].message.includes(`Arc-Launch-Tag: ${TAG}`);
    break;
  }
  case "stale-run":
    // A commit lands on main after the workflow's run: the green run is for an older head and must not answer.
    await adapter.scaffold(ctxFor());
    repo().commits.push({ sha: "b".repeat(40), message: "hand push", files: {} });
    out.verify = await adapter.verify(ctxFor());
    break;
  case "branch-run":
    // The only run for main's head ran on another branch: the branch filter keeps it out.
    await adapter.scaffold(ctxFor());
    repo().runs[0].branch = "feature";
    out.verify = await adapter.verify(ctxFor());
    break;
  case "still-running":
    await adapter.scaffold(ctxFor());
    out.verify = await adapter.verify(ctxFor());
    break;
  case "owner-protection":
  case "owner-protection-no-checks":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.protection = repo().protection;
    out.reported = reported.map((r) => r.kind);
    break;
  case "verify-plan-limit":
    out.verify = await attempt(() => adapter.verify(ctxFor()));
    break;
  case "verify-refusals": {
    // Every coded refusal inside verify comes back as an answer, never a throw.
    const ctx = ctxFor();
    out.badToken = await attempt(() => adapter.verify({ ...ctx, env: { GITHUB_TOKEN: "short" } }));
    out.noUpstream = await attempt(() => adapter.verify(ctxFor({ upstream: {} })));
    break;
  }
  case "foreign-workflow": {
    // The owner committed launch's exact workflow by hand after launch did: same bytes, newest commit has no trailer.
    await adapter.scaffold(ctxFor());
    const r = repo();
    r.commits.push({ sha: "c".repeat(40), message: "copy the workflow", files: { [WF]: r.files[WF].sha } });
    reported.length = 0;
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.reported = reported.map((x) => x.kind);
    break;
  }
  case "bad-token": {
    const ctx = ctxFor();
    out.scaffold = await attempt(() => adapter.scaffold({ ...ctx, env: { GITHUB_TOKEN: `gho_fixture${String.fromCharCode(10)}Token0123456789` } }));
    out.calls = gh.calls.length;
    out.leaked = out.scaffold.message.includes("Token0123456789");
    break;
  }
  case "red-leg":
    await adapter.scaffold(ctxFor());
    out.verify = await adapter.verify(ctxFor());
    break;
  case "unprotected":
    await adapter.scaffold(ctxFor());
    repo().protection = null;
    out.verify = await adapter.verify(ctxFor());
    break;
  case "plan-limit":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.reported = reported.map((r) => r.kind);
    break;
  case "bad-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: { repo: [{ kind: "github-repo", id: "../../evil" }] } })));
    out.calls = gh.calls.length;
    break;
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: {} })));
    break;
  case "absent-ruling":
  case "absent-ruling-red": {
    // GitHub answers the plan limit and the owner ruled absent-plan (ADR-1735): the workflow stands, protection is ABSENT.
    const ruled = { profile: { slug: "arc-sandbox", ci_protection: "absent-plan" } };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor(ruled)));
    out.again = await attempt(() => adapter.scaffold(ctxFor(ruled)));
    out.reported = reported.map((r) => r.kind + " " + r.id);
    out.notes = out.scaffold.ok ? out.scaffold.value.notes : [];
    out.workflowCommits = repo().commits.filter((c) => c.files && c.files[WF]).length;
    out.verify = await adapter.verify(ctxFor(ruled));
    out.teardown = await adapter.teardown(ctxFor(ruled));
    break;
  }
  case "absent-ruling-no-limit": {
    // The plan grants protection: the ruling changes nothing, protection is created, and an unprotected main is not ok.
    const ruled = { profile: { slug: "arc-sandbox", ci_protection: "absent-plan" } };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor(ruled)));
    out.reported = reported.map((r) => r.kind);
    out.contexts = repo().protection && repo().protection.contexts;
    out.verify = await adapter.verify(ctxFor(ruled));
    repo().protection = null;
    out.unprotected = await adapter.verify(ctxFor(ruled));
    break;
  }
  case "bad-ruling": {
    const bad = { profile: { slug: "arc-sandbox", ci_protection: "absent" } };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor(bad)));
    out.calls = gh.calls.length;
    out.verify = await attempt(() => adapter.verify(ctxFor(bad)));
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
