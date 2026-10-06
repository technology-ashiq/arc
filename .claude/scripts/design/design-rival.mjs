#!/usr/bin/env node
// design-rival.mjs -- a rival's draft for a brief, as evidence (Cycle 16 Phase 07 S1+S2, ADR-1409).
//
//   design-rival.mjs draft --brief <brief-id> --run <run-id> [--provider stitch]
//
// PLAN's interface `rival_draft(brief) -> {html, version}`, on ADR-0203's split: pure functions build the
// request from the brief and read the answer, one transport does the I/O. The rival gets the SAME brief
// file the composers get, whole -- a shorter prompt would be a handicap the jury cannot see.
//
// Exactly one status line on stdout, always:
//   rival stitch: DRAFTED <bytes> bytes (stitch-sdk 0.3.5, screen <id>)          exit 0
//   rival stitch: COULD-NOT-DRAFT (<reason>)                                      exit 3
// A provider failure is a named outcome the jury degrades on, never a crash and never a silent skip.
// Reasons: no key · bad key · rate-limit · quota · timeout · install failed · provider error <code> ·
// unusable answer (<why>). Usage errors exit 1 with no status line, because no draft was attempted.
//
// Output, local state only (no rival draft in git -- non-negotiable):
//   .claude/state/design/rivals/<brief>/<run>/stitch/draft.raw.html   the provider's bytes, untouched
//   .claude/state/design/rivals/<brief>/<run>/stitch/receipt.json     version, request hash, schema, timings
//   .claude/state/design/rivals/<brief>/<run>/status.log              one line per attempt
//
// Test seams (ARC_DESIGN_OFFLINE=1 only): --fake-answer <json> replaces the child transport with a recorded
// answer, --record-request <file> writes the request the transport would have sent (the key as a sha256
// prefix, so a test can prove where it went without the key being written down).
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const SEAMS = ["--fake-answer", "--record-request", "--fake-assets"];

// One provider today. A second is a new row here plus its own child file, never a branch in the caller.
const PROVIDERS = {
  stitch: {
    pkg: "@google/stitch-sdk@0.3.5",
    name: "@google/stitch-sdk",
    child: join(HERE, "design-rival-stitch.mjs"),
    keyName: "STITCH_API_KEY",
    deviceType: "DESKTOP",
    // Where the draft's HTML is served from, observed in the Phase 06 spike. Any other host is refused.
    htmlHosts: ["contribution.usercontent.google.com"],
  },
};
const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_CHILD_BYTES = 1024 * 1024;
const DRAFT_DEADLINE_MS = /^[1-9][0-9]{3,6}$/.test(process.env.ARC_DESIGN_RIVAL_BUDGET_MS ?? "") && process.env.ARC_DESIGN_OFFLINE === "1"
  ? Number(process.env.ARC_DESIGN_RIVAL_BUDGET_MS) : 300000;
const INSTALL_DEADLINE_MS = 180000;

function usage(msg) {
  console.error(`design-rival: ${msg}`);
  process.exit(1);
}

function parseNamed(argv, known) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) usage(`unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") usage(`${k} needs a value`);
    if (k in o) usage(`${k} given twice`);
    o[k] = argv[i + 1];
  }
  return o;
}

function id(v, what) {
  if (!ID.test(v) || RESERVED.test(v)) usage(`${what} '${v}' is not an id (a-z, 0-9, -, 64 chars, not a device name)`);
  return v;
}

const sha = (b) => createHash("sha256").update(b).digest("hex");

// One line, one field: nothing a provider says can forge a second status line or a log column.
function field(v) {
  return String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ").trim();
}

// ---------- pure: request and answer ----------

export function buildRequest(provider, briefId, briefText) {
  return { title: `arc-rival-${briefId}`, prompt: briefText, deviceType: provider.deviceType };
}

// A failure's reason, from what the SDK reported. Google answers a bad key inside an MCP result with
// isError (observed in Phase 06: StitchError UNKNOWN_ERROR, "API key not valid"), not with a 401, so the
// text is read, not the code. Quota is tested before rate-limit: Google uses 429 for both.
export function classifyFailure(err) {
  const text = `${err?.name ?? ""} ${err?.code ?? ""} ${err?.message ?? ""}`;
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED/i.test(text)) return "bad key";
  if (/quota|RESOURCE_EXHAUSTED/i.test(text)) return "quota";
  if (/\b429\b|rate.?limit|too many requests/i.test(text)) return "rate-limit";
  if (/timed? ?out|timeout|AbortError|ETIMEDOUT/i.test(text)) return "timeout";
  const code = field(err?.code ?? err?.name ?? "unknown").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40) || "unknown";
  return `provider error ${code}`;
}

// The answer is usable only if it names an https HTML download on a known host. Returns {url} or {why}.
export function readAnswer(provider, answer) {
  if (!answer || typeof answer !== "object") return { why: "not an object" };
  let u;
  try { u = new URL(String(answer.htmlUrl ?? "")); } catch { return { why: "no HTML download URL" }; }
  if (u.protocol !== "https:") return { why: "the HTML URL is not https" };
  if (u.username || u.password) return { why: "the HTML URL carries credentials" };
  if (!provider.htmlHosts.includes(u.hostname)) return { why: `the HTML is served from ${field(u.hostname).slice(0, 80)}, not a known host` };
  return { url: u };
}

// ---------- I/O ----------

// The environment the child and npm see: the system essentials, a private HOME and npm config, and the
// one key. Nothing else of the session's environment reaches the provider's code.
function privateEnv(runDir, extra) {
  const home = join(runDir, "home");
  mkdirSync(join(home, "AppData", "Roaming"), { recursive: true });
  mkdirSync(join(home, "AppData", "Local"), { recursive: true });
  // Two empty files: npm refuses one file loaded as both user and global config.
  writeFileSync(join(runDir, "npmrc-user"), "");
  writeFileSync(join(runDir, "npmrc-global"), "");
  const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP"];
  const env = Object.fromEntries(keep.filter((k) => process.env[k] != null).map((k) => [k, process.env[k]]));
  Object.assign(env, {
    HOME: home, USERPROFILE: home, APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local"),
    npm_config_registry: "https://registry.npmjs.org/", npm_config_ignore_scripts: "true",
    npm_config_userconfig: join(runDir, "npmrc-user"), npm_config_globalconfig: join(runDir, "npmrc-global"),
    npm_config_cache: join(ROOT, ".claude", "state", "design", "rival-sdk", "npm-cache"),
  }, extra);
  return env;
}

// The pinned SDK, installed once into a private directory. Its entry is read from its own package.json
// and must stay inside the install directory. Returns the entry path or null.
function sdkEntry(provider, runDir) {
  const dir = join(ROOT, ".claude", "state", "design", "rival-sdk", provider.pkg.replace(/[^abcdefghijklmnopqrstuvwxyz0123456789.@-]/gi, "_"));
  const pkgDir = join(dir, "node_modules", ...provider.name.split("/"));
  const pj = join(pkgDir, "package.json");
  if (!existsSync(pj)) {
    const cli = [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")].find((p) => existsSync(p));
    if (!cli) return null;
    mkdirSync(dir, { recursive: true });
    const r = spawnSync(process.execPath, [cli, "install", "--prefix", dir, "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", provider.pkg],
      { cwd: runDir, env: privateEnv(runDir, {}), stdio: "ignore", windowsHide: true, timeout: INSTALL_DEADLINE_MS });
    if (r.error || r.status !== 0 || !existsSync(pj)) return null;
  }
  let rel;
  try {
    const p = JSON.parse(readFileSync(pj, "utf8"));
    if (p.version !== provider.pkg.slice(provider.pkg.lastIndexOf("@") + 1)) return null;
    const dot = p.exports && p.exports["."];
    rel = (dot && typeof dot === "object" ? dot.import : dot) ?? p.main;
  } catch { return null; }
  const entry = resolve(pkgDir, String(rel ?? ""));
  return rel && entry.startsWith(resolve(pkgDir) + sep) && existsSync(entry) ? entry : null;
}

// The real transport: the child file, the request on stdin, one JSON line back, a hard deadline.
function childTransport(provider, entry, key, req, runDir) {
  return new Promise((done) => {
    const env = privateEnv(runDir, { [provider.keyName]: key });
    const child = spawn(process.execPath, [provider.child, entry], { cwd: runDir, env, shell: false, stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    let out = "";
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; clearTimeout(timer); try { child.kill(); } catch { /* already gone */ } done(v); };
    const timer = setTimeout(() => finish({ ok: false, error: { name: "Timeout", code: "TIMEOUT", message: `no answer within ${DRAFT_DEADLINE_MS} ms (timeout)` } }), DRAFT_DEADLINE_MS);
    child.on("error", (e) => finish({ ok: false, error: { name: "SpawnError", code: e.code ?? null, message: e.message } }));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      out += d;
      if (Buffer.byteLength(out) > MAX_CHILD_BYTES) finish({ ok: false, error: { name: "TooLarge", code: "TOO_LARGE", message: "the transport printed more than 1 MiB" } });
    });
    child.on("close", () => {
      const line = out.split("\n").find((l) => l.trim().length > 0);
      let v;
      try { v = JSON.parse(line ?? ""); } catch { v = undefined; }
      finish(v && typeof v === "object" ? v : { ok: false, error: { name: "NoAnswer", code: "NO_ANSWER", message: "the transport exited without one JSON answer" } });
    });
    child.stdin.on("error", () => { /* reported by close */ });
    child.stdin.end(JSON.stringify(req));
  });
}

async function download(url) {
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (res.status !== 200) throw Object.assign(new Error(`the HTML download answered ${res.status}`), { code: `HTTP_${res.status}` });
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_HTML_BYTES) throw Object.assign(new Error("the HTML is larger than the cap"), { code: "TOO_LARGE" });
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_HTML_BYTES) throw Object.assign(new Error("the HTML is larger than the cap"), { code: "TOO_LARGE" });
  return body;
}

// ---------- vendoring at fetch (S3, ADR-1422) ----------
//
// Every remote asset the draft LOADS is downloaded once, from three hosts only, and the draft's
// src/href targets are pointed at the local copies. Nothing else in the markup changes, and the diff
// is recorded. A load from any other host is left unresolved and NAMED, and the draft leaves the jury:
// a CDN-dependent page cannot be rendered deterministically (Phase 06's finding).
//
// What this destroys, declared (ADR-1422): time-of-render freshness of the Tailwind runtime, and the
// provider's own font-loading behaviour. Layout, colour and content are untouched.
export const ASSET_HOSTS = ["cdn.tailwindcss.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 32 * 1024 * 1024;
const MAX_ASSETS = 200;
// Google Fonts answers by user agent; a current desktop Chrome gets woff2, the format a render uses.
const FONT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const LOAD_TAGS = /<(script|link|img|source|iframe|video|audio|embed|object|track|input)\b[^>]*>/gi;
const LOAD_ATTRS = /\s(src|href|srcset|poster|data)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const CSS_URL = /url\(\s*(["']?)([^"')\s]+)\1\s*\)|@import\s+(["'])([^"']+)\3/gi;

const decodeAttr = (v) => v.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"');
const isRemote = (v) => /^(https?:)?\/\//i.test(v.trim());

// The remote LOADS in one HTML document: [{tag, attr, raw, url, rel}], plus inline-CSS url() refs.
// An anchor's href is navigation, not a load, so <a> is never listed.
export function remoteLoads(html) {
  const out = [];
  for (const t of html.matchAll(LOAD_TAGS)) {
    const tag = t[1].toLowerCase();
    const rel = (/\srel\s*=\s*["']?([^"'\s>]+)/i.exec(t[0])?.[1] ?? "").toLowerCase();
    for (const a of t[0].matchAll(LOAD_ATTRS)) {
      const raw = a[3] ?? a[4] ?? "";
      const attr = a[1].toLowerCase();
      const parts = attr === "srcset" ? raw.split(",").map((s) => s.trim().split(/\s+/)[0]) : [raw];
      for (const p of parts) if (p && isRemote(decodeAttr(p))) out.push({ tag, attr, raw: p, url: decodeAttr(p).replace(/^\/\//, "https://"), rel });
    }
  }
  for (const m of html.matchAll(CSS_URL)) {
    const raw = m[2] ?? m[4];
    if (raw && isRemote(raw)) out.push({ tag: "css", attr: "url", raw, url: raw.replace(/^\/\//, "https://"), rel: "" });
  }
  return out;
}

const assetName = (url, type, bytes) => {
  const ext = /css/.test(type) ? "css" : /javascript|ecmascript/.test(type) ? "js" : /woff2/.test(type) || /\.woff2(\?|$)/.test(url) ? "woff2"
    : /woff/.test(type) ? "woff" : /ttf|truetype/.test(type) ? "ttf" : /otf|opentype/.test(type) ? "otf" : "bin";
  return `${sha(bytes).slice(0, 16)}.${ext}`;
};

// A redirect is followed only on the SAME host, over https, at most 3 hops: the Tailwind CDN answers
// its unversioned URL with a 302 to a pinned version path (observed 2026-10-07, /3.4.17?plugins=...),
// and the final URL is what the record keeps -- the version that was vendored.
async function realAsset(url) {
  let at = new URL(url);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await fetch(at, { redirect: "manual", headers: { "user-agent": FONT_UA }, signal: AbortSignal.timeout(60000) });
    if (res.status >= 300 && res.status < 400) {
      const next = new URL(res.headers.get("location") ?? "", at);
      if (next.protocol !== "https:" || next.hostname !== at.hostname) throw new Error(`redirects off host to ${field(next.hostname).slice(0, 80)}`);
      at = next;
      continue;
    }
    if (res.status !== 200) throw new Error(`answered ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_ASSET_BYTES) throw new Error("larger than the asset cap");
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_ASSET_BYTES) throw new Error("larger than the asset cap");
    return { type: String(res.headers.get("content-type") ?? "").toLowerCase(), body, final: at.href };
  }
  throw new Error("more than 3 redirects");
}

// A recorded asset set for tests: <dir>/index.json maps a URL to {type, file}.
function fakeAssets(dir) {
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  return async (url) => {
    const hit = index[url];
    if (!hit) throw new Error("answered 404");
    return { type: String(hit.type), body: readFileSync(join(dir, hit.file)) };
  };
}

// Returns {html, assets, rewrites} or {unresolved: [why...]}. Never writes outside `assetsDir`.
export async function vendor(html, assetsDir, getAsset) {
  const assets = [];
  const rewrites = [];
  const unresolved = [];
  const cache = new Map();
  let total = 0;
  const allowed = (u) => {
    let x;
    try { x = new URL(u); } catch { return "not a URL"; }
    if (x.protocol !== "https:") return `not https (${field(x.protocol)})`;
    if (x.username || x.password) return "carries credentials";
    if (!ASSET_HOSTS.includes(x.hostname)) return `host ${field(x.hostname).slice(0, 80)} is not an allowed asset host`;
    return null;
  };
  const fetchOne = async (url, depth) => {
    if (cache.has(url)) return cache.get(url);
    const no = allowed(url);
    if (no) { unresolved.push(`${field(url).slice(0, 160)}: ${no}`); cache.set(url, null); return null; }
    if (assets.length >= MAX_ASSETS) { unresolved.push(`more than ${MAX_ASSETS} assets`); cache.set(url, null); return null; }
    let got;
    try { got = await getAsset(url); } catch (e) { unresolved.push(`${field(url).slice(0, 160)}: ${field(e.message).slice(0, 80)}`); cache.set(url, null); return null; }
    total += got.body.length;
    if (total > MAX_TOTAL_ASSET_BYTES) { unresolved.push(`assets pass ${MAX_TOTAL_ASSET_BYTES} bytes in all`); cache.set(url, null); return null; }
    let body = got.body;
    // A stylesheet names its own fonts: vendored one level down, relative to the stylesheet itself.
    if (/css/.test(got.type) && depth === 0) {
      let css = body.toString("utf8");
      for (const ref of remoteLoads(css).filter((r) => r.tag === "css")) {
        const name = await fetchOne(ref.url, 1);
        if (name) { css = css.split(ref.raw).join(name); rewrites.push({ in: "stylesheet", from: field(ref.raw).slice(0, 200), to: name }); }
      }
      body = Buffer.from(css);
    } else if (/css/.test(got.type)) {
      unresolved.push(`${field(url).slice(0, 160)}: a stylesheet imported from a stylesheet`);
      cache.set(url, null);
      return null;
    }
    const name = assetName(url, got.type, body);
    writeFileSync(join(assetsDir, name), body);
    assets.push({ url: field(url).slice(0, 300), ...(got.final && got.final !== url ? { final: field(got.final).slice(0, 300) } : {}), type: field(got.type).slice(0, 80), bytes: body.length, sha256: sha(body), local: `assets/${name}` });
    cache.set(url, name);
    return name;
  };
  let out = html;
  for (const ref of remoteLoads(html)) {
    // A preconnect or dns-prefetch hint loads nothing, but it opens a socket. Pointed at the page's own
    // origin it left an idle connection the loopback server timed out and recorded, refusing the render
    // (observed on the S3 re-render); about:blank opens none and names no host.
    if (ref.tag === "link" && /^(preconnect|dns-prefetch)$/.test(ref.rel)) {
      out = out.split(`"${ref.raw}"`).join(`"about:blank"`);
      rewrites.push({ in: "html", from: field(ref.raw).slice(0, 200), to: "about:blank" });
      continue;
    }
    const name = await fetchOne(ref.url, ref.tag === "css" ? 1 : 0);
    if (!name) continue;
    out = out.split(ref.raw).join(`assets/${name}`);
    rewrites.push({ in: "html", from: field(ref.raw).slice(0, 200), to: `assets/${name}` });
  }
  // Belt and braces: after the rewrite, the page loads nothing remote. A pattern this reader missed
  // is caught here rather than by a jury rendering a half-online page.
  const left = remoteLoads(out).map((r) => r.url);
  for (const u of left) if (!unresolved.some((x) => x.startsWith(field(u).slice(0, 160)))) unresolved.push(`${field(u).slice(0, 160)}: still remote after vendoring`);
  return unresolved.length ? { unresolved: [...new Set(unresolved)] } : { html: out, assets, rewrites };
}

// ---------- the command ----------

async function draft(argv) {
  const o = parseNamed(argv, new Set(["--brief", "--run", "--provider", ...SEAMS]));
  const seamed = SEAMS.filter((k) => o[k] != null);
  if (seamed.length && process.env.ARC_DESIGN_OFFLINE !== "1") usage(`${seamed.join(", ")} ${seamed.length > 1 ? "are test seams" : "is a test seam"}; set ARC_DESIGN_OFFLINE=1`);
  if (o["--brief"] == null || o["--run"] == null) usage("draft needs --brief <brief-id> --run <run-id>");
  const briefId = id(o["--brief"], "--brief");
  const runId = id(o["--run"], "--run");
  const pname = o["--provider"] ?? "stitch";
  if (!Object.hasOwn(PROVIDERS, pname)) usage(`--provider '${pname}' is not a rival arc knows (${Object.keys(PROVIDERS).join(", ")})`);
  const provider = PROVIDERS[pname];
  const briefPath = join(ROOT, "docs", "design", "briefs", briefId, "brief.md");
  if (!existsSync(briefPath)) usage(`no brief at docs/design/briefs/${briefId}/brief.md`);
  const briefText = readFileSync(briefPath, "utf8");
  if (Buffer.byteLength(briefText) > MAX_PROMPT_BYTES) usage(`the brief is larger than ${MAX_PROMPT_BYTES} bytes`);

  const runRoot = join(ROOT, ".claude", "state", "design", "rivals", briefId, runId);
  const out = join(runRoot, pname);
  mkdirSync(out, { recursive: true });
  const startedAt = new Date().toISOString();
  const req = buildRequest(provider, briefId, briefText);
  const receipt = {
    provider: pname, sdk: provider.pkg, mode: seamed.length ? "fake" : "real", brief: briefId, run: runId,
    request: { title: req.title, deviceType: req.deviceType, prompt_bytes: Buffer.byteLength(req.prompt), prompt_sha256: sha(req.prompt) },
    startedAt,
  };

  let key = null;
  const settle = (status, detail) => {
    receipt.finishedAt = new Date().toISOString();
    receipt.status = status;
    const scrub = (t) => (key ? String(t).split(key).join("<key>") : String(t));
    writeFileSync(join(out, "receipt.json"), scrub(JSON.stringify(receipt, null, 2)) + "\n");
    const line = `rival ${pname}: ${status === "DRAFTED" ? "DRAFTED" : "COULD-NOT-DRAFT"} ${field(scrub(detail))}`;
    appendFileSync(join(runRoot, "status.log"), `${receipt.finishedAt}\t${pname}\t${status}\t${field(scrub(detail))}\n`);
    console.log(line);
    // exitCode, not exit(): exiting while fetch's socket is closing trips a libuv assertion on
    // Windows (observed on the S2 contract run, exit 127 after a good draft).
    process.exitCode = status === "DRAFTED" ? 0 : 3;
  };
  const fail = (reason, err) => {
    if (err) receipt.error = { name: field(err.name ?? ""), code: err.code == null ? null : field(err.code), message: field(err.message ?? "").slice(0, 400) };
    receipt.reason = reason;
    settle("COULD-NOT-DRAFT", `(${reason})`);
  };

  // The key first: no key is the provider's outcome, not a usage error, so the jury still degrades on it.
  const { resolveKey } = await import(pathToFileURL(join(ROOT, ".claude", "scripts", "hq", "lib", "keys.mjs")).href);
  key = resolveKey(provider.keyName);
  if (!key) return fail("no key");

  if (o["--record-request"] != null) {
    writeFileSync(o["--record-request"], JSON.stringify({ ...req, key_env: provider.keyName, key_sha16: sha(key).slice(0, 16) }) + "\n");
  }

  let answer;
  let runDir = null;
  try {
    if (o["--fake-answer"] != null) {
      answer = JSON.parse(readFileSync(o["--fake-answer"], "utf8"));
    } else {
      runDir = mkdtempSync(join(tmpdir(), "arc-rival-"));
      const entry = sdkEntry(provider, runDir);
      if (!entry) return fail("install failed");
      answer = await childTransport(provider, entry, key, req, runDir);
    }
  } finally {
    if (runDir) rmSync(runDir, { recursive: true, force: true });
  }
  if (!answer || answer.ok !== true) {
    const err = answer && answer.error ? answer.error : { name: "NoAnswer", code: "NO_ANSWER", message: "no answer" };
    return fail(classifyFailure(err), err);
  }
  const read = readAnswer(provider, answer);
  if (read.why) return fail(`unusable answer (${read.why})`);
  const s = answer.screen && typeof answer.screen === "object" ? answer.screen : {};
  receipt.screen = { id: field(s.id ?? "").slice(0, 80) || null, projectId: field(s.projectId ?? "").slice(0, 80) || null, deviceType: field(s.deviceType ?? "").slice(0, 20) || null };
  receipt.html_host = read.url.hostname;

  let body;
  try {
    body = typeof answer.html === "string" && o["--fake-answer"] != null ? Buffer.from(answer.html) : await download(read.url);
  } catch (e) {
    return fail(classifyFailure(e), e);
  }
  if (body.length === 0) return fail("unusable answer (the HTML is empty)");
  if (body.length > MAX_HTML_BYTES) return fail("unusable answer (the HTML is larger than the cap)");
  writeFileSync(join(out, "draft.raw.html"), body);
  receipt.html = { bytes: body.length, sha256: sha(body) };
  // Vendored into the explore's gitignored rival dir, where the ordinary renderer serves it like a variant.
  const rivalDir = join(ROOT, "docs", "design", "explore", runId, `rival-${pname}`);
  rmSync(rivalDir, { recursive: true, force: true });
  mkdirSync(join(rivalDir, "assets"), { recursive: true });
  const getAsset = o["--fake-assets"] != null ? fakeAssets(o["--fake-assets"]) : realAsset;
  const v = await vendor(body.toString("utf8"), join(rivalDir, "assets"), getAsset);
  if (v.unresolved) {
    rmSync(rivalDir, { recursive: true, force: true });
    receipt.unresolved = v.unresolved;
    return fail(`not self-contained (${v.unresolved.length} unresolved: ${v.unresolved[0].slice(0, 120)})`);
  }
  writeFileSync(join(rivalDir, "index.html"), v.html);
  writeFileSync(join(out, "vendor.json"), JSON.stringify({ hosts: ASSET_HOSTS, assets: v.assets, rewrites: v.rewrites, page: { bytes: Buffer.byteLength(v.html), sha256: sha(v.html) } }, null, 2) + "\n");
  receipt.vendored = { assets: v.assets.length, bytes: v.assets.reduce((n, a) => n + a.bytes, 0), page: `docs/design/explore/${runId}/rival-${pname}/index.html` };
  const shortId = receipt.screen.id ? `, screen ${receipt.screen.id.slice(0, 12)}` : "";
  return settle("DRAFTED", `${body.length} bytes, ${v.assets.length} assets vendored (stitch-sdk ${provider.pkg.slice(provider.pkg.lastIndexOf("@") + 1)}${shortId})`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "draft") await draft(rest);
else usage("usage: design-rival.mjs draft --brief <brief-id> --run <run-id> [--provider stitch]");
