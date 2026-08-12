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
import { runAllLints, findingsAreFatal, TRIAL } from "./lib/lints.mjs";

export const ENGINE_VERSION = "arc-legal/0.1.0";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const PRODUCT = join(REPO_ROOT, "products", "legal");
const TEMPLATE_SET = "v1";

class Fail extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { throw new Fail(3, `cannot read ${path}: ${e.message}`); }
}

function usage() {
  return [
    "usage: arc-legal render --venture NAME --out DIR",
    "",
    "  --venture NAME   a fixture venture under tests/fixtures/legal/ventures/",
    "  --out DIR        where the rendered pages are written",
    "",
    "exit 0 rendered - exit 2 refused - exit 3 could not run",
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

function loadTemplateSet() {
  const dir = join(PRODUCT, "templates", TEMPLATE_SET);
  if (!existsSync(dir)) throw new Fail(3, `template set ${TEMPLATE_SET} is missing at ${dir}`);
  const files = {};
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".tmpl.md")) continue;
    files[f] = readFileSync(join(dir, f), "utf8").split("\r\n").join("\n");
  }
  if (!Object.keys(files).length) throw new Fail(3, `template set ${TEMPLATE_SET} holds no .tmpl.md files`);
  return { dir, files, sha: templateSetHash(files) };
}

/**
 * Clause DECLARATIONS in a template: the id and the `when=` guard, if any. trace-lint needs
 * both -- the id to know which markers are legal, and the guard to detect a clause-map that has
 * drifted away from the templates it is supposed to describe.
 */
function clauseDeclarationsIn(source) {
  const decls = [];
  const re = /\{\{#clause\s+id=([A-Z][A-Z0-9_.]*)(?:\s+when=([A-Za-z0-9_.]+=[A-Za-z0-9_-]+))?\s*\}\}/g;
  let m;
  while ((m = re.exec(source)) !== null) decls.push({ id: m[1], when: m[2] || null });
  return decls;
}

export function renderVenture({ ventureName, outDir }) {
  const factsPath = factsPathFor(ventureName);

  let raw;
  try { raw = readFileSync(factsPath, "utf8"); }
  catch (e) { throw new Fail(3, `cannot read ${factsPath}: ${e.message}`); }

  let facts;
  try { facts = parseFactsYaml(raw); }
  catch (e) {
    if (e instanceof YamlError) throw new Fail(2, `facts.yaml: ${e.message}`);
    throw e;
  }

  const vocab = readJson(join(PRODUCT, "data", "vocab.json"));
  const clauseMap = readJson(join(PRODUCT, "data", "clause-map.json"));
  const required = readJson(join(PRODUCT, "data", "required-clauses.json"));
  const denylist = readJson(join(PRODUCT, "data", "claim-denylist.json"));
  const pagesDoc = readJson(join(PRODUCT, "data", "pages.json"));
  const windowRows = readJson(join(PRODUCT, "data", "grievance-windows.json"));

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

  const set = loadTemplateSet();
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
      `<!-- engine:${ENGINE_VERSION} set:${TEMPLATE_SET}@${set.sha} facts:${factsSha} page:${pageDef.id} route:${route} -->`,
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

  const run = {
    engine_version: ENGINE_VERSION,
    preimage_version: PREIMAGE_VERSION,
    template_set: TEMPLATE_SET,
    template_set_sha: set.sha,
    venture: ventureName,
    facts_sha256: factsSha,
    effective_date: facts.effective_date,
    grievance_windows: windows,
    pages: pages.map(({ text, ...rest }) => rest),
    not_authored: notAuthored,
    findings,
    trial_groups: [...TRIAL].sort(),
    exit_code: findingsAreFatal(findings) ? 2 : 0,
  };

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const p of pages) writeFileSync(join(outDir, p.file), p.text, "utf8");
    writeFileSync(join(outDir, "_run.json"), JSON.stringify(run, null, 2) + "\n", "utf8");
  }

  return { run, pages };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args._.length) { console.log(usage()); return args.help ? 0 : 2; }

  const verb = args._[0];
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
