#!/usr/bin/env node
// design-refpack.mjs -- adds ONE screen to a brief's reference pack (REQ-04, ADR-1404 / ADR-1408 /
// ADR-1412). Phase 02 slice B. The design-curator calls it once per screen.
//
// The order is the contract, and each step refuses before the next one can touch anything:
//
//   1. the REGISTRY decides whether this source may serve a pack at all -- before the network.
//      An id absent from the registry, a status other than `active`, an allowed_use without
//      `reference-pack`, an access other than `fetch`: each refuses with ZERO attempts, and
//      attempts.log proves it. status and allowed_use are different questions -- awwwards is
//      active and fetchable and still may not be cached, because its terms allow a link only.
//   2. the ROBOTS PREFLIGHT (design-robots.mjs) for this exact URL. Its answer -- ALLOW,
//      DISALLOW or UNREADABLE -- is appended to availability.log whatever it is. A refusal that
//      is not written down is a silent skip, and a pack that quietly came from one source reads
//      exactly like a pack that came from two.
//   3. the ROW has an adaptable principle and an avoid-this. Checked after the preflight so a
//      refusal is recorded even for a half-specified call, and before the screen is fetched.
//   4. the FETCH. The image goes to .claude/state/design/refpacks/<brief>/ (gitignored); the
//      facts about it go to docs/design/refpacks/<brief>/sources.md (committed). The sha is the
//      sha of the bytes written, never of the URL.
//
// sources.md is marked intent-to-add (`git add -N`). Provenance is the half of the pack that
// must be committed, and an untracked file in a new directory is exactly what gets forgotten.
//
// Offline-first: --robots-file / --robots-status / --fixture select the fake transport, and it
// records every attempt the same way the real one does.
//
// Usage:  design-refpack.mjs --brief <id> --source <registry id> --url <screen url>
//           --principle <text> --avoid <text> [--registry <path>]
//           [--robots-file <path> | --robots-status <n>] [--fixture <path>]
// Exit:   0 added | 1 usage or unreadable registry | 2 registry refusal | 3 DISALLOW |
//         4 UNREADABLE | 5 the screen fetch failed

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_UA, EXIT, fakeTransport, parseHttpUrl, preflight, realTransport } from "./design-robots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const IMAGE_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };

function fail(code, msg) {
  console.error(`design-refpack: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const known = new Set(["--brief", "--source", "--url", "--principle", "--avoid", "--registry", "--robots-file", "--robots-status", "--fixture"]);
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(1, `unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") fail(1, `${k} needs a value`);
    if (k in opts) fail(1, `${k} given twice`);
    opts[k] = argv[i + 1];
  }
  return opts;
}

// One markdown table cell: a pipe or a line break inside a principle must not become a column.
function cell(v) {
  return String(v).replace(/\r\n|\r|\n/g, " ").replace(/\|/g, "\\|").trim();
}

async function loadRegistry(path) {
  let parseYamlSubset;
  try {
    ({ parseYamlSubset } = await import(pathToFileURL(join(ROOT, ".claude", "scripts", "engine", "yaml-subset.mjs")).href));
  } catch (e) {
    fail(1, `cannot load the repo yaml subset parser: ${e.message}`);
  }
  if (!existsSync(path)) fail(1, `registry not found: ${path}`);
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed || parsed.ok === false) fail(1, `registry unreadable: ${path}`);
  const doc = parsed.doc ?? parsed.value ?? parsed;
  if (!doc || !Array.isArray(doc.sources)) fail(1, `registry has no sources list: ${path}`);
  return doc.sources;
}

function asList(v) {
  return Array.isArray(v) ? v.map(String) : [];
}

async function main(argv) {
  const o = parseArgs(argv);
  for (const k of ["--brief", "--source", "--url"]) if (!o[k]) fail(1, `${k} is required`);
  if (!ID.test(o["--brief"])) fail(1, `--brief must match ${ID}, got '${o["--brief"]}'`);
  const url = parseHttpUrl(o["--url"]);
  if (!url) fail(1, `--url must be an http(s) URL with a host, got '${o["--url"]}'`);
  if (o["--robots-status"] != null && !/^[1-5][0-9][0-9]$/.test(o["--robots-status"])) fail(1, "--robots-status must be an HTTP status");

  const brief = o["--brief"];
  const stateDir = join(ROOT, ".claude", "state", "design", "refpacks", brief);
  const attemptsLog = join(stateDir, "attempts.log");
  const availabilityLog = join(stateDir, "availability.log");
  const sourcesMd = join(ROOT, "docs", "design", "refpacks", brief, "sources.md");

  // 1. registry -- nothing below this block runs for a source that may not serve a pack.
  const sources = await loadRegistry(o["--registry"] ? resolve(o["--registry"]) : join(ROOT, "design.sources.yaml"));
  const id = o["--source"];
  const src = sources.find((s) => s && String(s.id) === id);
  if (!src) fail(2, `refused: source '${id}' is not in the registry; an unregistered source is never unrestricted`);
  if (String(src.status) !== "active") fail(2, `refused: source '${id}' has status: ${src.status}; only an active source is fetched`);
  if (!asList(src.allowed_use).includes("reference-pack")) {
    fail(2, `refused: source '${id}' allowed_use is [${asList(src.allowed_use).join(", ")}] and lacks reference-pack; it may be linked, not cached`);
  }
  if (String(src.access) !== "fetch") fail(2, `refused: source '${id}' has access: ${src.access}; this builder only fetches`);

  // Every attempt is written BEFORE it is made, so a crash mid-request still counts.
  const fake = o["--robots-file"] != null || o["--robots-status"] != null || o["--fixture"] != null;
  const inner = fake
    ? fakeTransport({ robotsFile: o["--robots-file"] ?? null, robotsStatus: o["--robots-status"] ?? null, fixture: o["--fixture"] ?? null })
    : realTransport({ ua: DEFAULT_UA });
  mkdirSync(stateDir, { recursive: true });
  const transport = {
    async get(target) {
      appendFileSync(attemptsLog, `${new Date().toISOString()}\t${id}\tGET\t${target}\n`);
      return inner.get(target);
    },
  };

  // 2. robots preflight, recorded whatever it says.
  const d = await preflight({ url, ua: DEFAULT_UA, transport });
  appendFileSync(availabilityLog, `${new Date().toISOString()}\t${id}\t${url.href}\t${d.verdict}\t${d.reason}\n`);
  if (d.verdict !== "ALLOW") fail(EXIT[d.verdict], `${d.verdict} ${url.href} -- ${d.reason}`);

  // 3. a row without a principle is not evidence.
  const principle = (o["--principle"] || "").trim();
  const avoid = (o["--avoid"] || "").trim();
  if (!principle) fail(1, "--principle is required: a row with no adaptable principle is not evidence");
  if (!avoid) fail(1, "--avoid is required: every row names what not to copy");

  // 4. fetch, cache, record.
  let res;
  try { res = await transport.get(url.href); } catch (e) {
    appendFileSync(availabilityLog, `${new Date().toISOString()}\t${id}\t${url.href}\tFETCH-FAILED\t${e && e.message ? e.message : "transport error"}\n`);
    fail(5, `the screen could not be fetched: ${e && e.message ? e.message : "transport error"}`);
  }
  const type = String(res.contentType || "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_EXT[type];
  const bad = res.tooLarge ? "larger than the size cap"
    : !(res.status >= 200 && res.status < 300) ? `HTTP ${res.status}`
    : !ext ? `not an image (content-type '${type || "none"}')`
    : res.body.length === 0 ? "an empty body" : null;
  if (bad) {
    appendFileSync(availabilityLog, `${new Date().toISOString()}\t${id}\t${url.href}\tFETCH-FAILED\t${bad}\n`);
    fail(5, `the screen was not cached: ${bad}`);
  }
  const sha = createHash("sha256").update(res.body).digest("hex");
  const image = join(stateDir, `${id}-${sha.slice(0, 16)}.${ext}`);
  writeFileSync(image, res.body);

  mkdirSync(dirname(sourcesMd), { recursive: true });
  if (!existsSync(sourcesMd)) {
    writeFileSync(sourcesMd, `# Reference pack -- ${brief}\n\nProvenance only (ADR-1404): the images are cached under \`.claude/state/design/refpacks/${brief}/\` and never committed.\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n`);
  }
  appendFileSync(sourcesMd, `| ${cell(url.href)} | ${new Date().toISOString()} | ${sha} | ${cell(id)} | ${cell(principle)} | ${cell(avoid)} |\n`);
  spawnSync("git", ["-C", ROOT, "add", "-N", "--", relative(ROOT, sourcesMd).split("\\").join("/")], { stdio: "ignore" });

  console.log(`added ${url.href} from ${id} -> ${relative(ROOT, image).split("\\").join("/")} (sha256 ${sha})`);
}

await main(process.argv.slice(2));
