#!/usr/bin/env node
// lockfile-platforms.mjs -- offline check that face/package-lock.json carries the native
// optional package THIS machine needs from every platform family it locks (ADR-1335).
//
// The lockfile is generated on Windows, and npm has a long-lived defect where a lockfile
// written on one OS omits other platforms' optional binaries (npm/cli#4828). `npm ci` then
// installs "successfully" and the build dies later on a missing native module. This check runs
// before `npm ci`, with no network, and names the family that would be missing.
//
// A family is a set of packages whose names differ only by a platform token
// (`@rolldown/binding-linux-x64-gnu`, `@rolldown/binding-win32-x64-msvc`, ...). A package with
// no siblings (`fsevents`) is not a family: it is optional on purpose.
//
// Usage: lockfile-platforms.mjs [--lock PATH]
// Exit:  0 every family covered · 1 a family has no entry for this platform · 2 bad input.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const PLATFORM_TOKEN = /(android|darwin|freebsd|linux|openharmony|win32|sunos|aix|netbsd|openbsd)-(arm64|arm|x64|ia32|ppc64|s390x|riscv64|loong64|wasm32)(-(gnu|musl|msvc|gnueabihf|eabi))?/;

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
 * @param {object} lock parsed package-lock.json (lockfileVersion 2 or 3)
 * @param {{ platform: string, arch: string, libc: string|null }} target
 */
export function checkLockfile(lock, target) {
  if (!lock || typeof lock !== "object" || !lock.packages || typeof lock.packages !== "object") {
    return { ok: false, error: "no `packages` map (lockfileVersion 1 is not supported)", families: 0, missing: [] };
  }
  const families = new Map();
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (!entry || !Array.isArray(entry.os) || !Array.isArray(entry.cpu) || entry.cpu.length === 0) continue;
    const name = key.replace(/^.*node_modules\//, "");
    if (!PLATFORM_TOKEN.test(name)) continue;
    const family = name.replace(PLATFORM_TOKEN, "*");
    if (!families.has(family)) families.set(family, []);
    families.get(family).push({ name, os: entry.os, cpu: entry.cpu, libc: Array.isArray(entry.libc) ? entry.libc : null });
  }
  const missing = [];
  let counted = 0;
  for (const [family, members] of families) {
    if (members.length < 2) continue;
    counted++;
    const hit = members.some((m) => m.os.includes(target.platform) && m.cpu.includes(target.arch)
      && (m.libc === null || target.libc === null || m.libc.includes(target.libc)));
    if (!hit) missing.push(family);
  }
  return { ok: counted > 0 && missing.length === 0, error: counted === 0 ? "no platform families found -- nothing was checked" : null, families: counted, missing };
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
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--lock" && argv[i + 1] && !argv[i + 1].startsWith("--")) { lockPath = argv[++i]; continue; }
    bad = argv[i];
    break;
  }
  if (bad !== null) {
    console.error(`lockfile-platforms: unknown or incomplete argument ${JSON.stringify(bad)} (flags: --lock PATH)`);
    process.exitCode = 2;
  } else {
    let lock;
    try { lock = JSON.parse(readFileSync(lockPath, "utf8")); }
    catch (e) { console.error(`lockfile-platforms: cannot read ${lockPath}: ${e.message}`); process.exitCode = 2; }
    if (lock) {
      const target = { platform: process.platform, arch: process.arch, libc: currentLibc() };
      const r = checkLockfile(lock, target);
      const label = [target.platform, target.arch, target.libc].filter(Boolean).join("-");
      console.log(`lockfile: families=${r.families} platform=${label} missing=${r.missing.length ? r.missing.join(",") : "none"}${r.error ? ` error=${r.error}` : ""}`);
      process.exitCode = r.ok ? 0 : r.error ? 2 : 1;
    }
  }
}
