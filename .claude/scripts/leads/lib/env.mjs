// env.mjs — the Node-side reader for arc's ONE credential home, `.env.local`.
//
// Not a new mechanism, a missing reader for an existing one: `.gitignore` already covers
// `.env.*`, `.env.example` already declares the names, and `toolchain-health.sh` already
// reports which of them are set. Every existing consumer was a shell script using grep, so
// nothing on the Node side could read the same file the operator was told to fill in.
//
// Precedence is ENV-WINS-OVER-FILE, the universal convention. An operator who exports a value
// for one command must not be silently overridden by a file they had forgotten about, and a
// bats file that sets a variable must be able to rely on it holding — a file that clobbered
// the environment would make every test in the suite depend on whether `.env.local` happened
// to exist on that machine, which is the definition of a flaky gate.
//
// This module never returns, logs, or throws a VALUE. The return shape carries a path and two
// counts and nothing else, because the whole point of the file it reads is that its contents
// do not travel.

import { readFileSync, existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

export const ENV_LOCAL = ".env.local";

export class EnvError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "EnvError";
    this.kind = kind; // "unreadable" | "malformed"
  }
}

// A deliberately small grammar: `NAME=value`, `export NAME=value`, `#` comments, blank lines.
//
// No variable interpolation and no multi-line values. Both are real dotenv features and both
// are refused here on purpose: interpolation means a credential file can compute a value, and
// a reader that computes is a reader whose output cannot be predicted from the bytes on disk.
// A line this parser does not understand is SKIPPED rather than guessed at — but see
// `loadEnvLocal`, which counts the skips so silence is never the only signal.
export function parseEnvFile(text) {
  const values = new Map();
  const skipped = [];
  const lines = String(text).split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    // `indexOf` and not `split`: the FIRST `=` separates, every later one belongs to the value.
    // A base64 secret ends in `=` padding routinely, and splitting on all of them truncates it
    // to something that looks like a credential and is not one — the worst failure shape,
    // because the error surfaces at the vendor as an auth failure rather than here as a parse
    // failure.
    if (eq <= 0) { skipped.push(i + 1); continue; }

    const name = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) { skipped.push(i + 1); continue; }

    let value = withoutExport.slice(eq + 1).trim();
    // Strip ONE matched pair of surrounding quotes. Unmatched quotes are left alone: a value
    // that genuinely starts with a quote is likelier than a file with a typo, and stripping a
    // lone quote would silently corrupt a credential.
    const q = value[0];
    if (value.length >= 2 && (q === '"' || q === "'") && value[value.length - 1] === q)
      value = value.slice(1, -1);

    values.set(name, value);
  }

  return { values, skipped };
}

// `root` is injected rather than assumed so a test can point at a temp directory without
// chdir-ing the whole process, which in a bats file would leak into every later test.
export function loadEnvLocal({ root = process.cwd(), env = process.env } = {}) {
  const path = pathResolve(root, ENV_LOCAL);
  if (!existsSync(path)) return { path, present: false, loaded: 0, skipped: [] };

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    // An unreadable `.env.local` is an ERROR and never a quiet fallback to "no credentials".
    // Falling through would produce "RESEND_API_KEY is unset" from a file that is sitting
    // right there with the key in it, and the operator would go looking in the wrong place.
    throw new EnvError("unreadable", `${ENV_LOCAL} exists but could not be read (${e.code || e.message}) — refusing to continue as if it were absent`);
  }

  const { values, skipped } = parseEnvFile(text);
  let loaded = 0;
  for (const [name, value] of values) {
    // Unset AND empty both count as absent. An operator who leaves `RESEND_API_KEY=` in place
    // after copying `.env.example` has not configured anything, and treating that empty string
    // as a set value produces an auth failure at the vendor instead of a clear refusal here.
    if (env[name] === undefined || env[name] === "") {
      env[name] = value;
      loaded++;
    }
  }
  return { path, present: true, loaded, skipped };
}
