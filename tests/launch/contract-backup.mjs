// Contract arms for the backup and restore-drill slots (ADR-1746): the REAL pg-dump and pg-restore-scratch adapters under
// the REAL ctx against the in-memory GitHub, whose pushes run every workflow main holds with the jobs each declares.
// Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-backup.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const bRow = rows.find((r) => r.id === "pg-dump");
const rRow = rows.find((r) => r.id === "pg-restore-scratch");
if (!bRow || !rRow) { console.error("no pg-dump or pg-restore-scratch row in the registry"); process.exit(1); }
const backup = await import(pathToFileURL(join(PRODUCT, bRow.adapter)).href);
const restore = await import(pathToFileURL(join(PRODUCT, rRow.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const github = makeGithub({
  repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }], secrets: scenario === "no-db-url" ? [] : ["SUPABASE_DB_URL"] }],
  jobConclusions: { "restore-red": { restore: "failure" }, "backup-red": { dump: "failure", restore: "skipped" } }[scenario] || {},
});
globalThis.fetch = github.fetch;
const ROOT = mkdtempSync(join(tmpdir(), "launch-backup-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const bState = [];
const rState = [];
const ctxFor = (slot, row, state, upstream) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } }, board: {}, slot: { id: slot }, row,
  root: ROOT, resources: state, upstream, tag: `arc-sandbox@${slot}@${row.id}`, attempt: 1, signal: undefined, env: { GITHUB_TOKEN: "gho_fixtureToken0123456789" },
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const UP = { database: [{ kind: "supabase-project", id: "fixtureref0000000001" }], orm: [{ kind: "orm-schema", id: `${FULL}:${"b".repeat(40)}` }] };
const bCtx = (up = UP) => ctxFor("backup", bRow, bState, up);
const rCtx = (up) => ctxFor("restore-drill", rRow, rState, up || { backup: bState });
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (p) => (repo().files[p] ? Buffer.from(repo().files[p].content, "base64").toString("utf8") : null);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("backup:")).length;

const out = { scenario };
switch (scenario) {
  case "thread": {
    out.verifyBefore = (await backup.verify(bCtx())).ok;
    out.first = (await attempt(() => backup.scaffold(bCtx()))).ok;
    out.second = (await attempt(() => backup.scaffold(bCtx()))).ok;
    out.commits = commits();
    out.kinds = bState.map((r) => r.kind);
    const wf = text(".github/workflows/backup-drill.yml");
    // The drill's shape, read as text: one job, a checksum check, the count diff that fails it, and no upload of the dump.
    out.workflow = {
      jobs: [...wf.matchAll(/^  ([a-z]+):$/gm)].map((m) => m[1]),
      noUpload: !wf.includes("upload-artifact"),
      checksum: wf.includes("sha256sum -c dump.sha256"),
      diff: wf.includes("diff counts.src counts.dst"),
      secretOnly: wf.includes("${{ secrets.SUPABASE_DB_URL }}") && !/postgres(ql)?:\/\/[^@\s]*:[^@\s]*@(?!localhost)/.test(wf),
      tabs: wf.includes("\t"),
    };
    out.verify = await backup.verify(bCtx());
    out.rScaffold = (await attempt(() => restore.scaffold(rCtx()))).ok;
    out.rKinds = rState.map((r) => r.kind);
    out.rVerify = await restore.verify(rCtx());
    out.teardown = (await backup.teardown(bCtx())).steps.map((s) => s.action).concat((await restore.teardown(rCtx())).steps.map((s) => s.action));
    break;
  }
  case "restore-red":
  case "backup-red":
  case "no-db-url":
    await backup.scaffold(bCtx());
    await restore.scaffold(rCtx());
    out.verify = await backup.verify(bCtx());
    out.rVerify = await restore.verify(rCtx());
    break;
  case "cancelled-newer": {
    // A newer cancelled run must not mask the older green one (b6ffd12 B6).
    await backup.scaffold(bCtx());
    await restore.scaffold(rCtx());
    const r = repo().runs[0];
    repo().runs.unshift({ ...r, id: r.id + 1, conclusion: "cancelled", created_at: new Date(Date.now() + 1000).toISOString() });
    out.verify = await backup.verify(bCtx());
    out.rVerify = await restore.verify(rCtx());
    break;
  }
  case "foreign-drill": {
    // The owner rewrites the drill file and every later run is of theirs: restore-drill does not trust it (b6ffd12 B5).
    await backup.scaffold(bCtx());
    await restore.scaffold(rCtx());
    const p = ".github/workflows/backup-drill.yml";
    repo().files[p] = { sha: "d".repeat(40), content: Buffer.from("name: mine\n").toString("base64") };
    repo().commits.push({ sha: "d".repeat(40), message: "owner drill", files: { [p]: "d".repeat(40) } });
    for (const run of repo().runs) run.head_sha = "d".repeat(40);
    out.rVerify = await restore.verify(rCtx());
    break;
  }
  case "stale": {
    await backup.scaffold(bCtx());
    await restore.scaffold(rCtx());
    for (const run of repo().runs) run.created_at = new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString();
    out.verify = await backup.verify(bCtx());
    out.rVerify = await restore.verify(rCtx());
    break;
  }
  case "no-upstream":
    out.backup = await attempt(() => backup.scaffold(bCtx({ database: UP.database })));
    out.restore = await attempt(() => restore.scaffold(rCtx({ backup: [{ kind: "github-workflow", id: `${FULL}:.github/workflows/arc-ci.yml` }] })));
    out.noDigest = await attempt(() => restore.scaffold(rCtx({ backup: [{ kind: "github-workflow", id: `${FULL}:.github/workflows/backup-drill.yml` }] })));
    out.calls = github.calls.length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
