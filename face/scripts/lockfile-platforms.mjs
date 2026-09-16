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
// path so a nested copy cannot borrow a hoisted copy's binaries. For this machine, at least one
// declared name whose platform token matches must be present in the lockfile where node would
// resolve it -- a lockfile stripped down to the Windows binding fails here by name
// (attack 2026-09-17, fixed-defects.md).
//
// Usage: lockfile-platforms.mjs [--lock PATH]
// Exit:  0 every family covered · 1 a family has no entry for this platform · 2 bad input.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// Longest alternatives first: `gnueabihf` must win over `gnu`, or linux-arm reads as two
// families that are both missing.
const PLATFORM_TOKEN = /(android|darwin|freebsd|linux|openharmony|win32|sunos|aix|netbsd|openbsd)-(arm64|arm|x64|ia32|ppc64|s390x|riscv64|loong64|wasm32)(?:-(gnueabihf|gnu|musl|msvc|eabi))?(?![a-z0-9])/;

export function currentLibc(platform = process.platform) {
  if (platform !== "linux") return null;
  try {
    const header = process.report?.getReport?.().header;
    return header && header.glibcVersionRuntime ? "glibc" : "musl";
  } catch {
    return "glibc";
  }
}

/** The platform a package NAME claims, e.g. `linux x64 glibc` for `...-linux-x64-gnu`. */
export function platformOfName(name) {
  const m = String(name).match(PLATFORM_TOKEN);
  if (!m) return null;
  const abi = m[3] ?? null;
  const libc = abi === "musl" ? "musl" : abi === "gnu" || abi === "gnueabihf" ? "glibc" : null;
  return { os: m[1], cpu: m[2], libc };
}

function matches(target, claim) {
  if (!claim) return false;
  if (claim.os !== target.platform || claim.cpu !== target.arch) return false;
  return target.libc === null || claim.libc === null || claim.libc === target.libc;
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
  let families = 0;
  for (const [parent, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== "object" || !entry.optionalDependencies || typeof entry.optionalDependencies !== "object") continue;
    const declared = Object.keys(entry.optionalDependencies).filter((n) => platformOfName(n) !== null);
    if (declared.length === 0) continue;
    families++;
    const label = parent || "(root)";
    const forTarget = declared.filter((n) => matches(target, platformOfName(n)));
    if (forTarget.length === 0) {
      missing.push(`${label} (declares no binary for this platform)`);
      continue;
    }
    const present = forTarget.filter((n) => {
      const hit = resolvedEntry(packages, parent, n);
      if (!hit) return false;
      const e = hit.entry;
      // The entry's own os/cpu/libc fields, when npm wrote them, must agree with its name.
      if (Array.isArray(e.os) && !e.os.includes(target.platform)) return false;
      if (Array.isArray(e.cpu) && !e.cpu.includes(target.arch)) return false;
      if (Array.isArray(e.libc) && target.libc && !e.libc.includes(target.libc)) return false;
      return true;
    });
    if (present.length === 0) missing.push(`${label} -> ${forTarget.join("|")}`);
  }
  return {
    ok: families > 0 && missing.length === 0,
    error: families === 0 ? "no package declares platform binaries -- nothing was checked" : null,
    families,
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
      process.exitCode = r.ok ? 0 : r.error ? 2 : 1;
    }
  }
}
