// Builds a self-contained launch fixture under DIR: catalog, registry (digests pinned from the copied adapter),
// ventures dir, providers dir, an empty venture root, a provider file and a temp spine. Prints `export KEY='v'` lines
// for `eval`, and refuses (exit 1) if the fixture it built is missing a part -- an empty fixture passes everything.
//   node tests/launch/make-fixture.mjs DIR
import { mkdirSync, writeFileSync, cpSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { adapterDigest } from "../../.claude/scripts/launch/lib/scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2]);
const prov = join(dir, "providers", "probe");
mkdirSync(prov, { recursive: true });
for (const d of ["ventures", "venture-root", "state", "spine"]) mkdirSync(join(dir, d), { recursive: true });
cpSync(join(HERE, "fixtures", "providers", "probe", "fake.mjs"), join(prov, "fake.mjs"));
const digest = adapterDigest(join(prov, "fake.mjs"));

const slot = (id, extra = []) => [
  `  - id: ${id}`, "    group: delivery", "    tier: core", "    exit_criteria:", "      - \"the fake provider holds both resources\"",
  `    verify: ${id}-probe`, ...extra, "    resume: resources", "    required_when: always",
];
writeFileSync(join(dir, "catalog.yaml"), ["slots:",
  ...slot("probe", ["    gate: none", "    approval: false", "    timeout: 60"]),
  ...slot("slow", ["    gate: none", "    approval: false", "    timeout: 2"]),
  ...slot("after-probe", ["    depends_on:", "      - probe", "    gate: none", "    approval: false", "    timeout: 60"]),
  ...slot("gated", ["    gate: gate-2", "    approval: true", "    timeout: 60"]),
  ...slot("live-money", ["    gate: gate-3", "    approval: true", "    timeout: 60"]),
  ...slot("sens", ["    gate: none", "    approval: true", "    timeout: 60"]),
  "  - id: no-money", "    group: money", "    tier: core", "    exit_criteria:", "      - \"skipped for gateway ventures\"",
  "    verify: no-money-probe", "    gate: none", "    approval: false", "    timeout: 60", "    resume: resources", "    required_when: \"payment_model == none\"",
  ""].join("\n"));

const row = (slotId, extra = []) => [
  `  - id: fake`, `    slot: ${slotId}`, "    status: vetted", "    hosts:", "      - fixture.invalid",
  // The worker strips every key a row does not declare before the adapter loads, so the fake's steering knobs are
  // declared here exactly as a real provider's token would be.
  "    env_keys:", ...["FAKE_PROVIDER_FILE", "FAKE_DIE_AFTER", "FAKE_DIE_BEFORE_REPORT", "FAKE_KILL_PARENT", "FAKE_SLEEP_MS",
    "FAKE_HOLD_MS", "FAKE_FETCH_HOST", "FAKE_WRITE", "FAKE_SENSITIVE", "FAKE_PRINT_UPSTREAM", "FAKE_NEEDS_KEY", "LAUNCH_FIXTURE_ABSENT_KEY"].map((k) => `      - ${k}`),
  "    adapter: providers/probe/fake.mjs", `    digest: ${digest}`, "    approved_by: ashiq",
  "    vetted_by: 01M40ZHP72PYVBJT17R7A4WZ3W", "    scout: tests/launch/fixtures/scout.md", ...extra,
];
writeFileSync(join(dir, "registry.yaml"), ["providers:",
  ...["probe", "slow", "after-probe", "gated", "live-money", "no-money"].flatMap((s) => row(s)),
  ...row("sens", ["    sensitive_actions:", "      - delete"]),
  ""].join("\n"));

writeFileSync(join(dir, "ventures", "fx-sandbox.venture.yaml"), [
  "slug: fx-sandbox", "type: saas-b2b", "region: in", "payment_model: gateway", "tenancy: multi", "ai: false",
  "honesty_class: rehearsal", "brand:", "  name: fixture", "  domain: fixture.invalid", ""].join("\n"));

for (const f of ["catalog.yaml", "registry.yaml", "ventures/fx-sandbox.venture.yaml", "providers/probe/fake.mjs"])
  if (!statSync(join(dir, f)).size) { console.error(`make-fixture: ${f} is empty`); process.exit(1); }

const out = {
  FX_DIR: dir,
  FX_FLAGS: `--catalog ${join(dir, "catalog.yaml")} --registry ${join(dir, "registry.yaml")} --providers-dir ${join(dir, "providers")} --ventures-dir ${join(dir, "ventures")} --state-dir ${join(dir, "state")} --venture-root ${join(dir, "venture-root")}`,
  FAKE_PROVIDER_FILE: join(dir, "provider.json"),
  ARC_SPINE_ROOT: join(dir, "spine"),
  FX_STATE: join(dir, "state", "fx-sandbox.json"),
  FX_ADAPTER: join(prov, "fake.mjs"),
};
// Forward slashes: node takes them on Windows, and bash on the Windows leg would read a backslash as an escape.
for (const [k, v] of Object.entries(out)) console.log(`export ${k}='${v.replace(/\\/g, "/")}'`);
