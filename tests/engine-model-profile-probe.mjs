#!/usr/bin/env node
// engine-model-profile-probe.mjs -- the driver for tests/engine-model-profile.bats (model-policy v2, ADR-1800..1802).
//
// WHY A PROBE AND NOT BARE BATS. The assertion that matters is what the GATEWAY received -- the path, the bearer key
// and the model id -- and that needs a listener running while arc-run runs. A closed port proves only the endpoint
// (the plan attack's finding 3), and ARC_DRIVER_FAKE short-circuits every driver, generic-api included, so neither can
// show which key or model reached the provider. The listener lives here, in one node process, with arc-run spawned
// ASYNC beside it: a spawnSync would block the event loop the listener answers on.
//
// usage: node engine-model-profile-probe.mjs <case> <fixtureRoot> <scratchDir>
// Prints KEY=value lines, then RAN as the last line -- a probe that died early prints no RAN, and every test checks it.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [kase, fixtureRoot, scratch] = process.argv.slice(2);
if (!kase || !fixtureRoot || !scratch) { console.error("usage: <case> <fixtureRoot> <scratchDir>"); process.exit(64); }
mkdirSync(scratch, { recursive: true });

// ---------- load faults (ADR-1802), no listener needed ----------
if (kase === "faults") {
  const { routerFaults } = await import("../.claude/scripts/engine/router-row.mjs");
  const { parseYamlSubset } = await import("../.claude/scripts/engine/yaml-subset.mjs");
  // ADR-0228: every row carries its chain terms, so the counts below measure the profile rule and nothing else.
  const TERMS = { max_attempts: 3, max_wall_ms: 3600000, max_cost: "unmetered" };
  const row = (extra) => ({ classes: { c: { tier: "t", driver: "generic-api", fallback: [], ...TERMS, ...extra } } });
  const cases = {
    BAD_GRAMMAR: row({ profile: "has space" }),
    UNREACHABLE: { classes: { c: { tier: "t", driver: "claude-code", fallback: ["codex"], profile: "fx", ...TERMS } } },
    WRONG_DRIVER: { models: { t: { "claude-code": "profile:fx" } }, classes: {} },
    BARE: { models: { t: { "generic-api": "profile:" } }, classes: {} },
    NOT_STRING: row({ profile: 7 }),
  };
  for (const [k, r] of Object.entries(cases)) {
    const f = routerFaults(r);
    console.log(`${k}=${f.length}`);
    if (f.length) console.log(`${k}_MSG=${f[0]}`);
  }
  // The controls: a reachable class profile through a FALLBACK loads, and so does the real router file.
  console.log(`FALLBACK_OK=${routerFaults({ classes: { c: { tier: "t", driver: "claude-code", fallback: ["generic-api"], profile: "fx", ...TERMS } } }).length}`);
  console.log(`PIN_OK=${routerFaults({ models: { t: { "generic-api": "profile:omni-ds", "claude-code": "opus" } }, classes: {} }).length}`);
  const real = parseYamlSubset(readFileSync(join(ARC_ROOT, "engine", "router.yaml"), "utf8"));
  console.log(`REAL_PARSED=${real.ok ? 1 : 0}`);
  console.log(`REAL_FAULTS=${real.ok ? routerFaults(real.value).length : -1}`);
  console.log("RAN");
  process.exit(0);
}

// Recognisable, and deliberately not shaped like any real provider's key: the repo's secret tripwire reads this file.
const KEY_FX = "planted-profile-key-fx-000001";
const KEY_FY = "planted-profile-key-fy-000002";
const DECOY_KEY = "decoy-ambient-key-000003";
const out = (k, v) => console.log(`${k}=${v}`);

/** A listener that records every request and answers 400 -- not retryable, so each attempt makes exactly one call. */
function listen() {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => { raw += d; });
    req.on("end", () => {
      let body = null;
      try { body = JSON.parse(raw); } catch { /* recorded as null */ }
      const auth = String(req.headers.authorization ?? "");
      requests.push({ path: String(req.url), bearer: auth.startsWith("Bearer ") ? auth.slice(7) : null, model: body?.model ?? null });
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "probe listener: recorded, refusing on purpose" } }));
    });
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, requests, port: server.address().port })));
}

function writeRouter({ pin, driver = "generic-api", fallback = [], profile }) {
  const lines = [
    "version: 1",
    "tiers:",
    "  - balanced-workhorse",
    "models:",
    "  balanced-workhorse:",
    "    claude-code: sonnet",
    ...(pin ? [`    generic-api: ${pin}`] : []),
    "classes:",
    "  commit-msg-draft:",
    "    tier: balanced-workhorse",
    `    driver: ${driver}`,
    ...(fallback.length ? ["    fallback:", ...fallback.map((f) => `      - ${f}`)] : ["    fallback: []"]),
    ...(profile !== undefined ? [`    profile: ${profile}`] : []),
    // ADR-0228 chain terms; mock is the one metering driver, so a chain holding it carries paise.
    `    max_attempts: ${fallback.length + 2}`,
    "    max_wall_ms: 3600000",
    `    max_cost: ${[driver, ...fallback].includes("mock") ? 100000 : "unmetered"}`,
    "",
  ];
  writeFileSync(join(fixtureRoot, "engine", "router.yaml"), lines.join("\n"));
}

function writeStore(path, records) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ schema: 1, active: records[0]?.name ?? null, models: records }, null, 2));
}

function runArc(args, env) {
  return new Promise((r) => {
    // A hard deadline: a hung arc-run must fail this case, never stall the shard (attack d63004e B4).
    let timer;
    const child = spawn(process.execPath, [join(fixtureRoot, ".claude/scripts/engine/arc-run.mjs"), "--process", "commit-msg-draft", ...args, "--root", fixtureRoot], {
      env, cwd: fixtureRoot, windowsHide: true,
    });
    let text = "";
    child.stdout.on("data", (d) => { text += d; });
    child.stderr.on("data", (d) => { text += d; });
    timer = setTimeout(() => { text += " PROBE: arc-run killed at the 90 s deadline"; child.kill("SIGKILL"); }, 90_000);
    child.on("close", (code) => { clearTimeout(timer); r({ code, text }); });
  });
}

function spineHolds(needle) {
  const root = process.env.ARC_SPINE_ROOT;
  if (!root || !existsSync(root)) return false;
  const walk = (d) => readdirSync(d).some((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : readFileSync(p, "utf8").includes(needle);
  });
  return walk(root);
}

const { server, requests, port } = await listen();
const base = `http://127.0.0.1:${port}/v1`;
const storePath = join(scratch, "store", "models.json");
const cliMark = join(scratch, "cli-mark.txt");
// Every ambient value a profile run must NOT use is set to a decoy, the endpoint included. The decoy endpoint is a
// closed port, so a run that fell back to it would fail at transport and the listener would record nothing.
const env = {
  ...process.env,
  ARC_FACE_MODELS_FILE: storePath,
  ARC_LLM_ENDPOINT: "http://127.0.0.1:1/v1/chat/completions",
  ARC_LLM_API_KEY: DECOY_KEY,
  ARC_LLM_MODEL: "decoy-ambient-model",
  ARC_DRIVER_MODEL: "decoy-driver-model",
  ARC_LLM_TIMEOUT_MS: "5000",
  ARC_CLAUDE_CLI: join(ARC_ROOT, "tests/fixtures/engine/fail-claude-cli.mjs"),
  ARC_TEST_CLI_MARK: cliMark,
};
delete env.ARC_DRIVER_FAKE;
const FX = { name: "fx", baseUrl: base, model: "vendor/model-fx", key: KEY_FX };
const FY = { name: "fy", baseUrl: base, model: "vendor/model-fy", key: KEY_FY };

let res;
let args = ["--driver", "auto"];
switch (kase) {
  case "tier-pin":
    writeStore(storePath, [FX]); writeRouter({ pin: "profile:fx" }); break;
  case "class-override":
    writeStore(storePath, [FX, FY]); writeRouter({ pin: "profile:fx", profile: "fy" }); break;
  case "hop":
    // ADR-0228: a fallback is taken only for a failure another driver could fix. claude-code declares exactly one,
    // a CLI that cannot start, so attempt 1 points at a CLI that is not there; the fake CLI's undeclared exit 1 is
    // `unknown` and never hops (asserted by tests/engine-failure-class.mjs).
    env.ARC_CLAUDE_CLI = join(scratch, "no-such-claude-cli");
    writeStore(storePath, [FY]); writeRouter({ driver: "claude-code", fallback: ["generic-api"], profile: "fy" }); break;
  case "gone":
    writeStore(storePath, [FX]); writeRouter({ driver: "claude-code", fallback: ["generic-api"], profile: "gone" }); break;
  case "no-store":
    // The decoy endpoint is the LISTENER here, with a decoy model: a run that fell back to the ambient environment
    // would reach it, so zero requests is a real observation and not a closed port's silence.
    env.ARC_LLM_ENDPOINT = `${base}/chat/completions`;
    env.ARC_FACE_MODELS_FILE = join(scratch, "nowhere", "models.json");
    writeRouter({ pin: "profile:fx" }); break;
  case "store-in-root":
    env.ARC_FACE_MODELS_FILE = join(fixtureRoot, "models.json");
    writeStore(env.ARC_FACE_MODELS_FILE, [FX]); writeRouter({ pin: "profile:fx" }); break;
  case "case-fold":
    writeStore(storePath, [FX]); writeRouter({ pin: "profile:fx", profile: "FX" }); break;
  case "remote-http":
    writeStore(storePath, [{ ...FX, baseUrl: "http://example.invalid/v1" }]); writeRouter({ pin: "profile:fx" }); break;
  case "named-driver":
    // A named driver consults no tier (ADR-0220) and so no profile: the ambient endpoint and key are used exactly as
    // before. The endpoint is pointed at the listener so the key that WAS sent can be observed.
    env.ARC_LLM_ENDPOINT = `${base}/chat/completions`;
    writeStore(storePath, [FX]); writeRouter({ pin: "profile:fx" });
    args = ["--driver", "generic-api", "--trial-model", "vendor/trial-model"]; break;
  case "dry-run":
    writeStore(storePath, [FX]); writeRouter({ pin: "profile:fx" }); args = ["--driver", "auto", "--dry-run"]; break;
  case "dry-run-missing":
    env.ARC_FACE_MODELS_FILE = join(scratch, "nowhere", "models.json");
    writeRouter({ pin: "profile:fx" }); args = ["--driver", "auto", "--dry-run"]; break;
  case "corrupt-store":
    // A half-saved store with a key in it: the refusal may not print any of the file's content (attack d63004e B1).
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, `{"schema":1,"active":"fx","models":[{"name":"fx","baseUrl":"${base}","model":"m","key":"${KEY_FX}" `);
    writeRouter({ pin: "profile:fx" }); break;
  default:
    console.error(`unknown case ${kase}`); process.exit(64);
}
res = await runArc(args, env);
server.closeAllConnections?.();
server.close();

const all = [KEY_FX, KEY_FY].some((k) => res.text.includes(k));
out("EXIT", res.code);
out("PORT", port);
out("REQUESTS", requests.length);
for (const [i, q] of requests.entries()) {
  out(`REQ${i}_PATH`, q.path);
  out(`REQ${i}_MODEL`, q.model);
  out(`REQ${i}_BEARER`, q.bearer === KEY_FX ? "KEY_FX" : q.bearer === KEY_FY ? "KEY_FY" : q.bearer === DECOY_KEY ? "DECOY" : "OTHER");
}
out("KEY_IN_OUTPUT", all ? 1 : 0);
out("KEY_IN_SPINE", spineHolds(KEY_FX) || spineHolds(KEY_FY) ? 1 : 0);
out("CLI_RAN", existsSync(cliMark) ? readFileSync(cliMark, "utf8").trim().replace(/\n/g, " | ") : "no");
// The first attempt as the receipt records it (ADR-0228 hops[]): driver, the model it was handed, and its class.
{
  let hop0 = null;
  const root = process.env.ARC_SPINE_ROOT;
  const ev = root && existsSync(join(root, "events")) ? readdirSync(join(root, "events")) : [];
  for (const f of ev) for (const l of readFileSync(join(root, "events", f), "utf8").split("\n")) {
    try { const e = JSON.parse(l); if (e.kind === "run.completed" && Array.isArray(e.payload?.hops) && e.payload.hops.length) hop0 = e.payload.hops[0]; } catch { /* not a record */ }
  }
  out("HOP0_DRIVER", hop0 ? hop0.driver : "none");
  out("HOP0_MODEL", hop0 ? String(hop0.model) : "none");
  out("HOP0_CLASS", hop0 ? String(hop0.class) : "none");
}
// The run's own words, last-but-one, so a failing assertion shows them.
console.log("---- arc-run output ----");
console.log(res.text.trim());
console.log("RAN");
