#!/usr/bin/env node
/**
 * arc-legal -- render a venture's policy pages from one facts file and one pinned template
 * set, deterministically, with every clause traceable to the block it came from.
 *
 * Phase 00 ships one verb: `render`. Publish, verify, pins and the checklist are later phases,
 * and there is deliberately no code path here that publishes anything (REQ-06: the human gate
 * is permanent, and `hq.policy.yaml` carries `targets.publish: []`).
 *
 * EXIT CODES -- three, so "could not check" is never the same shape as "clean":
 *   0  bytes produced. TRIAL-level lint findings are printed and do not move this.
 *   2  the render could not produce trustworthy bytes: bad usage, schema violation, named
 *      parse error, canonicaliser refusal, or a FAIL in a group promoted out of TRIAL.
 *   3  could not run at all: unknown venture, unreadable facts, missing template set.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFactsYaml, YamlError } from "./lib/yaml.mjs";
import { canonicalHash, bytesHash, templateSetHash, CanonError, PREIMAGE_VERSION } from "./lib/canonical.mjs";
import { validateFacts } from "./lib/schema.mjs";
import { renderTemplate, strictestWindow, TemplateError, TRANSFORMS } from "./lib/template.mjs";
import { runAllLints, scenarioSetLint, crossPageLint, findingsAreFatal, TRIAL, GROUPS_RUN } from "./lib/lints.mjs";
import { buildChecklist, renderChecklist, renderCiGuard, guardVersionIn } from "./lib/checklist.mjs";
import {
  approvalPayload, validateApprovalPayload, verifyChain, verifyDecision,
  backdatingErrors, semanticDiff, APPROVAL_SUBJECT, TEMPLATE_SUBJECT, templateSetApprovalErrors,
  verifyPublished, VERIFY_INTACT, VERIFY_TAMPERED,
} from "./lib/receipts.mjs";

export const ENGINE_VERSION = "arc-legal/0.1.0";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const PRODUCT = join(REPO_ROOT, "products", "legal");

/**
 * The template set is PER VENTURE, resolved from that venture's `pins.yaml`, never a constant.
 *
 * It was a module constant, which meant every venture moved the moment the set moved -- the exact
 * thing pinning exists to prevent. ADR-1005 makes facts, pages, pins and receipts venture-local
 * precisely so one venture can adopt a new set while another stays put and both keep rendering.
 *
 * A MISSING pin is a REFUSAL, not a default to the newest set. Defaulting would float a venture
 * onto whatever set happens to be latest, silently, which is the failure this whole mechanism is
 * built against -- and it would look identical to a venture that had been deliberately upgraded.
 */
const SET_NAME = /^v[1-9][0-9]*$/;

function pinnedSetFor(ventureName, ventureDir) {
  const pinPath = join(ventureDir, "pins.yaml");
  if (!existsSync(pinPath))
    throw new Fail(3, `"${ventureName}" has no pins.yaml. A venture with no pinned template set would float onto whatever set is newest, which is what pinning exists to prevent. Write \`template_set: v1\` next to its facts.yaml.`);

  let pins;
  try { pins = parseFactsYaml(readFileSync(pinPath, "utf8")); }
  catch (e) {
    if (e instanceof YamlError) throw new Fail(2, `${pinPath}: ${e.message}`);
    throw e;
  }

  const set = pins.template_set;
  if (typeof set !== "string" || !SET_NAME.test(set))
    throw new Fail(2, `${pinPath}: template_set is ${JSON.stringify(set)}, which is not a set name like "v1". It is joined into a directory path.`);
  if (!existsSync(join(PRODUCT, "templates", set)))
    throw new Fail(3, `"${ventureName}" pins template set ${set}, which does not exist under products/legal/templates/. A pin to a set that is not there is a broken venture, not a reason to fall back.`);
  return set;
}

class Fail extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { throw new Fail(3, `cannot read ${path}: ${e.message}`); }
}

function usage() {
  return [
    "usage: arc-legal render  --venture NAME --out DIR",
    "       arc-legal propose --venture NAME --out DIR",
    "       arc-legal publish --venture NAME --dir DIR --decision FILE --request ULID",
    "       arc-legal verify  --venture NAME --dir DIR",
    "       arc-legal checklist --venture NAME [--out FILE] [--evidence FILE]",
    "       arc-legal bump-templates --venture NAME --to SET (--guard FILE | --no-guard)",
    "       arc-legal ci-guard --venture NAME [--out FILE] [--dir PAGES_DIR]",
    "       arc-legal propose-templates --set SET [--out FILE]",
    "",
    "  --venture NAME   a fixture venture under tests/fixtures/legal/ventures/",
    "  --out DIR        where the rendered pages are written",
    "  --dir DIR        an already-rendered directory to publish from",
    "  --decision FILE  the human decision receipt that approved those exact bytes",
    "  --request ULID   the approval.requested event that decision decides",
    "",
    "render  produces pages and lints them; it publishes nothing.",
    "propose renders and writes the approval request for a HUMAN to decide (REQ-06).",
    "publish re-derives every hash and refuses unless the decision approved these bytes.",
    "",
    "exit 0 done - exit 2 refused - exit 3 could not run",
  ].join("\n");
}

/** Flag values are separate argv entries; `--flag=value` is refused rather than half-supported. */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    if (a.startsWith("--")) {
      if (a.includes("=")) throw new Fail(2, `use \`${a.split("=")[0]} VALUE\`, not \`${a}\``);
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) throw new Fail(2, `flag ${a} has no value`);
      // Two values for one flag is an OPERATOR ERROR, not a last-wins override. The lanes rule
      // already says so for --lane ("silently picking one of two named values is precisely the
      // never-guess failure"); it had never been applied to the other flag parser in the repo.
      if (Object.prototype.hasOwnProperty.call(out, key))
        throw new Fail(2, `flag --${key} given twice (${out[key]} and ${val}). Pick one.`);
      out[key] = val;
      i++;
      continue;
    }
    out._.push(a);
  }
  return out;
}

/**
 * Phase 00 resolves a venture name to a fixture path and nothing else. A name carrying a path
 * separator or a `..` is refused BEFORE it is joined, and the resolved path is then checked to
 * be inside the fixtures root -- one confinement function, every path through it.
 */
function factsPathFor(name) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name))
    throw new Fail(3, `"${name}" is not a venture name (lowercase letters, digits and hyphens)`);
  const root = join(REPO_ROOT, "tests", "fixtures", "legal", "ventures");
  const path = resolve(root, name, "facts.yaml");
  if (path !== resolve(path) || !(path + sep).startsWith(resolve(root) + sep))
    throw new Fail(3, `"${name}" resolves outside the fixtures root`);
  if (!existsSync(path)) throw new Fail(3, `no venture "${name}" (looked for ${path})`);
  return path;
}

/**
 * The pinned RENDER INPUT set -- templates AND the data files the pages interpolate.
 *
 * This used to hash `*.tmpl.md` only, and an adversarial pass turned that into a published
 * falsehood: editing `grievance-windows.json` between approval and publish rewrote a
 * grievance commitment from "48 hours / 30 days" to "720 hours / 90 days" on the rendered page
 * while `facts_sha256` and the set hash both stayed IDENTICAL. The decision approved one number
 * and the site got the other, at exit 0, with no error printed. `TEMPLATES_CHANGED` could not
 * fire, because the templates genuinely had not moved.
 *
 * `vocab.json`, `clause-map.json`, `required-clauses.json`, `grievance-windows.json`,
 * `scenarios.json`, `claim-denylist.json`, `cross-page-claims.json` and `pages.json` are all
 * render or lint inputs. Every one of them is now inside the hash, and they are read THROUGH
 * this function so a data file added later cannot land outside it -- the previous arrangement
 * failed exactly because adding a file was the easy path and extending the hash was not.
 *
 * The field is still reported as `template_set_sha` for continuity, but it covers the whole
 * input set; `renderInputs()` is the name that tells the truth.
 */
function renderInputs(templateSet) {
  const tdir = join(PRODUCT, "templates", templateSet);
  if (!existsSync(tdir)) throw new Fail(3, `template set ${templateSet} is missing at ${tdir}`);
  const files = {};
  for (const f of readdirSync(tdir).sort()) {
    if (!f.endsWith(".tmpl.md")) continue;
    files[`templates/${templateSet}/${f}`] = readFileSync(join(tdir, f), "utf8").split("\r\n").join("\n");
  }
  if (!Object.keys(files).length) throw new Fail(3, `template set ${templateSet} holds no .tmpl.md files`);

  const ddir = join(PRODUCT, "data");
  if (!existsSync(ddir)) throw new Fail(3, `the legal data directory is missing at ${ddir}`);
  const data = {};
  for (const f of readdirSync(ddir).sort()) {
    if (!f.endsWith(".json")) continue;
    const text = readFileSync(join(ddir, f), "utf8").split("\r\n").join("\n");
    files[`data/${f}`] = text;
    data[f] = JSON.parse(text);
  }
  if (!Object.keys(data).length) throw new Fail(3, `the legal data directory holds no .json files`);

  // The templates alone, for the renderer, which keys them by bare filename.
  const templates = {};
  for (const [k, v] of Object.entries(files))
    if (k.startsWith("templates/")) templates[k.slice(`templates/${templateSet}/`.length)] = v;

  return { dir: tdir, files: templates, data, sha: templateSetHash(files) };
}

/**
 * Clause DECLARATIONS in a template: the id and the `when=` guard, if any. trace-lint needs
 * both -- the id to know which markers are legal, and the guard to detect a clause-map that has
 * drifted away from the templates it is supposed to describe.
 */
/**
 * Every `.mdx` under a publish directory, RECURSIVELY, as paths relative to it.
 *
 * `readdirSync(dir)` is not recursive, so a page one directory down -- `out/en/terms.mdx` -- was
 * in no receipt and published at exit 0, while the identical bytes at `out/terms-v2.mdx` were
 * refused. A static host serves `/en/terms` exactly as it serves `/terms-v2`, so the guard was
 * looking at the wrong shape of "the directory".
 *
 * `{ recursive: true }` on readdirSync needs Node 20; this walks by hand so the engine keeps
 * working on the Node 18 CI leg, where the recursive option silently does nothing.
 */
function listPagesRecursively(dir, prefix = "") {
  const out = [];
  let entries;
  try { entries = readdirSync(join(dir, prefix), { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listPagesRecursively(dir, rel));
    else out.push(rel);
  }
  return out;
}

function clauseDeclarationsIn(source) {
  const decls = [];
  const re = /\{\{#clause\s+id=([A-Z][A-Z0-9_.]*)(?:\s+when=([A-Za-z0-9_.]+=[A-Za-z0-9_-]+))?\s*\}\}/g;
  let m;
  while ((m = re.exec(source)) !== null) decls.push({ id: m[1], when: m[2] || null });
  return decls;
}

export function renderVenture({ ventureName, outDir }) {
  const factsPath = factsPathFor(ventureName);
  const templateSet = pinnedSetFor(ventureName, dirname(factsPath));

  let raw;
  try { raw = readFileSync(factsPath, "utf8"); }
  catch (e) { throw new Fail(3, `cannot read ${factsPath}: ${e.message}`); }

  let facts;
  try { facts = parseFactsYaml(raw); }
  catch (e) {
    if (e instanceof YamlError) throw new Fail(2, `facts.yaml: ${e.message}`);
    throw e;
  }

  // Read from the HASHED set, never from disk again. A second read is a second chance for the
  // bytes to differ from the ones the pin covers.
  const set = renderInputs(templateSet);
  const need = (f) => { const d = set.data[f]; if (d === undefined) throw new Fail(3, `products/legal/data/${f} is missing`); return d; };
  const vocab = need("vocab.json");
  const clauseMap = need("clause-map.json");
  const required = need("required-clauses.json");
  const denylist = need("claim-denylist.json");
  const pagesDoc = need("pages.json");
  const windowRows = need("grievance-windows.json");
  // The answerability fixture (ADR-1009). Read here rather than inside the lint so a missing or
  // unparseable file is a loud refusal at load time, not a per-page finding repeated seven times.
  const scenarioSet = need("scenarios.json");
  const crossClaims = need("cross-page-claims.json");
  if (!scenarioSet || !Array.isArray(scenarioSet.scenarios) || !scenarioSet.scenarios.length)
    throw new Fail(3, "scenarios.json holds no scenarios. The answerability check is the only lint class that fails for insufficiency; running without it is not a degraded run, it is a different gate.");

  for (const row of windowRows) {
    if (!row.source_url) throw new Fail(2, `grievance-windows.json: "${row.instrument}" has no source_url. A legal number with no evidence link is exactly what this module refuses.`);
  }

  const errs = validateFacts(facts, vocab);
  if (errs.length) throw new Fail(2, "facts.yaml failed the schema:\n  - " + errs.join("\n  - "));

  let factsSha;
  try { factsSha = canonicalHash(facts); }
  catch (e) {
    if (e instanceof CanonError) throw new Fail(2, `the facts cannot be canonicalised: ${e.message}`);
    throw e;
  }

  const windows = strictestWindow(windowRows, facts.effective_date);

  // Routes are a FACTS field with pinned defaults (ADR-1010 item 7). The templates cross-link
  // pages, so every page id must resolve to a path even when the venture set none. The merged
  // view is what RENDERS; `facts` -- the authored file, unmerged -- is what HASHES, so a
  // default never silently becomes part of the venture's own signed facts.
  const effectiveRoutes = {};
  for (const p of pagesDoc.pages) effectiveRoutes[p.id] = (facts.routes && facts.routes[p.id]) || p.default_route;

  // DERIVED facts. A `when=` guard is a single field=value equality by design -- no negation,
  // no conjunction, because an expression language between a facts file and a legal sentence is
  // exactly what ADR-1009 refuses. Some clauses genuinely depend on a COMBINATION, and the
  // answer is to compute the combination HERE, in code, and let the templates keep asking one
  // simple question.
  //
  // Every one of these exists because a text attack panel found a page contradicting itself:
  //   invoice_issuer  -- the merchant-of-record render said Razorpay issues the receipt and
  //                      then printed the operator's own GSTIN on "every invoice we issue".
  //   subprocessors   -- the "who else touches your data" section was gated on whether the
  //                      CUSTOMER stores client records, so a venture with a host and an email
  //                      provider disclosed neither. Two independent attackers found this one.
  //   autorenew       -- the auto-renewal clause rendered for a venture that takes no gateway
  //                      payments at all and invoices by hand.
  // Derived values are NOT hashed: `facts` is what the receipt binds, and a derivation must
  // never quietly become part of a venture's signed facts.
  const derived = {
    // THREE states, not two. The merchant-of-record render said Razorpay issues the receipt
    // and then printed the operator's own GSTIN on "every invoice we issue" -- the regulator
    // panel's worst finding, and a two-value flag could not express the difference.
    invoice_kind: facts.payment_model === "mor" ? "provider" : (facts.gst_registered ? "gst" : "no-gst"),
    autorenew: facts.payment_model === "none" ? "no" : "yes",
    subprocessors: Array.isArray(facts.sub_processors) && facts.sub_processors.length ? "yes" : "no",
    // Is there a machine event that tells us a payment succeeded? With a gateway or a
    // merchant-of-record there is; with a bank transfer there is not, and a human must reconcile
    // it. Three reader panels independently found the delivery page promising access "within 1
    // hour of a successful payment ... you do not have to wait for anyone to approve anything by
    // hand" to a venture whose ONLY payment route is a transfer somebody has to look at. The
    // clause was written for a gateway and survived into the branch that has none.
    payment_is_automatic: facts.payment_model === "none" ? "no" : "yes",
  };
  const factsView = { ...facts, routes: effectiveRoutes, derived };

  const pages = [];
  const findings = [];
  const notAuthored = [];

  for (const pageDef of pagesDoc.pages) {
    const tmplName = `${pageDef.id}.tmpl.md`;
    if (!set.files[tmplName]) {
      // Reported by name, never silently skipped: an absent page and a complete one are the
      // one thing a broken renderer and a healthy one would otherwise agree on.
      notAuthored.push({ page: pageDef.id, phase: pageDef.phase, reason: "template not authored yet" });
      continue;
    }
    const source = set.files[tmplName];
    const ctx = { facts: factsView, vocab, windows, used: new Set() };
    let rendered;
    try { rendered = renderTemplate(source, ctx); }
    catch (e) {
      if (e instanceof TemplateError) throw new Fail(2, `${tmplName}: ${e.message}`);
      throw e;
    }

    const route = effectiveRoutes[pageDef.id];
    const header = [
      `<!-- GENERATED by ${ENGINE_VERSION}. DO NOT EDIT. Change legal/facts.yaml or the template set, then re-render and re-approve. -->`,
      `<!-- engine:${ENGINE_VERSION} set:${templateSet}@${set.sha} facts:${factsSha} page:${pageDef.id} route:${route} -->`,
      "",
      `# ${pageDef.title}`,
      "",
      `_Effective from ${facts.effective_date}._`,
      "",
      "",
    ].join("\n");
    const text = header + rendered.body;

    const pageFindings = runAllLints({
      page: pageDef.id,
      text,
      facts: factsView,
      clauseMap,
      required,
      denylist,
      templateClauses: clauseDeclarationsIn(source),
      bodies: rendered.bodies,
      ownHost: facts.site_url,
      scenarios: scenarioSet.scenarios,
    });
    findings.push(...pageFindings);

    pages.push({
      page: pageDef.id,
      title: pageDef.title,
      route,
      provider: pageDef.provider,
      file: `${pageDef.id}.mdx`,
      text,
      output_sha256: bytesHash(text),
      clauses: rendered.clauses,
      skipped: rendered.skipped,
      transforms: TRANSFORMS,
    });
  }

  if (!pages.length) throw new Fail(3, "no page templates exist in the pinned set");

  // Set-level answerability, run ONCE. A scenario aimed at a page the pinned set no longer
  // renders is invisible to the per-page pass -- the loop that would catch it never runs for a
  // page that does not exist, so the check is disabled by exactly the condition it detects.
  findings.push(...scenarioSetLint(scenarioSet.scenarios, pages.map((p) => p.page)));

  // Cross-page consistency (ADR-1013), also once. A contradiction BETWEEN two pages is invisible
  // to every per-page lint by construction, and that is where three reader panels independently
  // put their worst findings.
  GROUPS_RUN.add("consistency");
  findings.push(...crossPageLint(pages, crossClaims, factsView));

  const run = {
    engine_version: ENGINE_VERSION,
    preimage_version: PREIMAGE_VERSION,
    template_set: templateSet,
    template_set_sha: set.sha,
    venture: ventureName,
    // Carried so the checklist can decide activation applicability without re-parsing facts.
    payment_model: facts.payment_model,
    facts_sha256: factsSha,
    effective_date: facts.effective_date,
    grievance_windows: windows,
    pages: pages.map(({ text, ...rest }) => rest),
    not_authored: notAuthored,
    findings,
    trial_groups: [...TRIAL].sort(),
    // Which groups actually RAN, accumulated by the dispatcher as it invoked each lint. NOT a
    // copy of the declaration -- that was the vacuous version.
    groups_run: [...GROUPS_RUN].sort(),
    exit_code: findingsAreFatal(findings) ? 2 : 0,
  };

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const p of pages) writeFileSync(join(outDir, p.file), p.text, "utf8");
    writeFileSync(join(outDir, "_run.json"), JSON.stringify(run, null, 2) + "\n", "utf8");
  }

  return { run, pages };
}

/**
 * propose -- render, then write the approval request a HUMAN decides on.
 *
 * It emits nothing to the spine itself. REQ-06 makes the human gate permanent, and a verb that
 * both requests approval and could record it is one refactor away from doing both. It writes the
 * payload and prints the exact `arc-inbox` command, which is run by a person, from the canonical
 * clone -- the spine is gitignored, so a worktree has its own and a failed approve leaves no
 * trace anywhere anyone would look.
 */
function proposeMain(args) {
  if (!args.venture) { console.error(`propose needs --venture NAME\n\n${usage()}`); return 2; }
  if (!args.out) { console.error(`propose needs --out DIR\n\n${usage()}`); return 2; }

  const { run } = renderVenture({ ventureName: args.venture, outDir: args.out });

  // A page that failed a promoted lint is not a page to ask a human to approve. In TRIAL nothing
  // is promoted yet, so this is currently unreachable -- and it is written now rather than when
  // the first group is promoted, because that is the moment nobody will remember to add it.
  if (findingsAreFatal(run.findings)) {
    console.error("propose refuses: this render has FAIL findings in a group that is out of TRIAL.");
    return 2;
  }

  const payload = approvalPayload(run);
  const errs = validateApprovalPayload(payload);
  if (errs.length) {
    console.error("the approval payload this build produced is itself invalid:\n  - " + errs.join("\n  - "));
    return 2;
  }

  const file = join(args.out, "_approval.json");
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(`approval request written to ${file}`);
  console.log(`subject ${APPROVAL_SUBJECT} - venture ${payload.venture} - ${payload.pages.length} page(s)`);
  console.log(`facts ${payload.facts_sha256}`);
  console.log(`set ${payload.template_set}@${payload.template_set_sha}`);
  console.log("");
  console.log("A HUMAN decides this. From the CANONICAL clone, not a worktree:");
  console.log(`  bash .claude/scripts/hq/arc-inbox.sh approve --id <REQUEST_ULID> --reason "<why>"`);
  console.log("Then publish with the recorded decision:");
  console.log(`  node .claude/scripts/legal/arc-legal.mjs publish --venture ${payload.venture} --dir ${args.out} --decision <DECISION_FILE>`);
  return 0;
}

/**
 * publish -- the gate. Re-derives everything from the tree as it stands NOW and refuses unless
 * the human decision approved exactly these bytes.
 *
 * The fresh render is the whole point. Reading `_run.json` and checking it against itself would
 * pass every TOCTOU case there is: edit the facts, re-render, and the sidecar agrees with the
 * facts perfectly while disagreeing with what anybody approved.
 */
function publishMain(args) {
  if (!args.venture) { console.error(`publish needs --venture NAME\n\n${usage()}`); return 2; }
  if (!args.dir) { console.error(`publish needs --dir DIR\n\n${usage()}`); return 2; }
  if (!args.decision) { console.error(`publish needs --decision FILE. There is no publish without a recorded human decision (REQ-06).\n\n${usage()}`); return 2; }

  const approvalFile = join(args.dir, "_approval.json");
  if (!existsSync(approvalFile)) { console.error(`no approval request at ${approvalFile}. Run propose first.`); return 3; }
  if (!existsSync(args.decision)) { console.error(`no decision receipt at ${args.decision}`); return 3; }

  const approved = readJson(approvalFile);
  const decision = readJson(args.decision);

  const payloadErrs = validateApprovalPayload(approved);
  if (payloadErrs.length) {
    console.error("the approval request is not a valid payload:\n  - " + payloadErrs.join("\n  - "));
    return 2;
  }

  // Fresh render into no directory: we want the hashes, not more files on disk.
  const { run: fresh } = renderVenture({ ventureName: args.venture, outDir: null });

  // `--request` is the ULID of the `approval.requested` event a human emitted for these bytes,
  // and it is REQUIRED. The first cut of this passed `decision.decides` in as the expected
  // value, which compares the field against itself: DECIDES_MISMATCH could never fire, and a
  // decision recorded about some entirely different request would have published. A check whose
  // expected value comes from the thing being checked is not a check.
  if (!args.request) {
    console.error("publish needs --request ULID, the approval.requested event this decision decides. Without it there is nothing to bind the decision TO, and any recorded approval would do.");
    return 2;
  }

  // propose refuses on fatal findings and publish did not. The comment on the propose check even
  // says it was written early "because that is the moment nobody will remember to add it" -- and
  // the other half was forgotten in the same file. Latent only while every group is in TRIAL.
  if (findingsAreFatal(fresh.findings)) {
    console.error("publish REFUSED: the fresh render has FAIL findings in a group that is out of TRIAL.");
    for (const f of fresh.findings.filter((x) => x.level === "FAIL"))
      console.error("  - " + f.group + ":" + f.page + ":" + f.clause + " " + f.message);
    return 2;
  }

  // The publish LEDGER is keyed by VENTURE, not by the directory the publisher happened to pass.
  // Monotonicity used to read <--dir>/_published.json, so proposing into a FRESH directory walked
  // straight past it and re-published a BACKWARDS effective date at exit 0. A guard keyed to a
  // caller-chosen location is a guard the caller can move out from under.
  // The ledger is a RECEIPT, not scratch state, so it lives with the product and is committed.
  // It sat under .claude/state/, which is gitignored -- so monotonicity was enforced only on the
  // machine that happened to publish last. A fresh clone, a CI runner, a worktree or a second
  // operator all saw "nothing published before" and a backwards effective_date went through at
  // exit 0. Row 23 moved this off a caller-chosen DIRECTORY; it was still keyed to a
  // caller-chosen MACHINE.
  const ledgerDir = join(PRODUCT, "published");
  const ledgerFile = join(ledgerDir, args.venture + ".json");
  const hadPrevious = existsSync(ledgerFile);
  const previous = hadPrevious ? readJson(ledgerFile) : null;

  const approvedSets = existsSync(join(PRODUCT, "approved-sets.json")) ? readJson(join(PRODUCT, "approved-sets.json")) : null;

  const problems = [
    ...templateSetApprovalErrors({ approvedSets, templateSet: fresh.template_set, sha: fresh.template_set_sha }),
    ...verifyDecision(decision, approved, args.request),
    ...verifyChain({ approved, fresh, dir: args.dir, dirEntries: listPagesRecursively(args.dir) }),
    ...backdatingErrors({
      // The RE-DERIVED date, never the one recorded in the approval file. That value was
      // forgeable -- editing it alone, facts hash untouched, published a record claiming a date
      // the rendered page never carried -- and it was what both backdating guards evaluated.
      effectiveDate: fresh.effective_date,
      decisionAt: decision.recorded_at,
      previousEffectiveDate: previous ? previous.effective_date : null,
      hadPrevious,
    }),
  ];

  if (problems.length) {
    console.error(`publish REFUSED for ${args.venture}:`);
    for (const p of problems) console.error(`  - ${p}`);
    return 2;
  }

  let diff = null;
  if (previous && previous.run && Array.isArray(previous.run.pages)) {
    diff = semanticDiff(previous.run, fresh);
    console.log("this is a RE-publish. What changed:");
    console.log(`  effective_date ${diff.effective_date.from} -> ${diff.effective_date.to}`);
    for (const c of diff.clause_changes)
      console.log(`  ${c.page}: +${c.added.join(",") || "-"} -${c.removed.join(",") || "-"}${c.note ? ` (${c.note})` : ""}`);
    if (diff.opaque_rechange) console.error(`WARN consistency:-:-:${diff.opaque_reason}`);
  }

  writeFileSync(join(args.dir, "_published.json"), JSON.stringify({
    subject: APPROVAL_SUBJECT,
    venture: fresh.venture,
    effective_date: fresh.effective_date,
    facts_sha256: fresh.facts_sha256,
    template_set_sha: fresh.template_set_sha,
    decision: { id: decision.id ?? null, decides: decision.decides ?? null, recorded_at: decision.recorded_at ?? null },
    pages: approved.pages,
    semantic_diff: diff,
    run: fresh,
  }, null, 2) + "\n", "utf8");

  mkdirSync(ledgerDir, { recursive: true });
  writeFileSync(ledgerFile, readFileSync(join(args.dir, "_published.json"), "utf8"), "utf8");

  console.log(`published ${approved.pages.length} page(s) for ${fresh.venture}`);
  console.log(`bound to decision ${decision.id ?? "(no id)"} recorded ${decision.recorded_at ?? "(no timestamp)"}`);
  return 0;
}

/**
 * verify -- is the published directory still what was published? Exit 0 INTACT, 2 TAMPERED,
 * 3 UNVERIFIABLE. Three codes because there are three answers, and "could not check" must never
 * wear the same one as "checked and clean".
 */
/**
 * checklist -- what the payment provider will look for, and what anyone has actually checked.
 *
 * Exit 0 rendered - exit 2 the checklist could not be built honestly - exit 3 could not run.
 * Note that FAIL and NOT-CHECKED rows do NOT move the exit code: the checklist reports a
 * position, it does not gate on one. A renderer that refused to print an unchecked row would
 * push an operator toward recording something to make it go away.
 */
/**
 * bump-templates -- move ONE venture to a new template set, and say plainly that its approval is
 * now void.
 *
 * The forcing function is not a flag this command sets; it is arithmetic. Moving the pin changes
 * `template_set_sha`, and `publish` re-derives that hash and refuses on `TEMPLATES_CHANGED`. So a
 * publish attempted against a moved set WITHOUT a bump is refused for the same reason a publish
 * after a bump is refused: the bytes a human approved are not the bytes on offer. There is no
 * separate "needs re-approval" flag that could drift out of step with the hashes.
 *
 * One venture at a time, by name. A bump that moved every venture at once would be the module
 * constant this replaced, wearing a command's clothes.
 *
 * Exit 0 bumped - exit 2 refused - exit 3 could not run.
 */
/**
 * ci-guard -- emit the venture-side CI guard. Generated, never hand-written; see renderCiGuard.
 */
/**
 * propose-templates -- send a template SET to the inbox as its own approval.
 *
 * REQ-07: a template diff is a decision in its own right, never a silent commit. This writes the
 * request; a human decides it, and the approved sha is recorded in products/legal/approved-sets.json.
 * Publish refuses any set whose current bytes are not the approved ones.
 *
 * It reports WHICH FILES moved, because "the set hash changed" is not reviewable and the person
 * being asked has to know what they are reading.
 */
function proposeTemplatesMain(args) {
  if (!args.set) { console.error(`propose-templates needs --set SET (e.g. --set v2)\n\n${usage()}`); return 2; }
  if (!SET_NAME.test(args.set)) { console.error(`"${args.set}" is not a set name like "v2"`); return 2; }
  if (!existsSync(join(PRODUCT, "templates", args.set))) { console.error(`template set ${args.set} does not exist`); return 3; }

  const set = renderInputs(args.set);
  const recordPath = join(PRODUCT, "approved-sets.json");
  const record = existsSync(recordPath) ? readJson(recordPath) : { version: 1, sets: {} };
  const previous = record.sets?.[args.set] ?? null;

  if (previous === set.sha) {
    console.error(`template set ${args.set} is already approved at these exact bytes. There is nothing to decide.`);
    return 2;
  }

  const payload = {
    subject: TEMPLATE_SUBJECT,
    template_set: args.set,
    template_set_sha: set.sha,
    previously_approved_sha: previous,
    files: Object.keys(set.files).sort(),
  };
  const text = JSON.stringify(payload, null, 2) + "\n";
  if (args.out) { mkdirSync(dirname(args.out), { recursive: true }); writeFileSync(args.out, text, "utf8"); }
  process.stdout.write(text);

  console.log("");
  console.log(`A HUMAN decides this. It is the PROSE being approved, not any venture's facts --`);
  console.log(`the person approving a venture is not reviewing the clause library, which is why`);
  console.log(`this is a separate decision (REQ-07).`);
  console.log(`Once approved, record it:  products/legal/approved-sets.json -> sets.${args.set} = ${set.sha}`);
  return 0;
}

function ciGuardMain(args) {
  if (!args.venture) { console.error(`ci-guard needs --venture NAME\n\n${usage()}`); return 2; }

  // ci-guard writes a SHELL PROGRAM into somebody else's repository, and both values below are
  // interpolated into a double-quoted line in it. CLAUDE.md's rule is explicit that a backtick or
  // a `$` inside a double-quoted string is executable -- and this verb was the one place that
  // never ran its input through `factsPathFor`, the function whose own comment reads "one
  // confinement function, every path through it".
  //
  // Both attackers reproduced command execution here, and one turned `--dir` into a guard that
  // exits 0 having verified nothing. Validation happens BEFORE anything is emitted.
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(args.venture)) {
    console.error(`"${args.venture}" is not a venture name. It is interpolated into generated shell, so it is refused rather than escaped.`);
    return 2;
  }
  if (args.dir !== undefined) {
    const d = args.dir;
    if (!/^[A-Za-z0-9._/-]+$/.test(d) || d.startsWith("/") || /^[A-Za-z]:/.test(d) || d.split("/").some((seg) => seg === "..")) {
      console.error(`"${d}" is not a repo-relative pages directory. It is interpolated into generated shell, so it is refused rather than escaped.`);
      return 2;
    }
  }
  const text = renderCiGuard({
    engineVersion: ENGINE_VERSION,
    venture: args.venture,
    pagesDir: args.dir || "legal/rendered",
  });
  if (args.out) { mkdirSync(dirname(args.out), { recursive: true }); writeFileSync(args.out, text, "utf8"); console.log(`wrote ${args.out}`); }
  else process.stdout.write(text);
  return 0;
}

function bumpTemplatesMain(args) {
  if (!args.venture) { console.error(`bump-templates needs --venture NAME\n\n${usage()}`); return 2; }
  if (!args.to) { console.error(`bump-templates needs --to SET (e.g. --to v2)\n\n${usage()}`); return 2; }
  if (!SET_NAME.test(args.to)) { console.error(`"${args.to}" is not a set name like "v2"`); return 2; }

  const factsPath = factsPathFor(args.venture);
  const ventureDir = dirname(factsPath);
  const from = pinnedSetFor(args.venture, ventureDir);

  if (from === args.to) {
    console.error(`"${args.venture}" is already pinned to ${args.to}. A no-op bump would still print a re-approval warning, and a warning nobody needs is a warning people learn to skip.`);
    return 2;
  }
  if (!existsSync(join(PRODUCT, "templates", args.to))) {
    console.error(`template set ${args.to} does not exist under products/legal/templates/`);
    return 3;
  }

  // The guard's version marker is a PRECONDITION, checked before anything is written.
  //
  // It sat after the pin was already rewritten, which meant a refused bump left the venture
  // pinned to the new set anyway -- the exact state the render-failure rollback three lines below
  // exists to prevent, reintroduced by a check placed one block too late. Found by running the
  // refusal rather than by reading it: the run reported "already pinned" on a bump that was
  // supposed to have been refused, because the previous refusal had bumped it.
  //
  // The bump is the moment a venture's setup changes and the only moment anyone is looking. A
  // guard generated against an older engine may compare under rules this engine no longer uses,
  // and its failure mode is silence: it keeps passing.
  // NOT optional by omission. Row 27 closed exactly this shape in verifyChain and row 22 filed it
  // as a CLASS, and it came straight back here: a precondition you skip by not typing a flag is a
  // precondition the hurried operator never runs. Either name the guard or say explicitly that
  // this venture has none.
  if (!args.guard && !args["no-guard"]) {
    console.error("bump-templates needs --guard FILE (the venture CI guard to version-check) or --no-guard to state that this venture has none. Skipping the check by omitting a flag is how it stops being a precondition.");
    return 2;
  }
  if (args.guard) {
    if (!existsSync(args.guard)) {
      console.error(`no CI guard at ${args.guard}. Generate one with \`arc-legal ci-guard --venture ${args.venture} --out ${args.guard}\`.`);
      return 3;
    }
    const marker = guardVersionIn(readFileSync(args.guard, "utf8"));
    if (marker !== ENGINE_VERSION) {
      console.error(`the CI guard at ${args.guard} was generated by "${marker}" and this engine is "${ENGINE_VERSION}". A guard generated against an older engine may compare under rules this one no longer uses, and it fails by staying GREEN. Regenerate it, then bump.`);
      return 2;
    }
  }

  // What actually changes, computed rather than asserted, so the operator sees the consequence
  // and not just the intention.
  const before = renderVenture({ ventureName: args.venture, outDir: null }).run;
  const pinPath = join(ventureDir, "pins.yaml");
  const src = readFileSync(pinPath, "utf8");
  const line = `template_set: ${from}`;
  if (!src.includes(line)) { console.error(`${pinPath} does not carry "${line}"`); return 3; }
  writeFileSync(pinPath, src.split(line).join(`template_set: ${args.to}`), "utf8");

  let after;
  try { after = renderVenture({ ventureName: args.venture, outDir: null }).run; }
  catch (e) {
    // Put the pin back. A venture left pinned to a set it cannot render is worse than an
    // un-bumped one, and this is the only window in which that state can exist.
    writeFileSync(pinPath, src, "utf8");
    console.error(`bump REFUSED: "${args.venture}" does not render under ${args.to}, so the pin was rolled back. ${e.message}`);
    return 2;
  }

  const diff = semanticDiff(before, after);
  console.log(`bumped ${args.venture}: ${from} -> ${args.to}`);
  console.log(`set sha ${before.template_set_sha.slice(0, 12)}... -> ${after.template_set_sha.slice(0, 12)}...`);
  for (const c of diff.clause_changes)
    console.log(`  ${c.page}: +${c.added.join(",") || "-"} -${c.removed.join(",") || "-"}`);
  if (!diff.clause_changes.length)
    console.log("  no clause appeared or disappeared -- the change is in clause PROSE, which a clause-id diff cannot show. Read the rendered pages before re-approving.");
  console.log("");
  console.log("Any existing approval for this venture is now VOID: the set hash it committed to has moved,");
  console.log("and publish re-derives that hash. Re-run propose, take a fresh human decision, then publish.");
  return 0;
}

function checklistMain(args) {
  if (!args.venture) { console.error(`checklist needs --venture NAME\n\n${usage()}`); return 2; }

  const { run } = renderVenture({ ventureName: args.venture, outDir: null });
  const providerPages = renderInputs(run.template_set).data["provider-pages.json"];
  if (!providerPages) throw new Fail(3, "products/legal/data/provider-pages.json is missing");

  const evidence = args.evidence ? readJson(args.evidence) : {};
  const routes = {};
  for (const p of run.pages) routes[p.page] = p.route;

  const { rows, errs } = buildChecklist({
    providerPages,
    facts: { payment_model: run.payment_model },
    routes,
    evidence,
  });

  if (errs.length) {
    console.error("the checklist could not be built:\n  - " + errs.join("\n  - "));
    return 2;
  }

  const text = renderChecklist({ rows, venture: run.venture });
  if (args.out) { mkdirSync(dirname(args.out), { recursive: true }); writeFileSync(args.out, text, "utf8"); }
  process.stdout.write(text);
  return 0;
}

function verifyMain(args) {
  if (!args.venture) { console.error(`verify needs --venture NAME

${usage()}`); return 2; }
  if (!args.dir) { console.error(`verify needs --dir DIR

${usage()}`); return 2; }
  const publishedFile = join(args.dir, "_published.json");
  if (!existsSync(publishedFile)) { console.error(`nothing published at ${publishedFile}`); return 3; }

  const published = readJson(publishedFile);
  const { run: fresh } = renderVenture({ ventureName: args.venture, outDir: null });
  const { verdict, results } = verifyPublished({
    published,
    fresh,
    dir: args.dir,
    // Verify is the half that runs in the VENTURE's repo through the generated guard, so it is
    // the half that most needs the unapproved-file sweep -- and it was the half that did not
    // have it.
    dirEntries: listPagesRecursively(args.dir),
    currentPreimage: PREIMAGE_VERSION,
  });

  for (const r of results) console.log(`${r.verdict.padEnd(12)} ${r.what}${r.detail ? " -- " + r.detail : ""}`);
  console.log(`verdict: ${verdict}`);
  return verdict === VERIFY_INTACT ? 0 : verdict === VERIFY_TAMPERED ? 2 : 3;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args._.length) { console.log(usage()); return args.help ? 0 : 2; }

  const verb = args._[0];
  if (verb === "propose") return proposeMain(args);
  if (verb === "publish") return publishMain(args);
  if (verb === "verify") return verifyMain(args);
  if (verb === "checklist") return checklistMain(args);
  if (verb === "bump-templates") return bumpTemplatesMain(args);
  if (verb === "ci-guard") return ciGuardMain(args);
  if (verb === "propose-templates") return proposeTemplatesMain(args);
  if (verb !== "render") { console.error(`unknown verb "${verb}"\n\n${usage()}`); return 2; }
  if (!args.venture) { console.error(`render needs --venture NAME\n\n${usage()}`); return 2; }
  if (!args.out) { console.error(`render needs --out DIR\n\n${usage()}`); return 2; }

  const { run } = renderVenture({ ventureName: args.venture, outDir: args.out });

  for (const f of run.findings) console.error(`${f.level} ${f.group}:${f.page}:${f.clause}:${f.message}`);
  for (const n of run.not_authored) console.error(`NOT-AUTHORED ${n.page}: ${n.reason} (phase ${n.phase})`);
  console.log(`rendered ${run.pages.length} page(s) for ${run.venture}`);
  console.log(`facts ${run.facts_sha256}`);
  console.log(`set ${run.template_set}@${run.template_set_sha}`);
  console.log(`transforms applied: ${TRANSFORMS.join(", ")}`);
  const fails = run.findings.filter((f) => f.level === "FAIL").length;
  const warns = run.findings.filter((f) => f.level === "WARN").length;
  console.log(`findings: ${fails} FAIL, ${warns} WARN (all groups in TRIAL, so the exit code does not move)`);
  return run.exit_code;
}

/**
 * REALPATH BOTH SIDES. Node resolves symlinks for the ESM entry module but leaves
 * `process.argv[1]` exactly as typed, and `path.resolve` is purely lexical -- so under any
 * symlinked path the two never match, `main()` never runs, and the CLI EXITS 0 HAVING DONE
 * NOTHING. macOS `mktemp -d` returns `/var/folders/...` and `/var` is a symlink to
 * `/private/var`, so every sandbox test on that leg rendered nothing and then asserted
 * `status -eq 0` on the no-op and passed.
 *
 * This exact defect is already closed in `.claude/scripts/memory/arc-recall.mjs`, comment and
 * all. It was never applied here -- the twin-fix pattern, fifth recurrence in this repo, found
 * by an attacker carrying the running fixed-defect list into a file no row named.
 */
function invokedDirectly() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const self = fileURLToPath(import.meta.url);
  try { return realpathSync(argv1) === realpathSync(self); }
  catch { return resolve(argv1) === resolve(self); }
}

if (invokedDirectly()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Fail) { console.error(`arc-legal: ${e.message}`); process.exitCode = e.code; }
    else { console.error(`arc-legal: unexpected: ${e && e.stack ? e.stack : e}`); process.exitCode = 2; }
  }
}
