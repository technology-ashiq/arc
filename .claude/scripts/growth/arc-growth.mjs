// arc-growth -- the growth lane's command surface.
//
//   arc-growth mine     --sources F --out F [--sitemap URL|--sitemap-file F] [--offline]
//   arc-growth cluster  --candidates F --cluster-id c-NNN --out F [--request]
//   arc-growth generate --cluster-id c-NNN --plan F --keyword K --out F
//   arc-growth render   --draft F --plan F --out F
//   arc-growth lint     --file F [--markers F] [--offline]
//   arc-growth publish  <slug> --article F --plan F --preview URL [--out F]
//
// E2 (Tier E, unamendable): there is no promote, MERGE, deploy or ship verb here, and there is no
// path to one -- `exec-allowlist.mjs` is the single module that may spawn anything, `guard.mjs`
// PARSES the module graph to prove it, and a running mutant attempts three escapes that must each
// be refused BY NAME.
//
// `publish` exists and is supposed to: ADR-1102 names it verbatim -- *"arc growth publish <slug>
// creates a branch and a PR. It has no merge path and no default-branch push path."* Phase 02
// shipped a test banning the WORD, which contradicted the decision it was enforcing; the banned
// thing is the capability, and opening a pull request is the act that puts a human in the loop
// rather than one that bypasses them (phase-04 spec, Amendment 2026-08-14).

import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSources, mine, assertCandidate, MineError } from "./lib/mine.mjs";
import {
  fakeResolver, httpResolver, partitionByEvidence,
  ownTargetsFromSitemap, httpSitemapReader, EvidenceError,
} from "./lib/evidence.mjs";
import { buildClusterPlan, planSha, assertClusterApproved, ClusterError } from "./lib/cluster.mjs";
import { hnAlgoliaAdapter, manualAdapter, hnAlgoliaVerifier } from "./lib/adapters.mjs";
import { loadMarkers, scanSlop, renderSlopReport } from "./lib/slop-lint.mjs";
import { scanCitations, checkLinks, renderCitationReport } from "./lib/citation-lint.mjs";
import { loadExemplars, clusterRows, assemblePrompt, assertNoStylePrescription, renderMdx } from "./lib/generate.mjs";
import { assignArm } from "./lib/templates.mjs";
import { buildReviewPack, renderReviewPack, PublishError } from "./lib/publish.mjs";
import { contentShaOfBytes } from "./lib/content-sha.mjs";

// Assigned by main() once the verb is known. Every flag read goes through flag()/has(), which read
// this and nothing else -- there is no second reading of argv anywhere in the file.
let ARGS = { values: new Map(), bare: new Set(), positional: [] };

const VALUE_FLAGS = ["sources", "out", "sitemap", "sitemap-file", "candidates", "cluster-id", "plan",
  "keyword", "exemplars", "markers", "file", "draft", "article", "preview", "templates", "receipts", "week", "range-start", "range-end", "revision"];
const BARE_FLAGS = ["offline", "accept-unknown"];

// How many BARE arguments each verb takes. Declared per verb rather than globally, so `lint` still
// refuses a shell-expanded glob while `publish <slug>` keeps the argument ADR-1102 gives it.
const POSITIONALS = Object.freeze({ publish: 1, ingest: 1 });

// ---------------------------------------------------------------------------------------------
// ONE PARSE, and everything reads from it.
//
// The old parser was three functions that disagreed about the same argv. `assertKnownFlags` skipped
// every token that did not start with `--`, so anything else was validated by nobody and read by
// nobody. Three real consequences, all found by an adversarial pass on 2026-08-14:
//
//   1. `lint --file *.md` -- the shell expands the glob, `--file` takes the first path, and the
//      REST ARE SILENTLY DROPPED. Two articles with blocking findings were never opened and the
//      command exited 0 "clean". That is the one property this surface must never break.
//   2. `-offline` (one dash), `/offline`, and an em-dashed `--offline` were dropped with no error,
//      so the run went ONLINE while the operator believed it was offline. The file's own comment
//      says `--offline=true` did this once and was fixed; the twin was left standing.
//   3. `assertKnownFlags` consumed the token after a value flag while `has()` still counted it, so
//      `--candidates --offline` was simultaneously a value and a bare flag.
//
// So argv is parsed ONCE, strictly, into a structure; `flag()` and `has()` are lookups. There is no
// second reading of argv anywhere, which is what let the three disagree.
function parseArgs(args, { positionals = 0 } = {}) {
  const values = new Map();
  const bare = new Set();
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    // A token that is not `--name` is a POSITIONAL, and a verb takes only as many as it declares.
    // `publish <slug>` legitimately takes one (CLAUDE.md: a bare first argument is always the
    // command's own). Everything past that count is refused, which is the whole fix for the glob
    // case: `lint --file *.md` declares zero, so the shell-expanded extra paths become a loud
    // error instead of being read by nobody.
    if (!a.startsWith("--") || a === "--") {
      if (positional.length < positionals) { positional.push(a); continue; }
      die("BAD_ARGS", positionals === 0
        ? `unexpected argument ${JSON.stringify(a)} -- this command takes only --flags. ` +
          `A shell glob (--file *.md) expands to several paths and only the first would be read.`
        : `unexpected extra argument ${JSON.stringify(a)} -- this command takes ${positionals} bare argument(s), then only --flags`);
    }
    const name = a.slice(2);
    // `--name=value` is refused rather than parsed: accepting it here while `has()` looked for the
    // bare form is how a safety flag became a no-op.
    if (name.includes("=")) {
      const base = name.split("=")[0];
      die("BAD_ARGS", BARE_FLAGS.includes(base)
        ? `--${base} takes no value; write it bare, not ${JSON.stringify(a)}`
        : `write --${base} <value>, not ${JSON.stringify(a)}`);
    }
    if (BARE_FLAGS.includes(name)) {
      // Duplicates are an operator error for a BARE flag too. Idempotence is not the point: the
      // rule is that silently resolving a repeat is the never-guess failure, and it was enforced
      // for value flags and not for these.
      if (bare.has(name)) die("BAD_ARGS", `--${name} given more than once`);
      bare.add(name);
      continue;
    }
    if (!VALUE_FLAGS.includes(name))
      die("BAD_ARGS", `unknown option ${JSON.stringify(a)} (known: ${[...VALUE_FLAGS.map((f) => "--" + f), ...BARE_FLAGS.map((f) => "--" + f)].join(" ")})`);
    if (values.has(name))
      die("BAD_ARGS", `--${name} given more than once; pick one (values: ${JSON.stringify(values.get(name))}, ${JSON.stringify(args[i + 1])})`);
    const v = args[i + 1];
    // A flag whose value is the next flag has swallowed it. `.claude/rules/lanes.md` records this
    // exact bug costing a lane its evidence path, so it is refused rather than accepted as empty.
    if (v === undefined || v.startsWith("--"))
      die("BAD_ARGS", `--${name} needs a value (got ${v === undefined ? "end of args" : JSON.stringify(v)})`);
    // An EMPTY value is an unset shell variable that was correctly quoted. Accepting it made
    // `--sitemap-file ""` disable the own-page exclusion while the run printed "no sitemap given",
    // which is a lie about what the operator asked for.
    if (v.trim() === "") die("BAD_ARGS", `--${name} was given an empty value (an unset shell variable?)`);
    values.set(name, v);
    i++; // consume the value
  }
  return { values, bare, positional };
}

function flag(name, fallback = undefined) {
  return ARGS.values.has(name) ? ARGS.values.get(name) : fallback;
}
const has = (name) => ARGS.bare.has(name);


function die(code, message) {
  process.stderr.write(`arc-growth: ${code} -- ${message}\n`);
  process.exit(2);
}

// Windows resolves a trailing dot or space away and maps these names to devices, while Node's
// long-path semantics happily create them -- so `--out nul` made a file no ordinary tool can read
// and `--out a.jsonl.` made one that every other program resolves to `a.jsonl`. A downstream
// reader then silently gets the previous file.
// CONIN$/CONOUT$ are console devices too and were missing from this list.
const WIN_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$)(\.|$)/i;
function assertWritablePath(p, what) {
  const base = p.split(/[\\/]/).pop() ?? "";
  if (base === "") die("BAD_ARGS", `--${what} names a directory, not a file`);
  // A COLON opens an NTFS alternate data stream. `--out article.mdx:hidden` wrote 104 bytes into a
  // stream nothing reads and left a ZERO-BYTE article.mdx at the named path -- and the command
  // printed "rendered" and exited 0. git commits the empty file, the site build reads the empty
  // file, and the only artifact this whole lane produces is silently gone. This is the same class
  // as the reserved-device names above: Node writes it happily, every other tool resolves it
  // elsewhere. The other characters are Windows-invalid in a filename and mean the same thing --
  // a path that cannot be what the operator thinks it is.
  if (/[:<>"|?*]/.test(base))
    die("BAD_ARGS", `--${what} ${JSON.stringify(p)} contains ${JSON.stringify(base.match(/[:<>"|?*]/)[0])}; ` +
      `a colon opens an NTFS alternate data stream, leaving a zero-byte file at the path you named`);
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

/**
 * The RAW bytes of a file, with no decode and no BOM strip.
 *
 * `content_sha` is defined over raw bytes (ADR-1101), and `content-sha.mjs` states that the
 * approval path and the publish path "must agree byte-for-byte or `unedited := draft_sha ==
 * content_sha` compares two different functions". They did not: the draft path hashed
 * `Buffer.from(readOrDie(p), "utf8")`, which has already stripped a BOM and round-tripped the
 * bytes through a UTF-8 decode, while the publish path hashes the file. On a BOM-prefixed or
 * invalid-UTF-8 file the two disagreed, and the visible symptom would not be an error — it is a
 * second receipt for an article nobody edited, with ADR-1107's unedited counter reading a phantom
 * edit. Exactly the CRLF defect fixed in arc-site the same day, left open in the sibling reader.
 */
function readBytesOrDie(path, what) {
  try {
    return readFileSync(path);
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

  // Phase 03: past the gate, assemble the drafting prompt. The DRAFTING itself is the skill's
  // (`.claude/skills/seo-article-writer`), not this command's -- a deterministic CLI that shells
  // out to a model would be untestable and, worse, would put an unreviewable creative step inside
  // a binary that also holds a security gate. This writes the prompt; a human or an agent runs it.
  const keyword = flag("keyword");
  if (!keyword) die("BAD_ARGS", "generate needs --keyword K naming an approved row of the cluster");
  const outPath = flag("out");
  if (!outPath) die("BAD_ARGS", "generate needs --out F for the assembled prompt");
  assertWritablePath(outPath, "out");

  const exDir = flag("exemplars", "initiatives/growth/exemplars");
  let exemplars, prompt;
  try {
    exemplars = loadExemplars(exDir);
  } catch (e) {
    die(e.code || "NO_EXEMPLARS", e.message);
  }
  const rows = clusterRows(plan);
  const row = rows.find((r) => r.keyword === keyword);
  if (!row)
    die("ROW_NOT_IN_CLUSTER", `${JSON.stringify(keyword)} is not a row of ${clusterId}; approved rows are: ${rows.map((r) => r.keyword).join(" | ")}`);
  try {
    // assemblePrompt runs assertNoStylePrescription itself, on the authored template. It is not
    // re-run here on the assembled bytes: doing that scanned the operator's own approved keyword
    // and threw STYLE_PRESCRIPTION on `seo faq schema`, naming the wrong cause.
    prompt = assemblePrompt({ row, cluster: plan, exemplars });
  } catch (e) {
    die(e.code || "BAD_PROMPT", e.message);
  }
  writeFileSync(outPath, prompt, "utf8");
  process.stdout.write(
    `prompt for ${JSON.stringify(keyword)} written to ${outPath} ` +
    `(${exemplars.length} exemplar(s), ${prompt.length} bytes)\n` +
    `draft it with the seo-article-writer skill, then: arc-growth render --draft F --plan ${planPath} --out F\n`,
  );
}

/** Render a drafted body into the site's MDX shape. Separate verb, because drafting is not ours. */
function cmdRender() {
  const draftPath = flag("draft");
  const planPath = flag("plan");
  const outPath = flag("out");
  if (!draftPath || !planPath || !outPath) die("BAD_ARGS", "render needs --draft F --plan F --out F");
  assertWritablePath(outPath, "out");
  const plan = parseJsonOrDie(readOrDie(planPath, "cluster plan"), "the cluster plan");
  const draft = parseJsonOrDie(readOrDie(draftPath, "draft"), "the draft");
  if (draft === null || typeof draft !== "object" || Array.isArray(draft))
    die("BAD_DRAFT", "the draft must be a JSON object of {title, meta, slug, template_id, pubDate, body}");
  // The PLAN gets the same shape check as the draft. It did not, so a null or array plan surfaced
  // as `BAD_DRAFT -- Cannot read properties of null` and sent the operator to inspect a file that
  // was fine. The twin of a fix is where this repo keeps losing.
  if (plan === null || typeof plan !== "object" || Array.isArray(plan) || typeof plan.cluster_id !== "string")
    die("BAD_PLAN", `the cluster plan at ${planPath} is not a cluster plan (no cluster_id)`);
  // cluster_id comes from the PLAN, never from the draft. A draft that names its own cluster could
  // attribute an article to a cluster nobody approved, and the approval is bound to the plan.
  let mdx;
  try {
    mdx = renderMdx({
      title: draft.title, meta: draft.meta, slug: draft.slug,
      cluster_id: plan.cluster_id, template_id: draft.template_id, body: draft.body,
      // From the DRAFT, not from a clock. The publication date is a fact about the article, so a
      // re-render months later must not restamp it — and a `new Date()` here would make this
      // function's output depend on when it ran, which is the one thing a content hash cannot have.
      pubDate: draft.pubDate,
    });
  } catch (e) {
    die(e.code || "BAD_DRAFT", e.message);
  }
  writeFileSync(outPath, mdx, "utf8");
  process.stdout.write(`rendered ${outPath} for cluster ${plan.cluster_id}\n`);
}

/** Run both lints over one file and print the review-pack reports. */
async function cmdLint() {
  const file = flag("file");
  if (!file) die("BAD_ARGS", "lint needs --file F");
  const markersPath = flag("markers", "initiatives/growth/slop-markers.json");
  const text = readOrDie(file, "the article");
  // AN EMPTY ARTICLE IS NOT A CLEAN ARTICLE. A zero-byte or whitespace-only file used to print
  // "No marker matched" and exit 0, which is "could not scan" reported as "scanned clean" -- the
  // one property this surface must never break. A truncated or half-written draft reached the
  // review pack indistinguishable from a real one that passed.
  if (text.trim() === "")
    die("EMPTY_ARTICLE", `${file} is empty or whitespace only -- there is nothing to lint, and reporting that as clean would be a lie`);
  let markers;
  try {
    markers = loadMarkers(readOrDie(markersPath, "the marker list"));
  } catch (e) {
    die(e.code || "BAD_MARKERS", e.message);
  }

  const slop = scanSlop(text, markers);
  const claims = scanCitations(text);
  // Links are checked only when the run is online. `--offline` reports that they were NOT checked
  // rather than reporting them fine: an unchecked link is not a live one (the 429 lesson).
  const linkResult = has("offline")
    ? null
    : await checkLinks(text, httpResolver());

  process.stdout.write(renderSlopReport(slop) + "\n\n");
  process.stdout.write(renderCitationReport(claims, linkResult) + "\n");
  process.stdout.write(`\n${POV_FLOOR_LINE}\n`);

  // Exit code carries the verdict; WARNs never change it. A dead link is the web's weather.
  const fails = slop.findings.length + claims.findings.filter((f) => f.level === "FAIL").length;
  if (fails > 0) {
    process.stderr.write(`arc-growth: LINT_FAIL -- ${fails} finding(s) that block the review pack\n`);
    process.exit(5);
  }
}

// Criterion 7. The POV floor is a HUMAN line in the review pack and never a regex (ADR-1110): a
// marker list cannot tell an original stance from a confident sentence, and a lint that claimed to
// would be the prescriptive turn arriving in disguise. It is printed by the lint command so it
// travels with the report the reviewer actually reads.
export const POV_FLOOR_LINE =
  "POV FLOOR (human, not a lint): name the one original practitioner insight in this draft -- " +
  "something arc learned by doing, not restated from the sources. If you cannot name it, the " +
  "draft does not pass, and no lint above can tell you that.";

// EXPORTED so a test can ask the module what it registered instead of grepping the source for an
// object literal. The E2 "no publishing verb" assertion used to be
// `grep -o 'const COMMANDS = {[^}]*}'`, and an adversarial pass walked a mutant straight past it:
// one appended line, `COMMANDS.publish = fn`, registers a fully reachable verb that the grep cannot
// see. The literal is not the only way to register -- `Object.assign` and `defineProperty` are two
// more. A guard on a Tier E unamendable rule cannot be a substring search of its own source, which
// is this repo's oldest recurring defect (grep where a parse was needed).
/**
 * `publish <slug>` -- REQ-03. Assemble the review pack and print the exact branch/PR commands.
 *
 * IT DOES NOT SPAWN ANYTHING ITSELF. The commands are printed for the operator, and the only
 * module in this lane that may spawn is `exec-allowlist.mjs`, whose allowlist contains no merge,
 * no default-branch push and no deploy. That split is what makes the module-graph audit mean
 * something: this file assembles, that file executes, and the guard proves the second one cannot
 * do the forbidden thing.
 */
async function cmdPublish() {
  const slug = ARGS.positional[0];
  if (!slug) die("BAD_ARGS", "publish needs a slug: arc-growth publish <slug> --article F --plan F --preview URL");
  const articlePath = flag("article");
  const planPath = flag("plan");
  const previewUrl = flag("preview");
  if (!articlePath || !planPath) die("BAD_ARGS", "publish needs --article F and --plan F");

  const plan = parseJsonOrDie(readOrDie(planPath, "cluster plan"), "the cluster plan");
  if (plan === null || typeof plan !== "object" || Array.isArray(plan) || typeof plan.cluster_id !== "string")
    die("BAD_PLAN", `the cluster plan at ${planPath} is not a cluster plan (no cluster_id)`);
  // ONE read. The bytes that get hashed and the text that gets linted are the same bytes, decoded
  // once — not two reads seconds apart with a network round trip between them.
  //
  // The first version of the content_sha fix read the text here and the bytes again after
  // `checkLinks`, which is an `await` over the network. So the change made to stop the hash and the
  // lint disagreeing about ENCODING left them able to disagree about the FILE: an edit landing in
  // that window produced a review pack whose lint reports described different bytes than the
  // content_sha the approval binds to. Reading the bytes first also fires the BOM refusal before
  // the lints and before the network call, rather than after.
  const articleBytes = readBytesOrDie(articlePath, "the article");
  if (articleBytes.length >= 3 && articleBytes[0] === 0xef && articleBytes[1] === 0xbb && articleBytes[2] === 0xbf)
    die("BOM_IN_ARTICLE",
      `${articlePath} starts with a UTF-8 BOM. Refused rather than stripped: content_sha is over raw bytes, so stripping it here would hash something other than the file that gets published, and keeping it publishes an invisible character into the article`);
  const article = articleBytes.toString("utf8");
  if (article.trim() === "") die("EMPTY_ARTICLE", `${articlePath} is empty -- there is nothing to publish`);

  // The lints run HERE, not in review: a pack whose reports were produced by hand is a pack whose
  // reports can disagree with the file being shipped.
  let markers;
  try { markers = loadMarkers(readOrDie(flag("markers", "initiatives/growth/slop-markers.json"), "the marker list")); }
  catch (e) { die(e.code || "BAD_MARKERS", e.message); }
  const slop = scanSlop(article, markers);
  const claims = scanCitations(article);
  const linkResult = has("offline") ? null : await checkLinks(article, httpResolver());

  // Hashed from the bytes read ONCE above, never from a re-encode of the decoded string: that made
  // draft_sha and content_sha two different functions on any file carrying a BOM or a byte UTF-8
  // cannot represent.
  const contentSha = contentShaOfBytes(articleBytes);
  const templateId = assignArm(slug);

  let pack;
  try {
    pack = buildReviewPack({
      slug,
      previewUrl,
      slopReport: renderSlopReport(slop),
      citationReport: renderCitationReport(claims, linkResult),
      // The length reported is the length HASHED. `Buffer.byteLength(article, "utf8")` re-encodes
      // the decoded string, so on invalid-UTF-8 input it disagreed with the bytes content_sha was
      // taken over — a reported number that is not the measured number, in the very line that
      // prints the measurement.
      diff: `article ${articlePath} (${articleBytes.length} bytes, content_sha ${contentSha.slice(0, 12)})`,
      povLine: POV_FLOOR_LINE,
      templateId,
      contentSha,
    });
  } catch (e) {
    die(e.code || "BAD_PACK", e.message);
  }

  const blocking = slop.findings.length + claims.findings.filter((f) => f.level === "FAIL").length;
  const outPath = flag("out");
  if (outPath) { assertWritablePath(outPath, "out"); writeFileSync(outPath, renderReviewPack(pack), "utf8"); }
  process.stdout.write(renderReviewPack(pack) + "\n");
  process.stdout.write(
    `branch: growth/${slug}\n` +
    `arm: ${templateId} (sha256(slug), replay-identical -- ADR-1106)\n` +
    `content_sha: ${contentSha}\n\n` +
    `The machine does not merge. Open the PR, then a HUMAN merges it (E2, ADR-1102):\n` +
    `  git checkout -b growth/${slug}\n` +
    `  git add <the article> && git commit -m "content: ${slug}"\n` +
    `  git push -u origin growth/${slug}\n` +
    `  gh pr create --fill\n`,
  );
  if (blocking > 0) {
    process.stderr.write(`arc-growth: LINT_FAIL -- ${blocking} finding(s) block this pack\n`);
    process.exit(5);
  }
}

/** `spec-verify` -- REQ-05(a). The ADR-0408 diff, as a gate rather than a claim. */
async function cmdSpecVerify() {
  const SV = await import("./lib/spec-verify.mjs");
  const validator = await import("../hq/lib/validate-leads.mjs");
  let result;
  try { result = SV.runSpecVerify(validator); }
  catch (e) { die(e.code || "SPEC_VERIFY_FAILED", e.message); }
  const v = SV.verdict(result);
  process.stdout.write(SV.renderSpecVerify(result, v) + "\n");
  if (!v.pass) {
    process.stderr.write(`arc-growth: SPEC_DRIFT -- ${v.reason}\n`);
    process.exit(6);
  }
}

/**
 * `ingest <csv> --week ISO-WEEK` -- REQ-05(b).
 *
 * READER-ONLY, like every other verb here. It derives the receipts and prints the exact emit
 * commands; `arc-event` is the one writer to the spine (A5). Emitting from this surface would give
 * the lane a second writer, which is the thing the constitution's one-source-of-truth article
 * exists to prevent.
 */
async function cmdIngest() {
  const csvPath = ARGS.positional[0];
  const week = flag("week");
  if (!csvPath || !week) die("BAD_ARGS", "ingest needs a CSV path and --week ISO-WEEK, e.g. arc-growth ingest export.csv --week 2026-W36");
  const I = await import("./lib/ingest.mjs");

  let days, bounds, parsed;
  try {
    days = I.isoWeekDays(week);
    // The range-match guard needs the export's OWN declared range. It is a separate flag rather
    // than something sniffed out of the file, because a range this command guessed is a range it
    // cannot then verify -- and verifying a value against itself is not a check.
    const rangeStart = flag("range-start");
    const rangeEnd = flag("range-end");
    I.assertRangeMatch(rangeStart && rangeEnd ? { start: rangeStart, end: rangeEnd } : null, days);
    I.assertLagFloor(days, Date.now());
    bounds = I.istBoundsForPacificDays(days);
    parsed = I.parseGscCsv(readOrDie(csvPath, "the export"));
  } catch (e) {
    die(e.code || "INGEST_FAILED", e.message);
  }

  // A CORRECTION is an explicit act, never inferred. `--revision 2` says out loud that this is a
  // second read of the same week, which is what gives the receipt a distinct idem (ADR-1117) --
  // without it a re-ingest with different numbers hashes identically and is dropped as DUP_IDEM.
  const revRaw = flag("revision", "1");
  const revision = Number(revRaw);
  if (!Number.isInteger(revision) || revision < 1)
    die("BAD_ARGS", `--revision must be an integer >= 1, got ${JSON.stringify(revRaw)}`);

  const receiptsPath = flag("receipts");
  const receipts = receiptsPath ? parseJsonOrDie(readOrDie(receiptsPath, "the content.published receipts"), "the receipts file") : [];
  // Each entry is an EVENT projection -- the payload fields PLUS the event `id` and its
  // event-level `supersedes` -- not a bare payload. `supersedes` is not an allowed payload key
  // (the shape is closed to eight fields), so a file of bare payloads can never express a chain;
  // `resolveSlugUrl` now refuses one loudly rather than treating every receipt as a head.
  if (!Array.isArray(receipts))
    die("BAD_RECEIPTS", "--receipts must be a JSON array of content.published event projections: the payload fields plus the event id and supersedes");
  const { joined, unjoined } = I.resolveSlugUrl(parsed.rows, receipts);

  process.stdout.write(
    `week ${week} = ${days[0]}..${days[6]} (Pacific)\n` +
    `window ${bounds.window_start} .. ${bounds.window_end} (IST, half-open, derived from the verified PT days)\n` +
    `${parsed.rows.length} row(s); ${joined.length} joined to a content.published head; ${unjoined.length} unjoined\n`,
  );
  // An unjoined row is REPORTED, never silently dropped: dropping it is how a feed quietly
  // under-reports, and a URL with no receipt is information rather than noise.
  for (const r of unjoined) process.stderr.write(`arc-growth: UNJOINED ${r.url} -- no content.published receipt heads this URL\n`);
  // NO SITE TOTAL IS PRINTED. Search Console anonymizes low-volume rows, so a per-row sum
  // under-reports, and a total that is quietly too low is the plausible-wrong-number this whole
  // path is built against.
  for (const r of joined) {
    const payload = {
      module: "growth", surface: "title-template", metric: "clicks",
      value: r.clicks, unit_count: r.clicks,
      window_start: bounds.window_start, window_end: bounds.window_end,
      source_id: I.sourceIdFor(week, revision),
    };
    process.stdout.write(`\n# ${r.slug}\n  arc-event.sh emit metric.observed --payload ${JSON.stringify(JSON.stringify(payload))}\n`);
  }
  process.stdout.write(
    `\nThe window is MISSING until every receipt above is confirmed present in events/ and absent\n` +
    `from events/_quarantine/. A partial window is MISSING, never zero.\n`,
  );
}

export const COMMANDS = { mine: cmdMine, cluster: cmdCluster, generate: cmdGenerate, render: cmdRender, lint: cmdLint, publish: cmdPublish, ingest: cmdIngest, "spec-verify": cmdSpecVerify };

export async function main(argvIn = process.argv.slice(2)) {
  const v = argvIn[0];
  const fn = Object.hasOwn(COMMANDS, v) ? COMMANDS[v] : undefined;
  if (typeof fn !== "function") die("BAD_ARGS", `unknown command ${JSON.stringify(v ?? "")} (${Object.keys(COMMANDS).join(" | ")})`);
  // Parse AFTER the verb is known and BEFORE the command runs. One parse, one structure.
  ARGS = parseArgs(argvIn.slice(1), { positionals: POSITIONALS[v] || 0 });
  await fn();
}

// Run the CLI only when this file IS the program. Without this the module cannot be imported at
// all: `await import(...)` executed main(), which died on the importer's argv and took the host
// process with it (exit 2) -- which is precisely why the E2 test above was reduced to grepping.
//
// BOTH SIDES ARE REALPATH'd. Comparing `process.argv[1]` to `import.meta.url` directly silently
// no-ops behind a symlink, and the repo has been bitten by that shape three times; on Windows it
// also fails on drive-letter case alone.
const _isMain = (() => {
  try {
    return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false; // cannot resolve either side -> do not run as a program
  }
})();

if (_isMain) main().catch((e) => {
  if (e instanceof MineError || e instanceof EvidenceError || e instanceof ClusterError) die(e.code, e.message);
  // A SpineError carries its own code and a message written for a human -- the worktree guard's
  // message even names the directory to run from. Dumping it as UNEXPECTED with a raw stack
  // buried the one instruction the operator needed under a trace of our own internals.
  if (e && typeof e.code === "string" && typeof e.message === "string") die(e.code, e.message);
  die("UNEXPECTED", e && e.stack ? e.stack : String(e));
});
