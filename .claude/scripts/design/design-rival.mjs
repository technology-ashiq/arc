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
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
export const PROVIDERS = {
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
  const code = field(err?.code ?? err?.name ?? "unknown").replace(/[^\w.-]/g, "").slice(0, 40) || "unknown";
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
  // The host is checked by name and the port is part of where the bytes come from (attack 65d01cc B4).
  // Address pinning is out of scope: the hosts are Google's and Tailwind's, and a resolver this box
  // trusts is the same one every other fetch here trusts.
  if (u.port !== "") return { why: `the HTML URL names port ${field(u.port).slice(0, 8)}` };
  // Bound to the screen it came with: the SDK's getHtml() returns the generated screen's own
  // htmlCode.downloadUrl (stitch-sdk 0.3.5 screen.js), so any other URL on the right host is not this
  // screen's HTML (attack 65d01cc L9).
  const own = answer.screen && typeof answer.screen === "object" && answer.screen.htmlCode && typeof answer.screen.htmlCode === "object" ? answer.screen.htmlCode.downloadUrl : undefined;
  if (typeof own !== "string" || own !== String(answer.htmlUrl)) return { why: "the HTML URL is not the screen's own htmlCode download" };
  // A dot segment, raw or percent-encoded, names a resource other than the one written (attack ae0aeb8 L7).
  // The path itself is recorded in the receipt; its prefix is not pinned until a live draft has shown it.
  if (/(^|\/)(\.|%2e){1,2}(\/|$)/i.test(String(answer.htmlUrl).replace(/^[a-z]+:\/\/[^/]*/i, "").split(/[?#]/)[0]) || /%2f|%5c/i.test(u.pathname)) return { why: "the HTML URL path carries a dot segment or an encoded slash" };
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

// One hash over every file of an installed tree, path and bytes, in a fixed order; a symlink in the
// tree is refused (null), since what it points at is not what was installed.
function treeHash(dir) {
  const h = createHash("sha256");
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))) {
      if (e.name === ".package-lock.json") continue;
      const p = join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) throw new Error(`a symlink in the install: ${r}`);
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) h.update(`${r}\0`).update(readFileSync(p)).update("\0");
    }
  };
  try { walk(dir, ""); } catch { return null; }
  return h.digest("hex");
}

// The pinned SDK, installed once into a private directory. Its entry is read from its own package.json
// and must stay inside the install directory. The whole installed tree is hashed at install and
// re-hashed before every run: the child that receives the key imports only the tree that was installed,
// never one replaced since (attack 65d01cc B9). An install with no recorded hash is not trusted -- it is
// removed and installed again. Returns {entry, tree} or null.
function sdkEntry(provider, runDir) {
  const dir = join(ROOT, ".claude", "state", "design", "rival-sdk", provider.pkg.replace(/[^abcdefghijklmnopqrstuvwxyz0123456789.@-]/gi, "_"));
  const nm = join(dir, "node_modules");
  const pkgDir = join(nm, ...provider.name.split("/"));
  const pj = join(pkgDir, "package.json");
  const pin = join(dir, "install.json");
  let recorded = null;
  try { recorded = JSON.parse(readFileSync(pin, "utf8")).tree_sha256; } catch { recorded = null; }
  if (!existsSync(pj) || typeof recorded !== "string") {
    const cli = [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")].find((p) => existsSync(p));
    if (!cli) return null;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const r = spawnSync(process.execPath, [cli, "install", "--prefix", dir, "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", provider.pkg],
      { cwd: runDir, env: privateEnv(runDir, {}), stdio: "ignore", windowsHide: true, timeout: INSTALL_DEADLINE_MS });
    if (r.error || r.status !== 0 || !existsSync(pj)) return null;
    recorded = treeHash(nm);
    if (!recorded) return null;
    writeFileSync(pin, JSON.stringify({ pkg: provider.pkg, installedAt: new Date().toISOString(), tree_sha256: recorded }, null, 2) + "\n");
  }
  if (treeHash(nm) !== recorded) return null;
  // The child imports a COPY in this run's private dir, hashed after the copy: hashing the shared install
  // and importing it later left a window to swap the entry in between (attack ae0aeb8 B4).
  const copyNm = join(runDir, "sdk", "node_modules");
  try { cpSync(nm, copyNm, { recursive: true, verbatimSymlinks: true }); } catch { return null; }
  if (treeHash(copyNm) !== recorded) return null;
  const pkgCopy = join(copyNm, ...provider.name.split("/"));
  let rel;
  try {
    const p = JSON.parse(readFileSync(pj, "utf8"));
    if (p.version !== provider.pkg.slice(provider.pkg.lastIndexOf("@") + 1)) return null;
    const dot = p.exports && p.exports["."];
    rel = (dot && typeof dot === "object" ? dot.import : dot) ?? p.main;
  } catch { return null; }
  const entry = resolve(pkgCopy, String(rel ?? ""));
  return rel && entry.startsWith(resolve(pkgCopy) + sep) && existsSync(entry) ? { entry, tree: recorded } : null;
}

// The child and everything it started: on Windows a plain kill reaches only the direct process, and a
// grandchild holding the key and a socket outlived the run (attack 65d01cc B10). Unconditional: a leader
// that already exited can leave its group alive, and an early return on its exit skipped the group
// (attack ae0aeb8 B8). ESRCH -- nothing left -- is the success case.
function killTree(child) {
  if (process.platform === "win32") {
    // Windows has no process group to reach once the leader is gone, and a freed pid can be reused by an
    // unrelated process, so the tree kill runs only while the leader lives.
    if (child.exitCode === null && child.signalCode === null) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 10000 });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* ESRCH: the group is gone */ }
  }
}

// The real transport: the child file, the request on stdin, one JSON line back, a hard deadline.
function childTransport(provider, entry, key, req, runDir) {
  return new Promise((done) => {
    const env = privateEnv(runDir, { [provider.keyName]: key });
    // detached on POSIX makes the child a group leader, so the whole group can be killed by -pid.
    const child = spawn(process.execPath, [provider.child, entry], { cwd: runDir, env, shell: false, stdio: ["pipe", "pipe", "ignore"], windowsHide: true, detached: process.platform !== "win32" });
    let out = "";
    let verdict = null;
    let closed = false;
    // The answer is handed back only once the child (and its tree) is gone, so the caller's cleanup of
    // the run dir never races a process still holding it; a backstop ends the wait if close never comes.
    let sent = false;
    const resolveWhenClosed = () => { if (verdict && closed && !sent) { sent = true; clearTimeout(backstop); done(verdict); } };
    let backstop = null;
    const finish = (v) => {
      if (verdict) return;
      verdict = v;
      clearTimeout(timer);
      killTree(child);
      backstop = setTimeout(() => { closed = true; resolveWhenClosed(); }, 10000);
      resolveWhenClosed();
    };
    const timer = setTimeout(() => finish({ ok: false, error: { name: "Timeout", code: "TIMEOUT", message: `no answer within ${DRAFT_DEADLINE_MS} ms (timeout)` } }), DRAFT_DEADLINE_MS);
    child.on("error", (e) => { finish({ ok: false, error: { name: "SpawnError", code: e.code ?? null, message: e.message } }); closed = true; resolveWhenClosed(); });
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
      closed = true;
      resolveWhenClosed();
    });
    child.stdin.on("error", () => { /* reported by close */ });
    child.stdin.end(JSON.stringify(req));
  });
}

async function download(url) {
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60000) });
  if (res.status !== 200) throw Object.assign(new Error(`the HTML download answered ${res.status}`), { code: `HTTP_${res.status}` });
  return readCapped(res, MAX_HTML_BYTES).catch((e) => { throw Object.assign(new Error(e.code === "TOO_LARGE" ? "the HTML is larger than the cap" : e.message), { code: e.code ?? "READ_FAILED" }); });
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
const CSS_URL = /url\(\s*(["']?)([^"')\s]+)\1\s*\)|@import\s+(["'])([^"']+)\3/gi;
// Attributes that never load anything. Every OTHER attribute whose value is a remote URL is read as a
// load: a list of load attributes missed unquoted values, <base>, and every tag nobody thought of
// (attack 65d01cc B1), so the reader is deny-by-default. <a>/<area> href is navigation and skipped whole.
const INERT_ATTRS = /^(alt|title|class|id|name|value|placeholder|lang|dir|role|type|rel|target|download|hreflang|for|label|content|property|itemprop|itemtype|itemscope|itemid|xmlns(:.*)?|aria-.*|data-.*|on.*|style|width|height|sizes|media|crossorigin|referrerpolicy|integrity|as|charset|http-equiv|loading|decoding|fetchpriority|tabindex|hidden|translate|spellcheck|autocomplete|async|defer|nomodule|disabled|checked|selected|required|readonly|multiple|viewbox|fill|stroke|d|transform|stroke-width|stroke-linecap|stroke-linejoin)$/;

// Entities a browser decodes inside an attribute, plus the tab/newline it strips from a URL and the
// backslash it reads as a slash: `ht&#x74;ps:`, `&sol;&sol;host` and `\\host` are all remote.
const NAMED = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", colon: ":", sol: "/", bsol: "\\", tab: "\t", newline: "\n", period: "." };
export const decodeAttr = (v) => v
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
  .replace(/&#([0-9]+);?/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
  .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
const urlish = (v) => decodeAttr(v).replace(/[\t\n\r]/g, "").replace(/\\/g, "/").trim();
const isRemote = (v) => /^([a-z][a-z0-9+.-]*:)?\/\//i.test(urlish(v));
const absolute = (v) => urlish(v).replace(/^\/\//, "https://");

// Every start tag: its name, and each attribute's name, value and the value's offsets in the source.
// Quoted and unquoted values both. Comments are skipped, and the text of <script>/<style>/<textarea>/
// <title> is not read as markup (a <style> body is returned as `text` for its url() refs).
export function tagsOf(html) {
  const lower = html.toLowerCase();
  const n = html.length;
  const tags = [];
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) break;
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? n : e + 3; continue; }
    const m = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 80));
    if (!m) { i = lt + 1; continue; }
    const name = m[1].toLowerCase();
    let j = lt + m[0].length;
    const attrs = [];
    for (;;) {
      while (j < n && /[\s/]/.test(html[j])) j++;
      if (j >= n || html[j] === ">") break;
      const a0 = j;
      while (j < n && !/[\s/>=]/.test(html[j])) j++;
      if (j === a0) { j++; continue; }
      const aname = html.slice(a0, j).toLowerCase();
      let k = j;
      while (k < n && /\s/.test(html[k])) k++;
      if (html[k] !== "=") { attrs.push({ name: aname, value: "", start: j, end: j }); continue; }
      k++;
      while (k < n && /\s/.test(html[k])) k++;
      let vs, ve;
      if (html[k] === '"' || html[k] === "'") {
        vs = k + 1;
        ve = html.indexOf(html[k], vs);
        if (ve < 0) ve = n;
        j = Math.min(n, ve + 1);
      } else {
        vs = k;
        ve = k;
        while (ve < n && !/[\s>]/.test(html[ve])) ve++;
        j = ve;
      }
      attrs.push({ name: aname, value: html.slice(vs, ve), start: vs, end: ve });
    }
    const end = Math.min(n, j + 1);
    const tag = { name, start: lt, end, attrs };
    tags.push(tag);
    i = end;
    if (/^(script|style|textarea|title)$/.test(name)) {
      const close = lower.indexOf(`</${name}`, end);
      tag.text = { start: end, end: close < 0 ? n : close };
      i = close < 0 ? n : close;
    }
  }
  return tags;
}

// The remote LOADS in one HTML document, each with the offsets of the exact text to rewrite:
// [{tag, attr, raw, url, rel, start, end}]. `refuse` names a construct that cannot be vendored at all
// (<base>, a meta refresh), which makes the draft unresolved rather than half-online.
// The remote url()/@import refs in one CSS text, offsets relative to `at`. A stylesheet is CSS, not
// HTML: reading it through the HTML tag reader finds nothing, and its fonts would stay remote.
export function cssLoads(text, at = 0) {
  const out = [];
  for (const m of text.matchAll(CSS_URL)) {
    const raw = m[2] ?? m[4];
    if (!raw || !isRemote(raw)) continue;
    const start = at + m.index + m[0].indexOf(raw);
    out.push({ tag: "css", attr: "url", raw, url: absolute(raw), rel: "", start, end: start + raw.length });
  }
  return out;
}

// What the second reader finds still remote in a CSS text, or null: anything `//host`-shaped after
// comments are dropped, and any url() written with a CSS escape, which no reader here decodes.
function strayCss(text) {
  const css = decodeAttr(text).replace(/\/\*[\s\S]*?\*\//g, "");
  const m = /(?:^|\W|_)((?:[a-z][a-z0-9+.-]*:)?\/\/[a-z0-9[][^\s"')]*)/i.exec(css);
  if (m) return `still remote after vendoring: ${field(m[1]).slice(0, 120)}`;
  if (/url\(\s*["']?[^"')]*\\/i.test(css) || /@import\s+[^;]*\\/i.test(css)) return "a url() or @import written with a CSS escape";
  return null;
}

export function remoteLoads(html) {
  const out = [];
  const refuse = [];
  const cssRefs = (text, at) => { out.push(...cssLoads(text, at)); };
  for (const t of tagsOf(html)) {
    if (t.text && t.name === "style") cssRefs(html.slice(t.text.start, t.text.end), t.text.start);
    if (t.name === "a" || t.name === "area") continue;
    const rel = (t.attrs.find((a) => a.name === "rel")?.value ?? "").toLowerCase().trim();
    if (t.name === "base" && t.attrs.some((a) => a.name === "href")) refuse.push("a <base href> re-roots every relative URL on the page");
    if (t.name === "meta" && /refresh/i.test(t.attrs.find((a) => a.name === "http-equiv")?.value ?? "")) refuse.push("a <meta http-equiv=refresh> navigates the page");
    for (const a of t.attrs) {
      if (a.name === "style") { cssRefs(a.value, a.start); continue; }
      if (INERT_ATTRS.test(a.name)) continue;
      if (/srcset$/.test(a.name)) {
        // Each candidate URL, by its own offset inside the value.
        for (const c of a.value.matchAll(/([^\s,][^\s]*?)(?=\s|,\s|,?$)/g)) {
          const raw = c[1].replace(/,$/, "");
          if (raw && isRemote(raw)) out.push({ tag: t.name, attr: a.name, raw, url: absolute(raw), rel, start: a.start + c.index, end: a.start + c.index + raw.length });
        }
        continue;
      }
      if (a.value && isRemote(a.value)) out.push({ tag: t.name, attr: a.name, raw: a.value, url: absolute(a.value), rel, start: a.start, end: a.end });
    }
  }
  out.refuse = refuse;
  return out;
}

// Edits applied by offset, last first, so only the named spans change -- never a global replace, which
// rewrote anchors, body text and longer URLs that contained a shorter one (attack 65d01cc B2).
function applyEdits(text, edits) {
  const sorted = [...edits].sort((x, y) => y.start - x.start);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].end > sorted[i - 1].start) throw new Error("two rewrites overlap");
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

// The body of a response, read under a byte cap: the read stops the moment the cap is passed, so a
// server that omits Content-Length cannot make this hold more than the cap (attack 65d01cc B3).
async function readCapped(res, cap) {
  if (Number(res.headers.get("content-length") ?? 0) > cap) throw Object.assign(new Error("larger than the cap"), { code: "TOO_LARGE" });
  const chunks = [];
  let got = 0;
  for await (const c of res.body ?? []) {
    got += c.length;
    if (got > cap) {
      try { await res.body.cancel(); } catch { /* already closed */ }
      throw Object.assign(new Error("larger than the cap"), { code: "TOO_LARGE" });
    }
    chunks.push(Buffer.from(c));
  }
  return Buffer.concat(chunks);
}

// A font's format is read from its first bytes, not from a label a CDN may get wrong; the renderer serves
// by extension, so a mislabelled woff2 named .bin would reach the page with the wrong type (attack 65d01cc L7).
const fontMagic = (b) => {
  const head = b.subarray(0, 4).toString("latin1");
  return head === "wOF2" ? "woff2" : head === "wOFF" ? "woff" : head === "OTTO" ? "otf" : head === "\x00\x01\x00\x00" || head === "true" ? "ttf" : null;
};
const assetName = (url, type, bytes) => {
  const ext = fontMagic(bytes) ?? (/css/.test(type) ? "css" : /javascript|ecmascript/.test(type) ? "js" : "bin");
  return `${sha(bytes).slice(0, 16)}.${ext}`;
};

// A redirect is followed only on the SAME host, over https, at most 3 hops: the Tailwind CDN answers
// its unversioned URL with a 302 to a pinned version path (observed 2026-10-07, /3.4.17?plugins=...),
// and the final URL is what the record keeps -- the version that was vendored.
// Each hop is held to what the first URL was held to: https, same host, the default port.
async function realAsset(url, cap) {
  let at = new URL(url);
  for (let hop = 0; hop <= 3; hop++) {
    // The deadline covers the body read too: the signal aborts the stream, not only the headers.
    const res = await fetch(at, { redirect: "manual", headers: { "user-agent": FONT_UA }, signal: AbortSignal.timeout(60000) });
    if (res.status >= 300 && res.status < 400) {
      const next = new URL(res.headers.get("location") ?? "", at);
      if (next.protocol !== "https:" || next.hostname !== at.hostname || next.port !== "" || next.username || next.password) throw new Error(`redirects off host to ${field(next.host).slice(0, 80)}`);
      at = next;
      continue;
    }
    if (res.status !== 200) throw new Error(`answered ${res.status}`);
    const body = await readCapped(res, Math.min(cap, MAX_ASSET_BYTES)).catch((e) => { throw new Error(e.code === "TOO_LARGE" ? "larger than the asset cap" : e.message); });
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
    if (x.port !== "") return `names port ${field(x.port).slice(0, 8)}`;
    return null;
  };
  const fetchOne = async (url, depth) => {
    if (cache.has(url)) return cache.get(url);
    const no = allowed(url);
    if (no) { unresolved.push(`${field(url).slice(0, 160)}: ${no}`); cache.set(url, null); return null; }
    if (assets.length >= MAX_ASSETS) { unresolved.push(`more than ${MAX_ASSETS} assets`); cache.set(url, null); return null; }
    let got;
    // The byte budget left is handed to the fetch, so the total cap stops a read, not only a count after it.
    try { got = await getAsset(url, MAX_TOTAL_ASSET_BYTES - total); } catch (e) { unresolved.push(`${field(url).slice(0, 160)}: ${field(e.message).slice(0, 80)}`); cache.set(url, null); return null; }
    total += got.body.length;
    if (total > MAX_TOTAL_ASSET_BYTES) { unresolved.push(`assets pass ${MAX_TOTAL_ASSET_BYTES} bytes in all`); cache.set(url, null); return null; }
    let body = got.body;
    // A stylesheet names its own fonts: vendored one level down, relative to the stylesheet itself.
    if (/css/.test(got.type) && depth === 0) {
      const css = body.toString("utf8");
      const edits = [];
      for (const ref of cssLoads(css)) {
        const name = await fetchOne(ref.url, 1);
        if (name) { edits.push({ start: ref.start, end: ref.end, text: name }); rewrites.push({ in: "stylesheet", from: field(ref.raw).slice(0, 200), to: name }); }
      }
      // An overlap is a named refusal here exactly as in the page, never an internal error (attack ae0aeb8 L8).
      let rewritten;
      try { rewritten = applyEdits(css, edits); } catch (e) { unresolved.push(`${field(url).slice(0, 160)}: ${field(e.message)}`); cache.set(url, null); return null; }
      // The second reader runs over every vendored stylesheet too, not only the page (attack ae0aeb8 B2).
      const stray = strayCss(rewritten);
      if (stray) { unresolved.push(`${field(url).slice(0, 160)}: ${stray}`); cache.set(url, null); return null; }
      body = Buffer.from(rewritten);
    } else if (/css/.test(got.type)) {
      unresolved.push(`${field(url).slice(0, 160)}: a stylesheet imported from a stylesheet`);
      cache.set(url, null);
      return null;
    }
    const name = assetName(url, got.type, body);
    writeFileSync(join(assetsDir, name), body);
    assets.push({ url: field(url).slice(0, 300), ...(got.final && got.final !== url ? { final: field(got.final).slice(0, 300) } : {}), type: field(got.type).slice(0, 80), bytes: body.length, sha256: sha(body), local: `assets/${name}` });
    cache.set(url, name);
    // The final URL after a same-host redirect names the same bytes: a second reference to it reuses this
    // file rather than fetching it again under another name (attack ae0aeb8 B3).
    if (got.final && got.final !== url && !cache.has(got.final)) cache.set(got.final, name);
    return name;
  };
  const loads = remoteLoads(html);
  for (const why of loads.refuse) unresolved.push(why);
  const edits = [];
  for (const ref of loads) {
    // A preconnect or dns-prefetch hint loads nothing, but it opens a socket. Pointed at the page's own
    // origin it left an idle connection the loopback server timed out and recorded, refusing the render
    // (observed on the S3 re-render); about:blank opens none and names no host.
    if (ref.tag === "link" && /^(preconnect|dns-prefetch)$/.test(ref.rel)) {
      edits.push({ start: ref.start, end: ref.end, text: "about:blank" });
      rewrites.push({ in: "html", from: field(ref.raw).slice(0, 200), to: "about:blank" });
      continue;
    }
    const name = await fetchOne(ref.url, ref.tag === "css" ? 1 : 0);
    if (!name) continue;
    edits.push({ start: ref.start, end: ref.end, text: `assets/${name}` });
    rewrites.push({ in: "html", from: field(ref.raw).slice(0, 200), to: `assets/${name}` });
  }
  if (unresolved.length) return { unresolved: [...new Set(unresolved)] };
  let out;
  try { out = applyEdits(html, edits); } catch (e) { return { unresolved: [field(e.message)] }; }
  // Belt and braces, by a second reader that shares no list with the first: every tag's markup outside
  // <a>/<area>, and every <style> body, is searched for anything URL-shaped that is still remote. A
  // construct the load reader missed is caught here rather than by a jury rendering a half-online page.
  const left = [...remoteLoads(out).map((r) => r.url), ...remoteLoads(out).refuse, ...strayRemote(out)];
  for (const u of left) if (!unresolved.some((x) => x.startsWith(field(u).slice(0, 160)))) unresolved.push(`${field(u).slice(0, 160)}: still remote after vendoring`);
  return unresolved.length ? { unresolved: [...new Set(unresolved)] } : { html: out, assets, rewrites };
}

// Any `//host` left in tag markup (attribute names and inert values aside) or in a <style> body, after
// entity decoding. Coarser than remoteLoads on purpose: it knows no attribute names, so it cannot share
// remoteLoads' blind spots.
function strayRemote(html) {
  const found = [];
  for (const t of tagsOf(html)) {
    if (t.name !== "a" && t.name !== "area") {
      for (const a of t.attrs) {
        if (/^(xmlns(:.*)?|alt|title|aria-.*|data-.*|content|placeholder|value|itemtype|property)$/.test(a.name) && !(t.name === "meta" && a.name === "content" && /refresh/i.test(t.attrs.find((x) => x.name === "http-equiv")?.value ?? ""))) continue;
        const m = /(?:^|\W|_)((?:[a-z][a-z0-9+.-]*:)?\/\/[a-z0-9[])/i.exec(urlish(a.value));
        if (m) found.push(`<${t.name} ${a.name}> ${field(urlish(a.value)).slice(0, 120)}`);
      }
    }
    if (t.text && t.name === "style") {
      const why = strayCss(html.slice(t.text.start, t.text.end));
      if (why) found.push(`<style> ${why}`);
    }
  }
  return found;
}

// ---------- the command ----------

let onCrash = null;

// The first path in `chain` that exists and is a link or not a real directory, or whose resolved path
// leaves the repo, as a repo-relative name; null when every one is safe. lstat alone is not enough on
// Windows, where some Node versions report a junction as a directory, so the realpath is compared too.
function unsafeDirs(chain) {
  const rootReal = realpathSync(ROOT);
  for (const p of chain) {
    let st = null;
    try { st = lstatSync(p); } catch { st = null; }
    if (!st) continue;
    const name = p.slice(ROOT.length + 1).split(sep).join("/");
    if (st.isSymbolicLink() || !st.isDirectory()) return name;
    let real;
    try { real = realpathSync(p); } catch { return name; }
    const want = resolve(rootReal, p.slice(ROOT.length + 1));
    if (real.toLowerCase() !== want.toLowerCase()) return name;
  }
  return null;
}

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
  // The state tree takes draft.raw.html, the receipt, the stage dir and its recursive removes, so it gets
  // the same link refusal as the explore tree (attack ae0aeb8 B9). Nothing is attempted yet: a usage error.
  const stateChain = [".claude", join(".claude", "state"), join(".claude", "state", "design"), join(".claude", "state", "design", "rivals"),
    join(".claude", "state", "design", "rivals", briefId), join(".claude", "state", "design", "rivals", briefId, runId), join(".claude", "state", "design", "rivals", briefId, runId, pname)].map((p) => join(ROOT, p));
  const badState = unsafeDirs(stateChain);
  if (badState) usage(`${badState} is a link or not a directory; the rival record is written only inside the repo`);
  mkdirSync(out, { recursive: true });
  // This run's record starts empty: a receipt or vendor record a failed earlier attempt left behind must
  // never sit beside this run's outcome (attack 65d01cc B6). The vendored page itself is replaced only
  // on success, and the jury checks it against the receipt's page hash.
  for (const f of ["receipt.json", "vendor.json"]) rmSync(join(out, f), { force: true });
  const startedAt = new Date().toISOString();
  const req = buildRequest(provider, briefId, briefText);
  const receipt = {
    provider: pname, sdk: provider.pkg, mode: seamed.length ? "fake" : "real", brief: briefId, run: runId,
    request: { title: req.title, deviceType: req.deviceType, prompt_bytes: Buffer.byteLength(req.prompt), prompt_sha256: sha(req.prompt) },
    startedAt,
  };

  let key = null;
  let settled = false;
  const settle = (status, detail) => {
    settled = true;
    receipt.finishedAt = new Date().toISOString();
    receipt.status = status;
    // The key in its raw AND its JSON-escaped spelling: the receipt is scrubbed after serialising, and a key
    // holding a quote or backslash is written escaped, which a raw-only split would miss (attack ae0aeb8 L12).
    const spellings = key ? [...new Set([key, JSON.stringify(key).slice(1, -1)])] : [];
    const scrub = (t) => spellings.reduce((s, k) => s.split(k).join("<key>"), String(t));
    const line = `rival ${pname}: ${status === "DRAFTED" ? "DRAFTED" : "COULD-NOT-DRAFT"} ${field(scrub(detail))}`;
    // The status line is printed even when the record cannot be written; a DRAFTED that cannot be
    // recorded is not a draft, since the jury deals only on the receipt.
    try {
      writeFileSync(join(out, "receipt.json"), scrub(JSON.stringify(receipt, null, 2)) + "\n");
      appendFileSync(join(runRoot, "status.log"), `${receipt.finishedAt}\t${pname}\t${status}\t${field(scrub(detail))}\n`);
    } catch (e) {
      console.log(`rival ${pname}: COULD-NOT-DRAFT (the record could not be written: ${field(e.code ?? e.name ?? "error").slice(0, 40)})`);
      process.exitCode = 3;
      return;
    }
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
  // Anything thrown from here on is the provider attempt failing, not a usage error: one status line and
  // exit 3, never a stack trace and the usage code 1 (attack 65d01cc B11).
  onCrash = (e) => { if (!settled) fail(`internal error ${field(e?.code ?? e?.name ?? "Error").replace(/[^\w.-]/g, "").slice(0, 40) || "Error"}`, e); };

  // The key first: no key is the provider's outcome, not a usage error, so the jury still degrades on it.
  // A seamed (fake) run never opens the owner's key store: its key, if any, is the one the test put in the
  // environment, so a fake run can never be exercised with the real key (attack 65d01cc L10).
  if (seamed.length) {
    key = process.env[provider.keyName] || null;
  } else {
    const { resolveKey } = await import(pathToFileURL(join(ROOT, ".claude", "scripts", "hq", "lib", "keys.mjs")).href);
    key = resolveKey(provider.keyName);
  }
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
      const sdk = sdkEntry(provider, runDir);
      if (!sdk) return fail("install failed");
      receipt.sdk_tree_sha256 = sdk.tree;
      answer = await childTransport(provider, sdk.entry, key, req, runDir);
    }
  } finally {
    // A dir a dying child still holds (EBUSY on Windows) is left for the OS temp sweep, not thrown.
    if (runDir) { try { rmSync(runDir, { recursive: true, force: true, maxRetries: 3 }); } catch { /* temp dir, swept later */ } }
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
  receipt.html_path = field(read.url.pathname).slice(0, 200);

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
  // A symlink or junction anywhere on the way is refused before anything is removed or written: a
  // recursive remove follows a Windows junction, and a write through one lands outside the explore
  // (attack 65d01cc B5).
  const exploreRoot = join(ROOT, "docs", "design", "explore");
  const exploreDir = join(exploreRoot, runId);
  const rivalDir = join(exploreDir, `rival-${pname}`);
  const chain = [join(ROOT, "docs"), join(ROOT, "docs", "design"), exploreRoot, exploreDir, rivalDir];
  const bad = unsafeDirs(chain);
  if (bad) return fail(`unusable answer (${bad} is a link or not a directory)`);
  // Vendored into a staging dir under this run's own state, and moved into place only on success: a
  // failed attempt never removes a page an earlier run made, and never leaves a half-written one.
  const stage = join(out, "stage");
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, "assets"), { recursive: true });
  const getAsset = o["--fake-assets"] != null ? fakeAssets(o["--fake-assets"]) : realAsset;
  const v = await vendor(body.toString("utf8"), join(stage, "assets"), getAsset);
  if (v.unresolved) {
    rmSync(stage, { recursive: true, force: true });
    receipt.unresolved = v.unresolved;
    return fail(`not self-contained (${v.unresolved.length} unresolved: ${v.unresolved[0].slice(0, 120)})`);
  }
  writeFileSync(join(stage, "index.html"), v.html);
  mkdirSync(exploreDir, { recursive: true });
  // Checked AGAIN right before the remove and the rename, since the vendoring fetch above can take
  // minutes; the old dir is first renamed to a name only this run uses, then that name is removed, so the
  // recursive remove never runs on a path something else could have swapped in (attack ae0aeb8 B1, L4).
  const late = unsafeDirs(chain);
  if (late) return fail(`unusable answer (${late} is a link or not a directory)`);
  if (existsSync(rivalDir)) {
    const old = join(exploreDir, `.rival-${pname}.old-${process.pid}-${Date.now()}`);
    renameSync(rivalDir, old);
    rmSync(old, { recursive: true, force: true });
  }
  renameSync(stage, rivalDir);
  const pageSha = sha(v.html);
  writeFileSync(join(out, "vendor.json"), JSON.stringify({ hosts: ASSET_HOSTS, assets: v.assets, rewrites: v.rewrites, page: { bytes: Buffer.byteLength(v.html), sha256: pageSha } }, null, 2) + "\n");
  receipt.vendored = { assets: v.assets.length, bytes: v.assets.reduce((n, a) => n + a.bytes, 0), page: `docs/design/explore/${runId}/rival-${pname}/index.html`, page_sha256: pageSha };
  const shortId = receipt.screen.id ? `, screen ${receipt.screen.id.slice(0, 12)}` : "";
  return settle("DRAFTED", `${body.length} bytes, ${v.assets.length} assets vendored (stitch-sdk ${provider.pkg.slice(provider.pkg.lastIndexOf("@") + 1)}${shortId})`);
}

// Run as a command only when this file IS the command, both sides realpath'd (a symlinked checkout
// otherwise compares unequal and the command silently does nothing), so the pure parts can be imported.
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "draft") {
    try { await draft(rest); } catch (e) { if (onCrash) onCrash(e); else throw e; }
  } else usage("usage: design-rival.mjs draft --brief <brief-id> --run <run-id> [--provider stitch]");
}
