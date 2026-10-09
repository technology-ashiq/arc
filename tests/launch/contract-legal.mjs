// Contract arms for the legal-pages slot (ADR-1745): the REAL arc-legal adapter under the REAL ctx against an in-memory
// venture site; plus the REAL worker, as the runner starts it, to prove the named ABSENT lands as state `absent`.
// Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-legal.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT, PATHS, ROOT as ARC } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { emptyState, saveState, statePath } from "../../.claude/scripts/launch/lib/state.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "arc-legal");
if (!row) { console.error("no arc-legal row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const DOMAIN = "sandbox.automemory.ai";
const LEGAL = "<html><body><!-- clause:privacy.controller -->\nWe are arc sandbox.\n<!-- /clause:privacy.controller -->\n</body></html>";
const site = {
  published: { "/privacy": [200, LEGAL], "/terms": [200, LEGAL] },
  absent: { "/": [200, "<h1>shell</h1>"] },
  dead: {},
  huge: { "/privacy": [200, "x".repeat(3 * 1024 * 1024) + LEGAL], "/terms": [200, LEGAL] },
  half: { "/privacy": [200, LEGAL] },
  foreign: { "/privacy": [200, "<html>our own policy</html>"], "/terms": [200, LEGAL] },
}[scenario] || {};
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname !== DOMAIN) throw new TypeError("fetch failed");
  const hit = site[url.pathname];
  return new Response(hit ? hit[1] : "<h1>404</h1>", { status: hit ? hit[0] : 404, headers: { "content-type": "text/html" } });
};
const ROOT = mkdtempSync(join(tmpdir(), "launch-legal-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = [];
const ctxNow = (domain = DOMAIN) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain } }, board: {}, slot: { id: "legal-pages" }, row,
  root: ROOT, resources: state, upstream: {}, tag: "arc-sandbox@legal-pages@arc-legal", attempt: 1, signal: undefined, env: {},
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});

const out = { scenario };
switch (scenario) {
  case "published":
  case "absent":
  case "dead":
  case "huge":
  case "half":
  case "foreign":
    out.scaffold = (await adapter.scaffold(ctxNow())).resources.map((r) => r.id);
    out.verify = await adapter.verify(ctxNow());
    break;
  case "host-refused":
    out.verify = await adapter.verify(ctxNow("pay.evil-example.com"));
    break;
  case "worker-absent":
  case "worker-absent-not-allowed": {
    // The real worker over a catalog whose legal-pages row allows ABSENT, or (second arm) one whose row does not.
    const dir = mkdtempSync(join(tmpdir(), "launch-legal-worker-"));
    try {
      saveState(dir, emptyState({ slug: "arc-sandbox", honesty_class: "rehearsal" }));
      let catalog = PATHS.catalog;
      if (scenario === "worker-absent-not-allowed") {
        const src = readFileSync(PATHS.catalog, "utf8");
        const edited = src.replace("\"legal.publish receipt or ABSENT: legal renderer not ready\"", "\"legal.publish receipt\"");
        if (edited === src) throw new Error("the catalog edit did not land");
        catalog = join(dir, "catalog.yaml");
        writeFileSync(catalog, edited);
      }
      const args = { catalog, registry: PATHS.registry, providersDir: PATHS.providersDir, venturesDir: PATHS.venturesDir, stateDir: dir,
        mode: "apply", venture: "arc-sandbox", slot: "legal-pages", provider: row.id, row, adapterPath: join(PRODUCT, row.adapter), ventureRoot: ROOT, attempt: 1, timeout: 60 };
      writeFileSync(join(dir, "args.json"), JSON.stringify(args));
      // The worker's fetch reaches the real network; the site answers 404 for a domain nobody serves the pages on.
      const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(ARC, "tests", "launch", "fakes", "site-404.mjs")).href, join(ARC, ".claude", "scripts", "launch", "lib", "worker.mjs"), join(dir, "args.json")], { encoding: "utf8", timeout: 60000 });
      const s = JSON.parse(readFileSync(statePath(dir, "arc-sandbox"), "utf8")).slots["legal-pages"] || {};
      out.exit = r.status;
      out.state = s.state;
      out.reason = s.reason;
      out.answerer = s.answerer || null;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);
