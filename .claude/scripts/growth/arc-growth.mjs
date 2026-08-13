// arc-growth -- the growth lane's command surface.
//
//   arc-growth mine     --sources F --out F [--sitemap URL|--sitemap-file F] [--offline]
//   arc-growth cluster  --candidates F --cluster-id c-NNN --out F [--request]
//   arc-growth generate --cluster-id c-NNN --plan F
//
// E2 (Tier E, unamendable): there is NO promote, publish, merge or deploy verb here, and its
// absence is the enforcement -- a verb that does not exist cannot be invoked by a mistake, a
// retry loop or a mutant. Publishing is the human's, through a PR merge (ADR-1002).
//
// `generate` exists in this phase ONLY to hold gate 1 (ADR-1012): it refuses an unapproved
// cluster. The generation itself lands in Phase 03 behind the same door.

import { readFileSync, writeFileSync } from "node:fs";
import { loadSources, mine, MineError } from "./lib/mine.mjs";
import {
  fakeResolver, httpResolver, partitionByEvidence,
  ownTargetsFromSitemap, httpSitemapReader, EvidenceError,
} from "./lib/evidence.mjs";
import { buildClusterPlan, planSha, assertClusterApproved, ClusterError } from "./lib/cluster.mjs";
import { hnAlgoliaAdapter, manualAdapter, hnAlgoliaVerifier } from "./lib/adapters.mjs";

const argv = process.argv.slice(2);
const verb = argv[0];

function flag(name, fallback = undefined) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  // A flag whose value is the next flag has swallowed it. `.claude/rules/lanes.md` records this
  // exact bug costing a lane its evidence path, so it is refused rather than accepted as empty.
  if (v === undefined || v.startsWith("--"))
    die("BAD_ARGS", `--${name} needs a value (got ${v === undefined ? "end of args" : JSON.stringify(v)})`);
  return v;
}
const has = (name) => argv.includes(`--${name}`);

function die(code, message) {
  process.stderr.write(`arc-growth: ${code} -- ${message}\n`);
  process.exit(2);
}

function readOrDie(path, what) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    die("NO_FILE", `cannot read ${what} at ${path}: ${e.message}`);
  }
}

async function cmdMine() {
  const sourcesPath = flag("sources");
  const outPath = flag("out");
  if (!sourcesPath || !outPath) die("BAD_ARGS", "mine needs --sources F and --out F");
  const cfg = loadSources(readOrDie(sourcesPath, "source list"));

  let ownTargets = new Set();
  const sitemapFile = flag("sitemap-file");
  const sitemapUrl = flag("sitemap");
  if (sitemapFile) ownTargets = ownTargetsFromSitemap(readOrDie(sitemapFile, "sitemap"));
  else if (sitemapUrl) ownTargets = ownTargetsFromSitemap(await httpSitemapReader()(sitemapUrl));
  // No sitemap is legitimate only before the site has one. It is announced, because an exclusion
  // list that is silently empty makes the miner propose keywords the site already owns.
  else process.stderr.write("arc-growth: NOTE -- no sitemap given, so the own-pages exclusion is EMPTY this run\n");

  const offline = has("offline");
  // Wired by ACCESS METHOD, not by a hardcoded id list: a new manual source added to the file
  // works without a code change, and an enabled source whose method has no adapter fails loudly
  // in mine() rather than contributing a silent zero.
  const adapters = {};
  for (const s of cfg.sources.filter((x) => x.enabled)) {
    if (s.access.method === "manual-entry") adapters[s.id] = manualAdapter();
    else if (s.id === "hn-algolia") adapters[s.id] = hnAlgoliaAdapter({ offline });
  }
  const candidates = await mine({ cfg, adapters, ownTargets });

  // Criterion 5, the live half: a link that does not resolve cannot enter the proposal. Done here,
  // before anything is written, so the candidates file itself is already clean.
  // Dispatch to the source's own verifier where it has one, falling back to a plain HTTP check.
  const perSource = { "hn-algolia": hnAlgoliaVerifier() };
  const fallback = httpResolver();
  const resolve = offline
    ? fakeResolver(Object.fromEntries(candidates.map((c) => [c.evidence_url, true])))
    : (url, c, allUrls) => (perSource[c && c.source_id] ?? fallback)(url, c, allUrls);
  const { live, dead, unknown } = await partitionByEvidence(candidates, resolve);
  for (const d of dead)
    process.stderr.write(`arc-growth: DROPPED ${JSON.stringify(d.keyword)} -- evidence ${d.evidence_url} is gone (status ${d._status})\n`);
  for (const u of unknown)
    process.stderr.write(`arc-growth: UNKNOWN ${JSON.stringify(u.keyword)} -- evidence ${u.evidence_url} could not be checked (status ${u._status})\n`);

  writeFileSync(outPath, live.map((c) => JSON.stringify(c)).join("\n") + (live.length ? "\n" : ""), "utf8");
  process.stdout.write(`mined ${live.length} candidate(s) from ${cfg.sources.filter((s) => s.enabled).length} enabled source(s); ${dead.length} gone; ${unknown.length} unverifiable; own-page exclusions ${ownTargets.size}\n`);

  // MISSING is not zero. A pool that lost rows to "could not check" is NOT the same pool as one
  // that lost them to "this page is gone", and continuing as though it were is how a thin market
  // gets manufactured out of a rate limit. The run stops and says so; --accept-unknown is the
  // explicit, recorded way to proceed without them.
  if (unknown.length > 0 && !has("accept-unknown")) {
    process.stderr.write(
      `arc-growth: STOP -- ${unknown.length} candidate(s) could not be verified either way. ` +
      `They are excluded from ${outPath}. Re-run (rate limits pass) or pass --accept-unknown to ` +
      `proceed knowingly without them.\n`,
    );
    process.exit(3);
  }
}

function cmdCluster() {
  const candPath = flag("candidates");
  const clusterId = flag("cluster-id");
  const outPath = flag("out");
  if (!candPath || !clusterId || !outPath) die("BAD_ARGS", "cluster needs --candidates F --cluster-id c-NNN --out F");
  const lines = readOrDie(candPath, "candidates").split("\n").filter((l) => l.trim() !== "");
  const candidates = lines.map((l, i) => {
    try {
      return JSON.parse(l);
    } catch (e) {
      die("BAD_CANDIDATES", `line ${i + 1} of ${candPath} is not JSON: ${e.message}`);
    }
  });
  const plan = buildClusterPlan({ candidates, clusterId });
  const sha = planSha(plan);
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
  process.stdout.write(`cluster ${clusterId}: 1 pillar + ${plan.spokes.length} spokes + ${plan.bofu.length} BOFU\nplan_sha ${sha}\n`);
  // The inbox item is emitted by the caller through arc-event, not from here: arc-event is the
  // ONE writer to the spine and this surface is a reader. The exact command is printed so the
  // provenance stays obvious, and NO url appears in the payload (no raw URLs on the spine).
  process.stdout.write(
    `\nSend it for approval (gate 1 of 2):\n  arc-event.sh emit approval.requested --payload ` +
    JSON.stringify(JSON.stringify({
      gate: "cluster",
      what: `approve cluster ${clusterId} (1 pillar + ${plan.spokes.length} spokes + ${plan.bofu.length} BOFU) for generation`,
      cluster_id: clusterId,
      plan_sha: sha,
    })) + "\n",
  );
}

async function cmdGenerate() {
  const clusterId = flag("cluster-id");
  const planPath = flag("plan");
  if (!clusterId || !planPath) die("BAD_ARGS", "generate needs --cluster-id c-NNN and --plan F");
  const plan = JSON.parse(readOrDie(planPath, "cluster plan"));
  const sha = planSha(plan);

  // Reader-only: the spine is read through its public query API, never by opening a day file.
  const { query } = await import("../hq/spine.mjs");
  const { spineRoot } = await import("../hq/lib/spine-io.mjs");
  const events = (await query(spineRoot(), {})).events;

  const approvalId = assertClusterApproved({ events, clusterId, planSha: sha });
  process.stdout.write(`cluster ${clusterId} approved by ${approvalId} for plan ${sha.slice(0, 12)}\n`);
  process.stdout.write("generation itself lands in Phase 03; this phase ships the gate that guards it\n");
}

const COMMANDS = { mine: cmdMine, cluster: cmdCluster, generate: cmdGenerate };

async function main() {
  const fn = COMMANDS[verb];
  if (!fn) die("BAD_ARGS", `unknown command ${JSON.stringify(verb ?? "")} (mine | cluster | generate)`);
  await fn();
}

main().catch((e) => {
  if (e instanceof MineError || e instanceof EvidenceError || e instanceof ClusterError) die(e.code, e.message);
  die("UNEXPECTED", e && e.stack ? e.stack : String(e));
});
