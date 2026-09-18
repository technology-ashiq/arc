#!/usr/bin/env node
// lockfile-platforms.mjs -- offline check that face/package-lock.json carries the native
// optional package THIS machine needs, for every package that declares platform binaries
// (ADR-1335).
//
// The lockfile is generated on Windows, and npm has a long-lived defect where a lockfile
// written on one OS omits other platforms' optional binaries (npm/cli#4828). `npm ci` then
// installs "successfully" and the build dies later on a missing native module. This check runs
// before `npm ci`, with no network, and names what would be missing.
//
// The EXPECTED set comes from the parent, never from which siblings happen to be present: a
// package entry whose `optionalDependencies` name platform binaries (`rolldown` lists
// `@rolldown/binding-linux-x64-gnu`, ...) is one family, keyed by the parent's own lockfile
// path. For this machine, at least one declared name whose platform token matches must be
// present in the lockfile where node would resolve it -- a lockfile stripped down to the Windows
// binding fails here by name (attack 2026-09-17, fixed-defects.md).
//
// Node walks UP the tree, so a nested copy really does load a hoisted binding. Presence is not
// enough: the entry it resolves must carry a version that satisfies the parent's own declared
// spec, or a nested `lightningcss@9.9.9` "passes" on a hoisted `-linux-x64-gnu@1.33.0` that will
// not load for it (CI run 35150543730). A spec this file cannot read fails closed, by name.
//
// Usage: lockfile-platforms.mjs [--lock PATH]
// Exit:  0 every family covered · 1 a family has no entry for this platform · 2 bad input.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// Anchored at the END of the name, so whatever follows the cpu IS the ABI, read whole:
// `gnueabihf` is one token, not `gnu` plus a remainder. An ABI this file does not know is kept
// as unknown and never matches a host -- `musleabihf` once read as "no ABI", i.e. any libc, and
// passed a glibc host (attack 2026-09-17).
const PLATFORM_TOKEN = /(?:^|[/-])(android|darwin|freebsd|linuxmusl|linux|openharmony|win32|sunos|aix|netbsd|openbsd)-(arm64|arm|x64|ia32|ppc64|s390x|riscv64|loong64|wasm32)(?:-([a-z0-9]+))?$/;
const LIBC_OF_ABI = { gnu: "glibc", gnueabihf: "glibc", glibc: "glibc", musl: "musl", musleabihf: "musl" };
const ABI_WITHOUT_LIBC = new Set(["msvc", "eabi"]);

export function currentLibc(platform = process.platform) {
  if (platform !== "linux") return null;
  try {
    const header = process.report?.getReport?.().header;
    return header && header.glibcVersionRuntime ? "glibc" : "musl";
  } catch {
    return "glibc";
  }
}

/**
 * The platform a package NAME claims, e.g. `linux x64 glibc` for `...-linux-x64-gnu`. An ABI
 * suffix this file cannot read comes back as `unknownAbi`, which matches no host.
 */
export function platformOfName(name) {
  const m = String(name).match(PLATFORM_TOKEN);
  if (!m) return null;
  const os = m[1] === "linuxmusl" ? "linux" : m[1];
  const osLibc = m[1] === "linuxmusl" ? "musl" : null;
  const abi = m[3] ?? null;
  if (abi === null) return { os, cpu: m[2], libc: osLibc };
  if (ABI_WITHOUT_LIBC.has(abi) && osLibc === null) return { os, cpu: m[2], libc: null };
  const abiLibc = Object.hasOwn(LIBC_OF_ABI, abi) ? LIBC_OF_ABI[abi] : null;
  if (abiLibc !== null && (osLibc === null || osLibc === abiLibc)) return { os, cpu: m[2], libc: abiLibc };
  return { os, cpu: m[2], libc: null, unknownAbi: abi };
}

function matches(target, claim) {
  if (!claim || claim.unknownAbi) return false;
  if (claim.os !== target.platform || claim.cpu !== target.arch) return false;
  return target.libc === null || claim.libc === null || claim.libc === target.libc;
}

// semver's own grammar: no leading zeros, and no part too large to compare exactly.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(text) {
  const m = SEMVER.exec(text);
  if (!m) return null;
  const [major, minor, patch] = [m[1], m[2], m[3]].map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, pre: m[4] ?? null };
}

// Numeric, never lexical: 1.10.0 is above 1.9.0.
function compareCore(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Whether `version` satisfies an optionalDependencies `spec`. Native-binding families pin exact
 * versions today; `^`, `~` and `*` are read too. Anything else -- `>=`, `||`, an npm alias, a
 * prerelease under a range -- is `unsupported`, which the check treats as not satisfied.
 * @returns {{ ok: boolean, why: string|null }}
 */
export function satisfiesSpec(version, spec) {
  if (typeof version !== "string" || !version) return { ok: false, why: "no version" };
  if (typeof spec !== "string") return { ok: false, why: `unsupported spec ${JSON.stringify(spec)}` };
  const have = parseVersion(version.trim());
  if (!have) return { ok: false, why: `unreadable version ${JSON.stringify(version)}` };
  const s = spec.trim();
  if (s === "" || s === "*" || s === "x") {
    return have.pre === null ? { ok: true, why: null } : { ok: false, why: `unsupported prerelease range ${JSON.stringify(spec)}` };
  }
  const op = s[0] === "^" || s[0] === "~" ? s[0] : s[0] === "=" ? "=" : "";
  const want = parseVersion((op ? s.slice(1) : s).trim().replace(/^v/, ""));
  if (!want) return { ok: false, why: `unsupported spec ${JSON.stringify(spec)}` };
  if (op === "" || op === "=") {
    const same = compareCore(have, want) === 0 && have.pre === want.pre;
    return { ok: same, why: same ? null : `declared ${s}` };
  }
  if (have.pre !== null || want.pre !== null) return { ok: false, why: `unsupported prerelease range ${JSON.stringify(spec)}` };
  let inRange = compareCore(have, want) >= 0 && have.major === want.major;
  if (op === "~" || want.major === 0) inRange = inRange && have.minor === want.minor;
  if (op === "^" && want.major === 0 && want.minor === 0) inRange = inRange && have.patch === want.patch;
  return { ok: inRange, why: inRange ? null : `declared ${s}` };
}

/** Where node would resolve `name` from the package at lockfile path `parent`. */
function resolvedEntry(packages, parent, name) {
  let dir = parent;
  for (;;) {
    const key = `${dir ? `${dir}/` : ""}node_modules/${name}`;
    if (Object.hasOwn(packages, key)) return { key, entry: packages[key] };
    if (!dir) return null;
    const cut = dir.lastIndexOf("/node_modules/");
    dir = cut < 0 ? "" : dir.slice(0, cut);
  }
}

/**
 * @param {object} lock parsed package-lock.json (lockfileVersion 2 or 3)
 * @param {{ platform: string, arch: string, libc: string|null }} target
 */
export function checkLockfile(lock, target) {
  if (!lock || typeof lock !== "object" || !lock.packages || typeof lock.packages !== "object") {
    return { ok: false, error: "no `packages` map (lockfileVersion 1 is not supported)", families: 0, missing: [] };
  }
  const packages = lock.packages;
  const missing = [];
  const familyNames = [];
  let families = 0;
  for (const [parent, entry] of Object.entries(packages)) {
    const label = parent || "(root)";
    // Malformed is a named finding, never a family that quietly drops out of the check.
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) { missing.push(`${label} (malformed entry)`); continue; }
    if (entry.optionalDependencies === undefined) continue;
    const declaredMap = entry.optionalDependencies;
    if (!declaredMap || typeof declaredMap !== "object" || Array.isArray(declaredMap)) { missing.push(`${label} (malformed optionalDependencies)`); continue; }
    const declared = Object.keys(declaredMap).filter((n) => platformOfName(n) !== null);
    if (declared.length === 0) continue;
    families++;
    familyNames.push(parent.replace(/^.*node_modules\//, ""));
    const forTarget = declared.filter((n) => matches(target, platformOfName(n)));
    if (forTarget.length === 0) {
      const unread = declared.filter((n) => {
        const c = platformOfName(n);
        return c.unknownAbi && c.os === target.platform && c.cpu === target.arch;
      });
      missing.push(`${label} (declares no binary for this platform${unread.length ? `; unread ABI: ${unread.join("|")}` : ""})`);
      continue;
    }
    const refused = [];
    const present = forTarget.filter((n) => {
      const hit = resolvedEntry(packages, parent, n);
      if (!hit) return false;
      const e = hit.entry;
      if (!e || typeof e !== "object") return false;
      // The entry's own os/cpu/libc fields, when npm wrote them, must agree with its name.
      if (Array.isArray(e.os) && !e.os.includes(target.platform)) return false;
      if (Array.isArray(e.cpu) && !e.cpu.includes(target.arch)) return false;
      if (Array.isArray(e.libc) && target.libc && !e.libc.includes(target.libc)) return false;
      const fit = satisfiesSpec(e.version, declaredMap[n]);
      if (!fit.ok) refused.push(`${hit.key}@${e.version ?? "?"} ${fit.why}`);
      return fit.ok;
    });
    if (present.length === 0) missing.push(`${label} -> ${forTarget.join("|")}${refused.length ? ` (resolves ${refused.join("; ")})` : ""}`);
  }
  return {
    ok: families > 0 && missing.length === 0,
    error: families === 0 ? "no package declares platform binaries -- nothing was checked" : null,
    families,
    // By name, so a caller can require the families its dependencies need: a lockfile stripped of
    // a whole family's declaration reports one family fewer, and a count floor cannot see which.
    familyNames: [...new Set(familyNames)].sort(),
    missing,
  };
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  let lockPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package-lock.json");
  let bad = null;
  let seenLock = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--lock" && !seenLock && argv[i + 1] && !argv[i + 1].startsWith("--")) { lockPath = argv[++i]; seenLock = true; continue; }
    bad = argv[i];
    break;
  }
  if (bad !== null) {
    console.error(`lockfile-platforms: unknown, repeated or incomplete argument ${JSON.stringify(bad)} (flags: --lock PATH)`);
    process.exitCode = 2;
  } else {
    let lock;
    try { lock = JSON.parse(readFileSync(lockPath, "utf8")); }
    catch (e) { console.error(`lockfile-platforms: cannot read ${lockPath}: ${e.message}`); process.exitCode = 2; }
    if (lock !== undefined) {
      const target = { platform: process.platform, arch: process.arch, libc: currentLibc() };
      const r = checkLockfile(lock, target);
      const label = [target.platform, target.arch, target.libc].filter(Boolean).join("-");
      console.log(`lockfile: families=${r.families} platform=${label} missing=${r.missing.length ? r.missing.join(", ") : "none"}${r.error ? ` error=${r.error}` : ""}`);
      console.log(`lockfile: family-names=${(r.familyNames ?? []).join(",") || "none"}`);
      process.exitCode = r.ok ? 0 : r.error ? 2 : 1;
    }
  }
}
