#!/usr/bin/env node
// launch-lint -- the contract gate for the launch lane (REQ-01). FAIL FROM BIRTH: an empty or unreadable registry is
// a named refusal, never a clean pass.
//
//   node .claude/scripts/launch/launch-lint.mjs [--catalog P] [--registry P] [--providers-dir D]
//   node .claude/scripts/launch/launch-lint.mjs --mutant-selftest
//
// Layer 1 (slots) never names a tool; layer 2 (providers) never redefines exit criteria (ADR-1701). Rows are
// owner-born (ADR-1702). No word for a fallback provider anywhere (ADR-1703). Adapters are four functions that import
// no package and whose verify asks the outside world (ADR-1704, 1709, 1715). The DAG is acyclic, every edge
// resolves, and no core slot depends on a non-core one (ADR-1717). A vetted adapter's digest is pinned (ADR-1719).
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, cpSync, writeFileSync, rmSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { PATHS, OWNER, TIERS, GATES, RESUME, STATUSES, readYaml, parsePredicate } from "./lib/catalog.mjs";
import { dagFindings } from "./lib/dag.mjs";
import { defaultWordHits, adapterFindings, adapterDigest, posix } from "./lib/scan.mjs";

const PROVIDER_KEYS = ["provider", "providers", "tool", "tools", "adapter", "vendor"];
const EXIT_KEYS = ["exit_criteria", "verify", "depends_on", "tier", "gate", "timeout", "resume", "required_when", "optional_for"];
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function walkMjs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walkMjs(p));
    else if (n.endsWith(".mjs")) out.push(p);
  }
  return out;
}

export function lint({ catalog = PATHS.catalog, registry = PATHS.registry, providersDir = PATHS.providersDir } = {}) {
  const F = [];
  const R = [];
  const add = (rule, id, msg) => F.push({ rule, id, msg });
  for (const [p, what] of [[catalog, "catalog"], [registry, "registry"]]) {
    if (!existsSync(p)) { add("missing", what, `${p} does not exist -- a contract that is absent is not a contract that is empty`); continue; }
    defaultWordHits(readFileSync(p, "utf8")).forEach((n) => add("default-word", what, `${posix(relative(process.cwd(), p))}:${n} uses the word default (ADR-1703)`));
  }
  if (F.some((f) => f.rule === "missing")) return { findings: F, reports: R };
  let slots, rows;
  try { slots = readYaml(catalog, "slot catalog").slots; } catch (e) { add("yaml", "catalog", e.message); }
  try { rows = readYaml(registry, "provider registry").providers; } catch (e) { add("yaml", "registry", e.message); }
  if (!Array.isArray(slots) || !Array.isArray(rows)) {
    if (!F.length) add("shape", "contracts", "catalog needs `slots:` and registry needs `providers:` lists");
    return { findings: F, reports: R };
  }
  if (!slots.length) add("empty", "catalog", "zero slots");
  if (!rows.length) add("empty", "registry", "zero provider rows");

  const slotIds = new Set();
  const providerIds = new Set(rows.map((r) => r && r.id));
  for (const s of slots) {
    if (!s || typeof s.id !== "string") { add("shape", "?", "a slot row without an id"); continue; }
    if (slotIds.has(s.id)) add("duplicate", s.id, "slot id appears twice");
    slotIds.add(s.id);
    for (const k of PROVIDER_KEYS) if (k in s) add("slot-names-provider", s.id, `slot row carries \`${k}\` -- a slot is a contract and never names a tool (ADR-1701)`);
    // `id` is exempt: a slot may share its name with the provider that fills it (ledger-source); naming is not choosing.
    for (const [k, v] of Object.entries(s)) if (k !== "id" && typeof v === "string" && providerIds.has(v)) add("slot-names-provider", s.id, `field ${k} names provider ${v}`);
    if (!TIERS.has(s.tier)) add("enum", s.id, `tier ${s.tier} is not core | required | optional`);
    if (!Array.isArray(s.exit_criteria) || !s.exit_criteria.length) add("exit-criteria", s.id, "no exit_criteria");
    try { parsePredicate(s.required_when ?? "always"); } catch (e) { add("predicate", s.id, e.message); }
    if (s.tier === "optional" && (!Array.isArray(s.optional_for) || !s.optional_for.length)) add("optional-for", s.id, "optional slot without optional_for");
    if (s.tier === "core") {
      if (!s.verify || s.verify === "deferred-c2") add("core-verify", s.id, `core slot verify is ${JSON.stringify(s.verify)} -- a core slot names its probe`);
      if (!GATES.has(s.gate)) add("enum", s.id, `gate ${s.gate} is not none | gate-1 | gate-2 | gate-3`);
      if (!RESUME.has(s.resume)) add("enum", s.id, `resume ${s.resume} is not resources | rerun | manual`);
      if (!(Number.isInteger(s.timeout) && s.timeout > 0)) add("timeout", s.id, `timeout ${s.timeout} is not a positive whole number of seconds`);
      if (typeof s.approval !== "boolean") add("approval", s.id, "core slot without approval: true|false");
    }
    if (s.gate && s.gate !== "none" && s.approval !== true) add("gate-approval", s.id, `${s.gate} on a slot without approval: true`);
    if ((s.sensitive_actions || []).length && s.approval !== true) add("gate-approval", s.id, "sensitive_actions on a slot without approval: true");
  }
  for (const f of dagFindings(slots.filter((s) => s && s.after !== "all"))) add(f.rule, f.id, f.msg);

  const registryDir = dirname(resolve(registry));
  const referenced = new Set();
  const rowIds = new Set();
  for (const r of rows) {
    if (!r || typeof r.id !== "string") { add("shape", "?", "a provider row without an id"); continue; }
    if (rowIds.has(r.id)) add("duplicate", r.id, "provider id appears twice");
    rowIds.add(r.id);
    for (const k of ["slot", "status", "hosts", "adapter", "approved_by"]) if (r[k] === undefined || r[k] === null) add("row-field", r.id, `missing ${k}`);
    for (const k of EXIT_KEYS) if (k in r) add("row-redefines-exit", r.id, `provider row carries \`${k}\` -- a row never redefines a slot's contract (ADR-1701)`);
    if (r.slot && !slotIds.has(r.slot)) add("unknown-slot", r.id, `slot ${r.slot} is not in the catalog`);
    if (r.approved_by !== OWNER) add("approved-by", r.id, `approved_by ${JSON.stringify(r.approved_by)} -- rows are born only by the owner (ADR-1702)`);
    if (!STATUSES.has(r.status)) add("enum", r.id, `status ${r.status} is not candidate | vetted | retired | blocked`);
    if (r.status === "blocked" && !r.reason) add("blocked-reason", r.id, "blocked without a reason");
    if (!Array.isArray(r.hosts) || !r.hosts.length) add("hosts", r.id, "no hosts[] -- an adapter with no declared hosts may call nothing (ADR-1719)");
    // hostAllowed() admits every subdomain of an entry, so an entry must be a real host of two labels or more:
    // `com` or `co.in` would admit the whole internet under it (attack 3b48ed1 B15).
    for (const h of Array.isArray(r.hosts) ? r.hosts : [])
      if (typeof h !== "string" || !/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(h) || /^(co|com|net|org|gov|ac|edu)\.[a-z]{2}$/.test(h))
        add("hosts", r.id, `host ${JSON.stringify(h)} is not a bare hostname of two or more labels`);
    if (r.adapter && r.slot && posix(r.adapter) !== `providers/${r.slot}/${r.id}.mjs`) add("adapter-path", r.id, `adapter ${r.adapter} is not providers/${r.slot}/${r.id}.mjs`);
    const ap = r.adapter ? resolve(registryDir, r.adapter) : null;
    if (ap) referenced.add(ap);
    if (r.status === "vetted") {
      if (!(typeof r.vetted_by === "string" && ULID.test(r.vetted_by))) add("vetted-by", r.id, "vetted without a decision.recorded id in vetted_by (ADR-1705)");
      if (!r.scout) add("vetted-scout", r.id, "vetted without a /arc-capability scout record");
      if (!r.digest) add("vetted-digest", r.id, "vetted without a pinned digest");
    }
    if (ap && !existsSync(ap)) {
      if (r.status === "vetted") add("row-without-adapter", r.id, `vetted row's adapter ${r.adapter} does not exist`);
      else R.push(`candidate-unbuilt ${r.id}`);
      continue;
    }
    if (ap && r.digest && adapterDigest(ap) !== r.digest) add("digest-drift", r.id, `adapter changed since vet -- the row reads as candidate until re-vetted (ADR-1719)`);
  }
  for (const s of slots) if (s && s.tier === "core" && !rows.some((r) => r && r.slot === s.id)) add("slot-without-provider", s.id, "core slot with no provider row (required-tier rows arrive in Cycle 2)");

  const realRef = new Set([...referenced].filter(existsSync).map((p) => realpathSync(p)));
  for (const file of walkMjs(providersDir)) {
    if (!realRef.has(realpathSync(file))) add("adapter-without-row", posix(relative(process.cwd(), file)), "adapter file with no registry row");
    for (const f of adapterFindings(file, providersDir)) add(f.rule, posix(relative(process.cwd(), file)), f.msg);
  }
  return { findings: F, reports: R, counts: { slots: slots.length, rows: rows.length } };
}

// ---------- mutant self-test: every rule this gate claims, broken once, must be refused ----------
const CLEAN_ADAPTER = [
  'export const id = "probe-dns";',
  'export const slot = "dns";',
  "export async function scaffold(ctx) { return { files: [], resources: [], notes: [] }; }",
  'export function envContract() { return []; }',
  'export async function verify(ctx) { const r = await ctx.fetch("https://api.cloudflare.com/client/v4"); return { ok: r.ok, answerer: "api.cloudflare.com" }; }',
  "export async function teardown(ctx) { return { steps: [] }; }",
  "",
].join("\n");

function block(text, id, fn) {
  const start = text.indexOf(`  - id: ${id}\n`);
  if (start < 0) throw new Error(`mutant: no block ${id}`);
  const next = text.indexOf("\n  - id: ", start + 1);
  const end = next < 0 ? text.length : next + 1;
  return text.slice(0, start) + fn(text.slice(start, end)) + text.slice(end);
}
const must = (t, a, b) => { if (!t.includes(a)) throw new Error(`mutant edit target missing: ${a}`); return t.replace(a, b); };

function baseline(dir) {
  const providersDir = join(dir, "providers");
  mkdirSync(join(providersDir, "dns"), { recursive: true });
  const catalog = join(dir, "launch.slots.yaml");
  const registry = join(dir, "launch.providers.yaml");
  // The mutants edit LF literals, so the copies are LF whatever the checkout did -- an autocrlf Windows leg would
  // otherwise crash every mutant on a missing edit target (attack 3b48ed1 B14).
  writeFileSync(catalog, readFileSync(PATHS.catalog, "utf8").replace(/\r\n/g, "\n"));
  const adapter = join(providersDir, "dns", "probe-dns.mjs");
  writeFileSync(adapter, CLEAN_ADAPTER);
  let reg = readFileSync(PATHS.registry, "utf8").replace(/\r\n/g, "\n");
  reg += [
    "  - id: probe-dns", "    slot: dns", "    status: vetted", "    hosts:", "      - api.cloudflare.com",
    "    adapter: providers/dns/probe-dns.mjs", `    digest: ${adapterDigest(adapter)}`, "    approved_by: ashiq",
    "    vetted_by: 01M40ZHP72PYVBJT17R7A4WZ3W", "    scout: docs/capability/probe-dns.md", "",
  ].join("\n");
  writeFileSync(registry, reg);
  return { catalog, registry, providersDir, adapter };
}

const MUTANTS = [
  ["row-without-adapter", (b) => rmSync(b.adapter)],
  ["adapter-without-row", (b) => writeFileSync(join(b.providersDir, "dns", "stray.mjs"), CLEAN_ADAPTER)],
  ["unknown-slot", (b) => edit(b.registry, (t) => block(t, "probe-dns", (x) => must(x, "slot: dns", "slot: dnz")))],
  ["slot-names-provider", (b) => edit(b.catalog, (t) => block(t, "hosting", (x) => must(x, "    tier: core\n", "    tier: core\n    provider: vercel\n")))],
  ["vetted-by", (b) => edit(b.registry, (t) => block(t, "probe-dns", (x) => must(x, "vetted_by: 01M40ZHP72PYVBJT17R7A4WZ3W", "vetted_by: null")))],
  ["approved-by", (b) => edit(b.registry, (t) => block(t, "cloudflare-dns", (x) => must(x, "approved_by: ashiq", "approved_by: claude")))],
  ["yaml", (b) => edit(b.catalog, (t) => block(t, "dns", (x) => must(x, "    depends_on:\n      - domain\n", "    depends_on: [domain]\n")))],
  ["dag-cycle", (b) => edit(b.catalog, (t) => block(t, "domain", (x) => must(x, "    tier: core\n", "    tier: core\n    depends_on:\n      - dns\n")))],
  ["core-to-noncore", (b) => edit(b.catalog, (t) => block(t, "dns", (x) => must(x, "      - domain\n", "      - domain\n      - email-inbox\n")))],
  ["edge-unresolved", (b) => edit(b.catalog, (t) => block(t, "dns", (x) => must(x, "      - domain\n", "      - domain\n      - nosuch-slot\n")))],
  ["default-word", (b) => edit(b.registry, (t) => t + "# a default provider for dns\n")],
  ["zero-dep-leg", (b) => edit(b.adapter, (t) => `import x from "lodash";\n${t}`, true)],
  ["verify-is-probe", (b) => edit(b.adapter, (t) => must(t, 'const r = await ctx.fetch("https://api.cloudflare.com/client/v4"); return { ok: r.ok, answerer: "api.cloudflare.com" };', 'return { ok: true, answerer: "self" };'), true)],
];

function edit(path, fn, repin = false) {
  writeFileSync(path, fn(readFileSync(path, "utf8")));
  // An adapter mutant re-pins its digest so the rule under test -- not digest drift -- is what must refuse it.
  if (repin) {
    const reg = join(dirname(dirname(dirname(path))), "launch.providers.yaml");
    writeFileSync(reg, readFileSync(reg, "utf8").replace(/digest: [0-9a-f]{64}/, `digest: ${adapterDigest(path)}`));
  }
}

function selftest() {
  const root = mkdtempSync(join(tmpdir(), "launch-lint-"));
  try {
    const b0 = baseline(join(root, "baseline"));
    const clean = lint(b0);
    if (clean.findings.length) {
      console.log(`selftest: BASELINE NOT CLEAN -- ${clean.findings.length} finding(s); every mutant below would pass vacuously`);
      for (const f of clean.findings) console.log(`  ${f.rule} ${f.id}: ${f.msg}`);
      return 1;
    }
    console.log(`RAN baseline clean (${clean.counts.slots} slots, ${clean.counts.rows} rows)`);
    let refused = 0;
    for (const [name, mutate] of MUTANTS) {
      const dir = join(root, name);
      const b = baseline(dir);
      mutate(b);
      const got = lint(b).findings;
      console.log(`RAN mutant ${name}`);
      if (got.some((f) => f.rule === name)) { refused++; console.log(`REFUSED ${name}`); }
      else console.log(`MISSED ${name} -- got: ${got.map((f) => f.rule).join(", ") || "nothing"}`);
    }
    console.log(`${refused}/${MUTANTS.length} mutants refused`);
    return refused === MUTANTS.length ? 0 : 1;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function main(argv) {
  if (argv.includes("--mutant-selftest")) return selftest();
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const k = { "--catalog": "catalog", "--registry": "registry", "--providers-dir": "providersDir" }[argv[i]];
    if (!k || argv[i + 1] === undefined) { console.log(`launch-lint: unknown or valueless flag ${argv[i]}`); return 2; }
    o[k] = resolve(argv[++i]);
  }
  const { findings, reports, counts } = lint(o);
  for (const f of findings) console.log(`FAIL [${f.rule}] ${f.id}: ${f.msg}`);
  if (findings.length) { console.log(`launch-lint: ${findings.length} finding(s)`); return 1; }
  console.log(`launch-lint: ok -- ${counts.slots} slots, ${counts.rows} provider rows, ${reports.length} candidate-unbuilt`);
  return 0;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) process.exitCode = main(process.argv.slice(2));
