#!/usr/bin/env node
/**
 * arc-products.mjs — the single product resolver (ADR-0015).
 *
 * Reads products/NAME/manifest.json and emits a line-protocol install plan on
 * stdout. BOTH sync twins (sync-to-project.sh / .ps1) consume this plan as dumb
 * copy loops — no twin ever parses JSON. One parser to harden, one place for the
 * adversarial fixture corpus. Zero deps (node:fs, node:path), Node >=18.
 *
 * Usage:
 *   node arc-products.mjs --products core,council [--root DIR]   # emit plan
 *   node arc-products.mjs --list [--root DIR]                    # names, one per line
 *
 * Line protocol v1 (TAB-separated, LF endings, UTF-8):
 *   PROTO   \t 1                       (always line 1)
 *   MKDIR   \t dest-dir
 *   COPY    \t src-path \t dest-path
 *   ENVBLOCK\t src-file \t sentinel-regex
 *
 * Exit: 0 ok · 2 bad usage / unknown product / unsafe path.
 */
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const TAB = "\t";

function die(msg) {
  process.stderr.write(`arc-products: ${msg}\n`);
  process.exit(2);
}

// ---------- args ----------
const argv = process.argv.slice(2);
let mode = null; // "plan" | "list" | "status" | "registry" | "prune-report" | "attic"
let productsArg = "";
let root = null;
let target = null; // prune-report's subject: the CONSUMER tree, not the source repo
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--products") { productsArg = argv[++i] ?? ""; if (mode === null) mode = "plan"; }
  else if (a === "--list") { mode = "list"; }
  else if (a === "--status") { mode = "status"; }
  else if (a === "--registry") { mode = "registry"; }
  else if (a === "--prune-report") { mode = "prune-report"; }
  else if (a === "--attic") { mode = "attic"; }
  else if (a === "--target") { target = argv[++i]; }
  else if (a === "--root") { root = argv[++i]; }
  else die(`unknown argument: ${a}`);
}
if (!root) {
  // default: walk up to the dir holding products/. NOT a fixed `..` count -- that is
  // correct only for wherever the script sits today, and Phase 03 moves it a level
  // deeper. Depth-independent, so ckpt 3/4 cannot silently repeat the same break.
  let d = fileURLToPath(new URL(".", import.meta.url));
  while (!existsSync(join(d, "products")) && dirname(d) !== d) d = dirname(d);
  root = d;
}
if (!mode) die("usage: arc-products.mjs (--products LIST | --list | --status | --registry | --prune-report --target DIR | --attic --target DIR) [--root DIR]");

// ---------- unowned-file computation (shared by --prune-report and --attic) ----------
// Every sync path is additive by design, and non-negotiable #51 forbids deleting anything in a
// consumer repo. So a target that installed arc before Phase 03's re-homing now carries BOTH
// layouts, and the registry still reports it clean -- the registry lists what was installed, not
// what is present. This diffs those two.
//
// ONE implementation on purpose: --prune-report is --attic's dry run, so the list you were shown
// is provably the list that moves. Two copies of this walk could drift, and the drift would only
// ever be discovered by a consumer losing sight of a file.
//
// Path-safety note: these paths come from walking the real filesystem under <target>/.claude, NOT
// from the registry. The registry contributes only set membership (`owned`), never a path used for
// an fs operation -- so a hostile registry cannot steer a move outside the target.
function unownedEntries(targetDir) {
  const regPath = join(targetDir, ".claude", "arc-registry.json");
  if (!existsSync(regPath))
    die(`no arc-registry.json in ${targetDir} -- cannot report ownership without a registry (a pre-Phase-02 install; re-sync to write one)`);
  let reg;
  try {
    reg = JSON.parse(readFileSync(regPath, "utf8"));
  } catch (e) {
    die(`unreadable arc-registry.json in ${targetDir}: ${e.message} -- refusing to guess ownership from file presence`);
  }
  const owned = new Set();
  for (const p of Object.values(reg.products || {}))
    for (const f of Array.isArray(p.files) ? p.files : []) owned.add(String(f).replace(/\\/g, "/"));

  // Never reported, never moved: the consumer's own personal settings and working state
  // (deliberately never synced -- REQ-04), transient agent worktrees, the attic itself (without
  // this an attic run would re-attic its own output on every subsequent run, forever), and the
  // registry, which is written by the sync rather than owned by any one product.
  const SKIP_DIRS = new Set(["state", "worktrees", "attic"]);
  // "attic" is in BOTH sets: SKIP_DIRS covers the normal case, SKIP_FILES covers a consumer who
  // has a stray regular file sitting at .claude/attic -- without it that file becomes its own move
  // candidate and the run tries to move .claude/attic into .claude/attic/DATE/.
  const SKIP_FILES = new Set(["settings.local.json", "scheduled_tasks.lock", "arc-registry.json", "attic"]);

  const entries = [];
  const walk = (abs, rel) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      // Symlinks and Windows junctions FIRST. A link to a directory is not isDirectory() on a
      // Dirent, so without this branch it falls through to the file case: reported as ONE path,
      // and then renameSync relocates the entire subtree behind it. The operator would approve a
      // one-line report and lose a tree -- which breaks the guarantee that the report is an exact
      // preview of the move. Reported distinctly; never moved (see the attic mode below).
      if (e.isSymbolicLink()) {
        if (SKIP_FILES.has(e.name)) continue;
        if (!owned.has(p)) entries.push({ rel: p, link: true });
        continue;
      }
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(join(abs, e.name), p);
      } else {
        if (SKIP_FILES.has(e.name)) continue;
        if (!owned.has(p)) entries.push({ rel: p, link: false });
      }
    }
  };
  const claudeDir = join(targetDir, ".claude");
  if (existsSync(claudeDir)) walk(claudeDir, ".claude");

  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return entries;
}

// A path containing a control character (newline, TAB, CR) can forge lines in a line-oriented
// report -- `ghost\nunowned .claude/evil.md` prints as two plausible entries. Legal filenames on
// Linux/macOS, so this is reachable on two of the three CI legs. The report renders them
// unambiguously; the mutating path refuses to run at all.
const CTRL = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(31) + "]");
function renderPath(p) { return CTRL.test(p) ? JSON.stringify(p) : p; }

// ---------- prune-report (REQ-10): make stale files in a consumer tree VISIBLE ----------
// Reports and exits 0; it never removes anything. Quarantining is REQ-11 below, and even that
// moves to .claude/attic/DATE/ rather than rm.
if (mode === "prune-report") {
  if (!target) die("--prune-report needs --target <consumer-dir>");
  const entries = unownedEntries(target);
  // A link is marked distinctly: it is ONE directory entry but may stand in front of a whole
  // subtree, so calling it a "file" would understate what quarantining it would relocate.
  for (const e of entries)
    process.stdout.write(`${e.link ? "unowned-link" : "unowned"}  ${renderPath(e.rel)}\n`);
  process.stdout.write(
    entries.length
      ? `arc-prune-report: ${entries.length} unowned file(s) in ${target} -- present but owned by no installed product. Nothing was removed.\n`
      : `arc-prune-report: 0 unowned file(s) in ${target}.\n`
  );
  process.exit(0);
}

// ---------- attic (REQ-11): quarantine stale files -- MOVE, never delete ----------
// The other half of ADR-0020. Non-negotiable: there is NO delete call anywhere in this mode --
// renameSync is the only mutation. No unlink, no rm, no rmdir. That is a property you can grep
// for, which is the point: "we never delete" has to be checkable, not promised.
//
// Consequences of that rule, accepted deliberately:
//   - directories left empty by a move stay behind (rmdir is still a delete)
//   - a name collision suffixes rather than overwrites (clobbering is a delete wearing a move's
//     clothes -- it destroys the earlier quarantined copy)
//   - a failed move is reported and exits non-zero, never swallowed to make the run look clean
if (mode === "attic") {
  if (!target) die("--attic needs --target <consumer-dir>");
  const entries = unownedEntries(target);

  // Report BEFORE mutate (non-negotiable). The operator sees the full list first, and on an empty
  // set nothing is created at all -- no stray empty dated directory to explain later.
  for (const e of entries)
    process.stdout.write(`${e.link ? "skipped-link" : "attic   "} ${renderPath(e.rel)}\n`);

  // Links and junctions are reported but NEVER moved. renameSync on a link relocates the entire
  // subtree behind it while the report showed a single line -- the operator would approve one path
  // and lose a tree. Quarantining links safely needs a decision this phase has not taken, and
  // "skip loudly" is the only option here that cannot destroy something.
  const movable = entries.filter((e) => !e.link);
  const skippedLinks = entries.length - movable.length;
  const linkNote = skippedLinks ? ` ${skippedLinks} link(s) skipped (never moved).` : "";

  if (!movable.length) {
    process.stdout.write(`arc-attic: 0 unowned file(s) in ${target} -- nothing moved.${linkNote}\n`);
    process.exit(0);
  }

  // A control character in a path can forge lines in the very report this move is approved from,
  // so the mutating path refuses outright rather than moving on a report it cannot trust. The
  // read-only report renders them quoted instead -- seeing them is exactly how you find them.
  const forged = movable.filter((e) => CTRL.test(e.rel));
  if (forged.length)
    die(
      `refusing to move ${forged.length} path(s) containing a control character -- e.g. ${JSON.stringify(forged[0].rel)}. ` +
        `A newline in a filename forges lines in the report this move would be approved from; rename the file, then re-run.`
    );

  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const atticRel = `.claude/attic/${stamp}`;
  const atticAbs = join(target, ".claude", "attic", stamp);

  // Long-path pre-check. The attic prefix adds ~25 chars to every destination, and Windows caps
  // paths at 260 unless LongPathsEnabled is on (it is OFF by default, and it is ON on this dev box
  // -- which is exactly why this would not have been caught by hand). Report-before-mutate applies
  // to this failure too: a length problem is knowable without moving a single file, so it is worth
  // refusing up front rather than stopping half way through a tree.
  const longest = movable.reduce((m, e) => Math.max(m, join(atticAbs, e.rel).length + 2), 0);
  if (longest > 240)
    die(
      `refusing to move: the longest attic destination would be ${longest} characters, over the 240 safety limit ` +
        `(Windows MAX_PATH is 260 without LongPathsEnabled). Quarantining would stop part-way through the tree. ` +
        `Move the target to a shorter path, or enable long paths, then re-run.`
    );

  const moved = [];
  const failed = [];
  for (const { rel } of movable) {
    const from = join(target, rel);
    // The full relative path is preserved under the attic (.claude/attic/DATE/.claude/...), so a
    // restore is a dumb tree copy back to the target root with no path arithmetic to get wrong.
    let destRel = `${atticRel}/${rel}`;
    let destAbs = join(atticAbs, rel);
    let n = 1;
    while (existsSync(destAbs)) {
      n += 1;
      destRel = `${atticRel}/${rel}.${n}`;
      destAbs = join(atticAbs, `${rel}.${n}`);
    }
    try {
      mkdirSync(dirname(destAbs), { recursive: true });
      renameSync(from, destAbs);
      moved.push([rel, destRel]);
    } catch (e) {
      failed.push([rel, e.message]);
    }
  }

  // The manifest is both the receipt and the restore instruction, and it is written even after a
  // partial failure -- a half-finished run must still be fully reversible.
  if (moved.length) {
    mkdirSync(atticAbs, { recursive: true });
    const manifest =
      `# arc attic manifest -- ${stamp}\n` +
      `# ${moved.length} file(s) moved out of ${target}\n` +
      `# restore: move each SECOND column back to its FIRST column, both relative to the target root\n` +
      `# original${TAB}attic\n` +
      moved.map(([a, b]) => `${a}${TAB}${b}`).join("\n") +
      "\n";
    writeFileSync(join(atticAbs, "MANIFEST.tsv"), manifest, "utf8");
  }

  for (const [rel, dest] of moved) process.stdout.write(`moved    ${rel}  ->  ${dest}\n`);
  for (const [rel, msg] of failed) process.stderr.write(`arc-attic: FAILED to move ${rel}: ${msg}\n`);
  process.stdout.write(
    `arc-attic: ${moved.length} file(s) moved to ${atticRel}/ in ${target}; ${failed.length} failed.${linkNote} Nothing was deleted.\n`
  );
  if (moved.length) process.stdout.write(`arc-attic: restore instructions in ${atticRel}/MANIFEST.tsv\n`);
  // Exit 3, not 2: a per-file move failure is a mutation outcome, and a caller must be able to tell
  // it apart from "your flags or your registry were wrong" (die's 2). Every file is still on disk
  // either way -- the loop collects failures and keeps going, so one locked file can never deadlock
  // the remaining N-1 behind it on every future run.
  process.exit(failed.length ? 3 : 0);
}

// ---------- path safety (defense in depth with product-lint) ----------
function assertSafe(p, ctx) {
  if (typeof p !== "string" || p.length === 0) die(`${ctx}: empty path`);
  if (/[\x00-\x1f]/.test(p)) die(`${ctx}: control character in path: ${JSON.stringify(p)}`);
  // Reject backslashes outright -- `..\..\x` escapes as traversal on the PowerShell
  // twin though it has no `/`-delimited `..` segment (review C1).
  if (p.includes("\\")) die(`${ctx}: backslash not allowed in path: ${p}`);
  if (p !== p.trim()) die(`${ctx}: leading/trailing whitespace in path: ${JSON.stringify(p)}`);
  if (p.startsWith("/") || p.startsWith("\\") || /^[A-Za-z]:/.test(p)) die(`${ctx}: absolute path not allowed: ${p}`);
  // `..` and its Windows-normalizing variants (`.. `, `...`) -- .NET strips trailing
  // dots/spaces so `.. ` becomes `..` (review W4).
  if (p.split("/").some((seg) => /^\.\.[.\s]*$/.test(seg))) die(`${ctx}: path traversal not allowed: ${p}`);
}

// envSentinel is emitted raw in the ENVBLOCK plan line and used as a regex by both
// twins -- restrict it to a simple anchored token so a newline can't inject a plan
// line (review C2) and a metachar can't ReDoS (review W2).
const ENV_SENTINEL_RE = /^\^?[A-Za-z0-9_=-]+\$?$/;

// Guard a payload field that must be an array-or-absent -- the resolver is the only
// consumer-side check, so a type-invalid manifest must die cleanly, not stack-trace
// (review W1).
const asArray = (v, ctx) => {
  if (v === undefined) return [];
  if (!Array.isArray(v)) die(`${ctx}: expected an array`);
  return v;
};

// Source commit stamped into the registry: a deterministic test override
// (ARC_SOURCE_COMMIT, validated hex) wins; else the mold's short HEAD; else
// "unknown" (no git / not a repo) -- the registry writes cleanly regardless.
function registrySourceCommit(dir) {
  const override = process.env.ARC_SOURCE_COMMIT;
  if (override && /^[0-9a-f]+$/i.test(override)) return override;
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim() || "unknown";
  } catch { return "unknown"; }
}

// The frozen product lineup (No-go this cycle: no 7th product, no re-slicing). Used ONLY
// to enumerate ABSENT products in a consumer repo, which has no products/ dir to read;
// INSTALLED state itself always comes from the registry, never from file presence (REQ-05).
const CATALOG = ["core", "council", "git", "plan", "qa", "review"];

// --status rendered from the registry (REQ-05): the registry is the ground truth for
// INSTALLED; HEALTH is a live integrity check (are the files it claims still on disk?).
function renderRegistryStatus(rootDir, reg) {
  const installed = new Set(Object.keys(reg.products));
  const commit = reg?.source?.commit ?? "unknown";
  const out = [
    `arc — product status  (registry @ ${commit})`,
    `${"PRODUCT".padEnd(10)}${"INSTALLED".padEnd(11)}${"HEALTH".padEnd(10)}FILES`,
  ];
  for (const name of CATALOG) {
    if (!installed.has(name)) { out.push(`${name.padEnd(10)}${"no".padEnd(11)}${"-".padEnd(10)}-`); continue; }
    const files = Array.isArray(reg.products[name]?.files) ? reg.products[name].files : [];
    const present = files.filter((p) => typeof p === "string" && existsSync(join(rootDir, p))).length;
    const total = files.length;
    const health = present === total ? "ok" : `degraded(${total - present} missing)`;
    out.push(`${name.padEnd(10)}${"yes".padEnd(11)}${health.padEnd(10)}${present}/${total}`);
  }
  const absent = CATALOG.filter((n) => !installed.has(n));
  if (absent.length) out.push(`\ninstall missing: sync-to-project.sh <target> --products ${absent.join(",")}`);
  process.stdout.write(out.join("\n") + "\n");
  process.exit(0);
}

// ---------- --status via registry (REQ-05): registry is ground truth when present ----------
// Runs BEFORE the products/ requirement so a consumer repo (no synced manifests) still gets
// a true status. A present-but-unreadable registry degrades loudly, never crashes (adversarial).
if (mode === "status") {
  const regPath = join(root, ".claude", "arc-registry.json");
  if (existsSync(regPath)) {
    let reg = null;
    try { reg = JSON.parse(readFileSync(regPath, "utf8")); } catch { reg = null; }
    if (reg && reg.products && typeof reg.products === "object" && !Array.isArray(reg.products)) {
      renderRegistryStatus(root, reg); // prints + exits 0
    }
    process.stdout.write(
      `arc — product status  (root: ${root})\n` +
      `.claude/arc-registry.json present but unreadable — reinstall to repair (sync-to-project.sh <target>).\n`
    );
    process.exit(0);
  }
  // no registry here: fall through to the products/ file-presence path (mold) below.
}

// ---------- load manifests ----------
const productsDir = join(root, "products");
if (!existsSync(productsDir)) {
  // /arc in a consumer repo has no products/ (manifests aren't synced) — degrade
  // gracefully rather than erroring; registry-backed status lands in Phase 2.
  if (mode === "status") {
    process.stdout.write(
      `arc — product status  (root: ${root})\n` +
      `no product registry here yet.\n` +
      `run /arc from the arc mold, or (Phase 2) a registry-backed install writes .claude/arc-registry.json.\n`
    );
    process.exit(0);
  }
  die(`no products/ dir under ${root}`);
}

const manifests = new Map(); // name -> manifest object
for (const entry of readdirSync(productsDir)) {
  const mf = join(productsDir, entry, "manifest.json");
  if (!existsSync(mf)) continue;
  let obj;
  try { obj = JSON.parse(readFileSync(mf, "utf8")); }
  catch (e) { die(`products/${entry}/manifest.json: invalid JSON (${e.message})`); }
  if (obj.name !== entry) die(`products/${entry}/manifest.json: name "${obj.name}" != dir "${entry}"`);
  manifests.set(obj.name, obj);
}
if (manifests.size === 0) die(`no manifests found under ${productsDir}`);

const allNames = [...manifests.keys()].sort();

// ---------- --list ----------
if (mode === "list") {
  process.stdout.write(allNames.join("\n") + "\n");
  process.exit(0);
}

// ---------- --status: read-only per-product install view (file-presence, Phase 0) ----------
if (mode === "status") {
  const rows = allNames.map((name) => {
    const m = manifests.get(name);
    const paths = [...(m.commands ?? []), ...(m.agents ?? []), ...(m.scripts ?? []), ...(m.files ?? [])];
    const present = paths.filter((p) => existsSync(join(root, p))).length;
    const total = paths.length;
    const state = total > 0 && present === total ? "yes" : present > 0 ? "partial" : "no";
    return { name, state, present, total };
  });
  const out = [`arc — product status  (root: ${root})`, `${"PRODUCT".padEnd(10)}${"INSTALLED".padEnd(11)}FILES`];
  for (const r of rows) out.push(`${r.name.padEnd(10)}${r.state.padEnd(11)}${r.present}/${r.total}`);
  const absent = rows.filter((r) => r.state !== "yes").map((r) => r.name);
  if (absent.length) out.push(`\ninstall missing: sync-to-project.sh <target> --products ${absent.join(",")}`);
  process.stdout.write(out.join("\n") + "\n");
  process.exit(0);
}

// ---------- --registry: emit the target's arc-registry.json (Phase 2, REQ-08) ----------
// One JSON document (not the TAB plan): products, versions, per-product installed
// file lists, source commit. Both twins redirect this to .claude/arc-registry.json.
// v1 schema is LOCKED (PLAN rabbit hole): schema, source.commit, products.<name>.{version,files}.
if (mode === "registry") {
  const reqNames = productsArg.split(",").map((s) => s.trim()).filter(Boolean);
  const names = reqNames.length ? reqNames : allNames; // no --products => every product (bare/full install)
  for (const r of names) {
    if (!manifests.has(r)) die(`unknown product: ${r}\nvalid products: ${allNames.join(", ")}`);
  }
  const inSet = new Set();
  const addDeps = (name) => {
    if (inSet.has(name)) return;
    inSet.add(name);
    for (const dep of manifests.get(name).requires ?? []) {
      if (!manifests.has(dep)) die(`product "${name}" requires missing product "${dep}"`);
      addDeps(dep);
    }
  };
  if (manifests.has("core")) addDeps("core"); // core always rides along (REQ-01)
  for (const r of names) addDeps(r);

  const products = {};
  for (const name of [...inSet].sort()) {
    const m = manifests.get(name);
    // version is a registry field AND transported to the ledger reader -- a hostile
    // manifest must die cleanly, never emit a malformed token (adversarial pass).
    if (typeof m.version !== "string" || !/^[\w.+-]+$/.test(m.version))
      die(`${name}.version: must be a simple version token ([\\w.+-]+), got ${JSON.stringify(m.version)}`);
    const files = [];
    const addFile = (p, ctx) => { assertSafe(p, ctx); files.push(p); }; // same path safety as the plan
    for (const p of asArray(m.commands, `${name}.commands`)) addFile(p, `${name}.commands`);
    for (const p of asArray(m.agents, `${name}.agents`)) addFile(p, `${name}.agents`);
    for (const p of asArray(m.scripts, `${name}.scripts`)) addFile(p, `${name}.scripts`);
    for (const p of asArray(m.files, `${name}.files`)) addFile(p, `${name}.files`);
    for (const d of asArray(m.docs, `${name}.docs`)) addFile(d?.dest, `${name}.docs`); // dest, not src
    products[name] = { version: m.version, files };
  }
  const registry = { schema: 1, source: { commit: registrySourceCommit(root) }, products };
  process.stdout.write(JSON.stringify(registry, null, 2) + "\n");
  process.exit(0);
}

// ---------- resolve requested set + transitive requires + implicit core ----------
const requested = productsArg.split(",").map((s) => s.trim()).filter(Boolean);
for (const r of requested) {
  if (!manifests.has(r)) die(`unknown product: ${r}\nvalid products: ${allNames.join(", ")}`);
}
const resolved = new Set();
const addWithDeps = (name) => {
  if (resolved.has(name)) return;
  if (!manifests.has(name)) die(`product "${name}" requires missing product "${name}"`);
  resolved.add(name);
  for (const dep of manifests.get(name).requires ?? []) addWithDeps(dep);
};
if (manifests.has("core")) addWithDeps("core"); // core is always installed
for (const r of requested) addWithDeps(r);

// install order: core first, then the rest alphabetically
const order = [...resolved].filter((n) => n !== "core").sort();
if (resolved.has("core")) order.unshift("core");

// ---------- emit plan ----------
const out = [];
const mkdirSeen = new Set();
const emitMkdir = (dir) => {
  if (!dir || dir === "." || mkdirSeen.has(dir)) return;
  mkdirSeen.add(dir);
  out.push(`MKDIR${TAB}${dir}`);
};
const parentDir = (p) => (p.lastIndexOf("/") > 0 ? p.slice(0, p.lastIndexOf("/")) : "");
const emitCopy = (src, dest, ctx) => {
  assertSafe(src, ctx);
  assertSafe(dest, ctx);
  emitMkdir(parentDir(dest));
  out.push(`COPY${TAB}${src}${TAB}${dest}`);
};

out.push(`PROTO${TAB}1`);
for (const name of order) {
  const m = manifests.get(name);
  for (const p of asArray(m.commands, `${name}.commands`)) emitCopy(p, p, `${name}.commands`);
  for (const p of asArray(m.agents, `${name}.agents`)) emitCopy(p, p, `${name}.agents`);
  for (const p of asArray(m.scripts, `${name}.scripts`)) emitCopy(p, p, `${name}.scripts`);
  for (const p of asArray(m.files, `${name}.files`)) emitCopy(p, p, `${name}.files`);
  for (const d of asArray(m.docs, `${name}.docs`)) emitCopy(d?.src, d?.dest, `${name}.docs`);
  for (const dir of asArray(m.skeletonDirs, `${name}.skeletonDirs`)) { assertSafe(dir, `${name}.skeletonDirs`); emitMkdir(dir); }
  if (m.envBlock) {
    assertSafe(m.envBlock, `${name}.envBlock`);
    const sentinel = m.envSentinel ?? "";
    if (!ENV_SENTINEL_RE.test(sentinel))
      die(`${name}.envSentinel: must be a simple anchored token (^?[A-Za-z0-9_.=-]+$?), got ${JSON.stringify(sentinel)}`);
    out.push(`ENVBLOCK${TAB}${m.envBlock}${TAB}${sentinel}`);
  }
}
process.stdout.write(out.join("\n") + "\n");
