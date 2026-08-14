// arc-growth -- the growth lane's command surface.
//
//   arc-growth mine     --sources F --out F [--sitemap URL|--sitemap-file F] [--offline]
//   arc-growth cluster  --candidates F --cluster-id c-NNN --out F [--request]
//   arc-growth generate --cluster-id c-NNN --plan F
//
// E2 (Tier E, unamendable): there is NO promote, publish, merge or deploy verb here, and its
// absence is the enforcement -- a verb that does not exist cannot be invoked by a mistake, a
// retry loop or a mutant. Publishing is the human's, through a PR merge (ADR-1102).
//
// `generate` exists in this phase ONLY to hold gate 1 (ADR-1112): it refuses an unapproved
// cluster. The generation itself lands in Phase 03 behind the same door.

import { readFileSync, writeFileSync } from "node:fs";
import { loadSources, mine, assertCandidate, MineError } from "./lib/mine.mjs";
import {
  fakeResolver, httpResolver, partitionByEvidence,
  ownTargetsFromSitemap, httpSitemapReader, EvidenceError,
} from "./lib/evidence.mjs";
import { buildClusterPlan, planSha, assertClusterApproved, ClusterError } from "./lib/cluster.mjs";
import { hnAlgoliaAdapter, manualAdapter, hnAlgoliaVerifier } from "./lib/adapters.mjs";

const argv = process.argv.slice(2);
const verb = argv[0];

const VALUE_FLAGS = ["sources", "out", "sitemap", "sitemap-file", "candidates", "cluster-id", "plan"];
const BARE_FLAGS = ["offline", "accept-unknown"];

function flag(name, fallback = undefined) {
  const hits = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) hits.push(i);
  if (hits.length === 0) return fallback;
  // Two values for one flag is an OPERATOR ERROR, not a last-wins or first-wins override.
  // `.claude/rules/lanes.md` settled this: silently picking one of two named values is the
  // "never guess" failure. Taking the FIRST was worse than either -- the file the operator named
  // last was not the file written.
  if (hits.length > 1)
    die("BAD_ARGS", `--${name} given ${hits.length} times; pick one (values: ${hits.map((i) => JSON.stringify(argv[i + 1])).join(", ")})`);
  const v = argv[hits[0] + 1];
  // A flag whose value is the next flag has swallowed it. `.claude/rules/lanes.md` records this
  // exact bug costing a lane its evidence path, so it is refused rather than accepted as empty.
  if (v === undefined || v.startsWith("--"))
    die("BAD_ARGS", `--${name} needs a value (got ${v === undefined ? "end of args" : JSON.stringify(v)})`);
  // An EMPTY value is an unset shell variable that was correctly quoted. Accepting it made
  // `--sitemap-file ""` disable the own-page exclusion while the run printed "no sitemap given",
  // which is a lie about what the operator asked for.
  if (v.trim() === "") die("BAD_ARGS", `--${name} was given an empty value (an unset shell variable?)`);
  return v;
}
const has = (name) => argv.includes(`--${name}`);

/** Anything unrecognised is refused. `--offline=true` silently ran ONLINE, and a typo in
 *  `--accept-unknown` was a no-op: both safety flags failed toward the less safe behaviour. */
function assertKnownFlags() {
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const name = a.slice(2);
    if (BARE_FLAGS.includes(name)) continue;
    if (VALUE_FLAGS.includes(name)) { i++; continue; }
    die("BAD_ARGS", `unknown option ${JSON.stringify(a)} (known: ${[...VALUE_FLAGS.map((f) => "--" + f), ...BARE_FLAGS.map((f) => "--" + f)].join(" ")})`);
  }
}

function die(code, message) {
  process.stderr.write(`arc-growth: ${code} -- ${message}\n`);
  process.exit(2);
}

// Windows resolves a trailing dot or space away and maps these names to devices, while Node's
// long-path semantics happily create them -- so `--out nul` made a file no ordinary tool can read
// and `--out a.jsonl.` made one that every other program resolves to `a.jsonl`. A downstream
// reader then silently gets the previous file.
const WIN_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;
function assertWritablePath(p, what) {
  const base = p.split(/[\\/]/).pop() ?? "";
  if (base === "") die("BAD_ARGS", `--${what} names a directory, not a file`);
  if (WIN_RESERVED.test(base))
    die("BAD_ARGS", `--${what} ${JSON.stringify(p)} is a Windows reserved device name`);
  if (/[. ]$/.test(base))
    die("BAD_ARGS", `--${what} ${JSON.stringify(p)} ends in a dot or space, which Windows silently strips`);
  return p;
}

function readOrDie(path, what) {
  try {
    // A BOM is what PowerShell Out-File and Notepad write by default on the primary platform,
    // and it made JSON.parse fail with an invisible character in the message.
    return readFileSync(path, "utf8").replace(/^﻿/, "");
  } catch (e) {
    die("NO_FILE", `cannot read ${what} at ${path}: ${e.message}`);
  }
}

function parseJsonOrDie(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    die("BAD_JSON", `${what} is not valid JSON: ${e.message}`);
  }
}

async function cmdMine() {
  const sourcesPath = flag("sources");
  const outPath = flag("out");
  if (!sourcesPath || !outPath) die("BAD_ARGS", "mine needs --sources F and --out F");
  assertWritablePath(outPath, "out");
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
  const { candidates, ownExcluded } = await mine({ cfg, adapters, ownTargets });

  // Criterion 5, the live half: a link that does not resolve cannot enter the proposal. Done here,
  // before anything is written, so the candidates file itself is already clean.
  // Dispatch to the source's own verifier where it has one, falling back to a plain HTTP check.
  const perSource = { "hn-algolia": hnAlgoliaVerifier() };
  const fallback = httpResolver();
  // OFFLINE DOES NOT MEAN VERIFIED. The first version handed the fake resolver a map that marked
  // every candidate live, so `--offline` printed "0 gone; 0 unverifiable" and wrote a candidates
  // file indistinguishable from a checked one -- criterion 5 turned into a no-op by a flag. An
  // empty map means everything comes back UNKNOWN, which is the truth, and the STOP below then
  // forces the operator to say --accept-unknown out loud.
  const resolve = offline
    ? fakeResolver({})
    : (url, c, allUrls) => (perSource[c && c.source_id] ?? fallback)(url, c, allUrls);
  const { live, dead, unknown } = await partitionByEvidence(candidates, resolve);
  for (const d of dead)
    process.stderr.write(`arc-growth: DROPPED ${JSON.stringify(d.keyword)} -- evidence ${d.evidence_url} is gone (status ${d._status})\n`);
  for (const u of unknown)
    process.stderr.write(`arc-growth: UNKNOWN ${JSON.stringify(u.keyword)} -- evidence ${u.evidence_url} could not be checked (status ${u._status})\n`);

  writeFileSync(outPath, live.map((c) => JSON.stringify(c)).join("\n") + (live.length ? "\n" : ""), "utf8");
  // Both numbers, separately labelled. "Read 2 own pages and excluded 0" and "read 2 and excluded
  // 12" are opposite outcomes that the single old number could not tell apart.
  process.stdout.write(`mined ${live.length} candidate(s) from ${cfg.sources.filter((s) => s.enabled).length} enabled source(s); ${dead.length} gone; ${unknown.length} unverifiable; own pages read ${ownTargets.size}; candidates excluded as own ${ownExcluded}\n`);

  // MISSING is not zero. A pool that lost rows to "could not check" is NOT the same pool as one
  // that lost them to "this page is gone", and continuing as though it were is how a thin market
  // gets manufactured out of a rate limit. The run stops and says so; --accept-unknown is the
  // explicit, recorded way to proceed without them.
  // An EMPTY candidates file with exit 0 is the worst of all outcomes: `cluster` then reports
  // THIN_CLUSTER "have 0" and blames the market for what was actually a broken run.
  if (live.length === 0) {
    process.stderr.write(`arc-growth: STOP -- the run produced NO usable candidates (${dead.length} gone, ${unknown.length} unverifiable). That is a broken run, not a quiet market.\n`);
    process.exit(4);
  }

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
  assertWritablePath(outPath, "out");
  const lines = readOrDie(candPath, "candidates").split("\n").filter((l) => l.trim() !== "");
  // THE CLI IS A DOOR, so it validates. cluster.mjs documented that every candidate reaching it
  // had already passed assertCandidate -- and this path handed straight-from-JSON.parse rows to
  // the plan builder, so the claim was false exactly where a hand-edited competitor-gap file
  // enters. A row missing a field also used to produce a plan whose sha at cluster time differed
  // from its sha at generate time, dead-locking the gate with a message telling the operator to
  // re-approve, which could never work.
  const candidates = lines.map((l, i) => {
    let row;
    try {
      row = JSON.parse(l);
    } catch (e) {
      die("BAD_CANDIDATES", `line ${i + 1} of ${candPath} is not JSON: ${e.message}`);
    }
    try {
      return assertCandidate(row);
    } catch (e) {
      die(e.code || "BAD_CANDIDATES", `line ${i + 1} of ${candPath}: ${e.message}`);
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
  const plan = parseJsonOrDie(readOrDie(planPath, "cluster plan"), "the cluster plan");
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
  const fn = Object.hasOwn(COMMANDS, verb) ? COMMANDS[verb] : undefined;
  if (typeof fn !== "function") die("BAD_ARGS", `unknown command ${JSON.stringify(verb ?? "")} (${Object.keys(COMMANDS).join(" | ")})`);
  assertKnownFlags();
  await fn();
}

main().catch((e) => {
  if (e instanceof MineError || e instanceof EvidenceError || e instanceof ClusterError) die(e.code, e.message);
  // A SpineError carries its own code and a message written for a human -- the worktree guard's
  // message even names the directory to run from. Dumping it as UNEXPECTED with a raw stack
  // buried the one instruction the operator needed under a trace of our own internals.
  if (e && typeof e.code === "string" && typeof e.message === "string") die(e.code, e.message);
  die("UNEXPECTED", e && e.stack ? e.stack : String(e));
});
