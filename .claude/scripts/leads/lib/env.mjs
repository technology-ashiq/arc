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
// This module never returns, logs, or throws a VALUE. The return shape carries a path, a count
// and three lists of NAMES and nothing else, because the whole point of the file it reads is
// that its contents do not travel.
//
// The lists are deliberately not one list. `names` is what the file DECLARES and `applied` is
// what this call CHANGED, and a caller enforcing a policy about a credential file needs the
// first — see the long note in `loadEnvLocal`, which is there because collapsing the two blinded
// the guard completely for any operator who had sourced the file first.

import { readFileSync, statSync } from "node:fs";
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

  // ONE read decides both questions, for the same reason `mail.mjs readQuota` does: asking
  // `existsSync` first and reading second reintroduces the fail-open the catch block below
  // exists to prevent. `existsSync` answers false for EVERY error — EACCES on the containing
  // directory, a parent that is a file, ELOOP, a dangling symlink — so an unreadable credential
  // file was reported as an absent one, which is precisely the "go looking in the wrong place"
  // outcome this function refuses.
  //
  // And ENOENT alone does not mean absent: with a regular file where `root` should be, Linux and
  // macOS report ENOTDIR while Windows reports ENOENT for the identical broken path, so trusting
  // the code fails closed on two legs and open on the third. ENOENT is confirmed against `root`.
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") {
      let st = null;
      try { st = statSync(root); } catch (e2) {
        throw new EnvError("unreadable", `${ENV_LOCAL} could not be read: its directory is unreadable (${(e2 && e2.code) || e2.message}) — refusing to continue as if it were absent`);
      }
      if (!st.isDirectory())
        throw new EnvError("unreadable", `${ENV_LOCAL} could not be read: the path it would live in is not a directory — refusing to continue as if it were absent`);
      return { path, present: false, loaded: 0, names: [], applied: [], blank: [], skipped: [] };
    }
    // An unreadable `.env.local` is an ERROR and never a quiet fallback to "no credentials".
    // Falling through would produce "RESEND_API_KEY is unset" from a file that is sitting
    // right there with the key in it, and the operator would go looking in the wrong place.
    throw new EnvError("unreadable", `${ENV_LOCAL} exists but could not be read (${e.code || e.message}) — refusing to continue as if it were absent`);
  }

  const { values, skipped } = parseEnvFile(text);
  // TWO LISTS, BECAUSE THEY ANSWER TWO DIFFERENT QUESTIONS, and collapsing them into one was a
  // CRITICAL. `names` used to be pushed only inside the applied branch below, so it meant "what
  // this call put into the environment" — while its one consumer, `assertEnvLocalNames`, is a
  // policy about **what the file carries**. Those agree only when nothing else has already set
  // the variable, and the Phase 03 runbook's own first instruction (`set -a; . ./.env.local;
  // set +a`) guarantees they never agree: sourcing sets every one of them first, so every name
  // fails the applied test, `names` comes back EMPTY, and the guard sees a file with nothing
  // in it whatever it holds. A `.env.local` carrying `ARC_LEADS_FAKE=1` then switched the whole
  // run to the fake and printed `mail sent … EXIT=0` having sent nothing — which is verbatim
  // the failure `mail.mjs`'s header says that guard exists to prevent, produced by following
  // the document written to make the run safe. D5: one fact derived two ways.
  //
  //   names   — every name the FILE DECLARES. The policy surface. Never depends on `env`.
  //   applied — the subset this call actually wrote into `env`. The effect surface.
  //   loaded  — `applied.length`, unchanged in meaning, so existing callers keep their number.
  const names = [];
  const applied = [];
  const blank = [];
  for (const [name, value] of values) {
    // DECLARED includes blank. A forbidden name is refused for being MENTIONED in a credential
    // file, not for carrying a value: `set -a` exports `ARC_LEADS_FAKE=` as an empty string just
    // as readily, and every reader that today treats "" as absent (`=== "1"`, `||`) is one edit
    // away from treating it as present. A guard that has to be re-checked every time an unrelated
    // reader changes its truthiness test is not a guard.
    names.push(name);
    // Unset AND empty count as absent on BOTH sides, which the first version only did on the
    // environment side. `RESEND_API_KEY=` is the literal result of `cp .env.example .env.local`,
    // and assigning its empty string counted as `loaded`, appeared in no warning list, and
    // surfaced later as an auth failure at the vendor rather than as a clear refusal here. It is
    // reported as `blank` instead: an operator who half-filled the file gets told which line.
    if (value === "") { blank.push(name); continue; }
    if (env[name] === undefined || env[name] === "") {
      env[name] = value;
      applied.push(name);
    }
  }
  // `names`, `applied` and `blank` carry NAMES, never values. The names are already public —
  // `.env.example` declares every one of them — and a caller cannot enforce a policy about which
  // variables a credential file may set without being told which ones it names.
  return { path, present: true, loaded: applied.length, names, applied, blank, skipped };
}
