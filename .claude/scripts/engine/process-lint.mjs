#!/usr/bin/env node
/**
 * process-lint.mjs -- the gate on the canonical process layer (Phase 00).
 *
 * Every check here is STRUCTURAL: a presence-or-parse question with no judgement in it, so
 * every one of them exits 1. On the WARN-first question -- which the PLAN's no-go and this
 * phase's spec could otherwise be read as contradicting -- the no-go governs promoting a
 * gate to BLOCK *in the CI pipeline*, which this phase does not do. It does not govern the
 * tool's own exit code: a lint that cannot exit non-zero on a hostile input is not a lint,
 * and its fixtures could assert nothing.
 *
 * Check ids are fixed in phases/phase-00-spec.md so fixtures and messages are written
 * against them and cannot drift apart:
 *   yaml-parse · yaml-excluded · schema-keyword · schema-shape · name-semver ·
 *   tool-unknown · permissions-invalid · placeholder-dialect · placeholder-malformed ·
 *   evals-path · target-passthrough · baseline-drift · inputs-shape
 *   (lf-only and golden-unrecorded are RESERVED here and implemented in Phase 01 -- they
 *    check GENERATED output, which does not exist yet. Listed so the vocabulary is fixed
 *    once rather than grown per phase.)
 *
 * CRLF and duplicate keys in a canonical SOURCE file are yaml-parse, not lf-only: a
 * source file's encoding is the parser's business and a generated file's line endings are
 * the compiler's. Two checks on two artifacts that would otherwise share a name and hide
 * each other.
 *
 * Usage: process-lint.mjs [FILE...] | --all [--root PATH]
 * Zero dependencies, Node 18+.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { parseYamlSubset } from "./yaml-subset.mjs";
import { KEYWORDS, validateSchemaDoc } from "./schema-subset.mjs";
// Imported, never copied: a regex copied out of the spine is a regex that drifts from the
// spine (retro-log 2026-07-22, counts that rot the moment the code moves).
import { PROCESS_RE } from "../hq/lib/validate.mjs";

// ADR-0206: seven primitives, capped. An eighth value is a FAIL, not an extension.
export const TOOLS = Object.freeze([
  "fs.read", "fs.write", "shell.run", "web.search", "git.op", "ask.human", "agent.invoke",
]);
export const PERMISSIONS = Object.freeze(["declared", "unrestricted"]);
// ADR-0206: the filter set is closed at ONE. That closure is what makes an
// "unknown filter" hostile fixture constructible at all.
export const FILTERS = Object.freeze(["default"]);

const TOOL_SET = new Set(TOOLS);

// ---------- output ----------
const findings = [];
const add = (check, where, what, expected, found, example) =>
  findings.push({ check, where, what, expected, found, example });

// ---------- root ----------
function gitToplevel() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}

const argv = process.argv.slice(2);
let root = "";
const files = [];
let all = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--all") all = true;
  else if (a === "--root") root = argv[++i] ?? "";
  else if (a.startsWith("--")) {
    console.error(`process-lint: unknown option ${a}`);
    process.exit(2);
  } else files.push(a);
}
root = resolve(root || gitToplevel() || ".");

if (all) {
  const dir = join(root, "processes");
  if (!existsSync(dir)) {
    console.error(`process-lint: no processes/ directory under ${root}`);
    process.exit(1);
  }
  for (const f of readdirSync(dir).sort()) if (f.endsWith(".process.yaml")) files.push(join(dir, f));
}
if (!files.length) {
  console.error("usage: process-lint.mjs [FILE...] | --all [--root PATH]");
  process.exit(2);
}

// ---------- helpers ----------
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const short = (s, n = 60) => (String(s).length > n ? `${String(s).slice(0, n - 3)}...` : String(s));

/** 1-based line of the first occurrence of a needle, for pointing at real places. */
function lineOf(text, needle) {
  const idx = text.indexOf(needle);
  return idx < 0 ? 1 : text.slice(0, idx).split("\n").length;
}

// ---------- per-file checks ----------
for (const file of files) {
  const rel = relative(root, resolve(file)) || file;
  if (!existsSync(file)) {
    add("yaml-parse", `${rel}:1`, "file does not exist", "a readable file", file, "check the path");
    continue;
  }
  const text = readFileSync(file, "utf8");

  const parsed = parseYamlSubset(text);
  if (!parsed.ok) {
    const e = parsed.error;
    add(e.check, `${rel}:${e.line}`, e.what, e.expected, e.found, e.example);
    continue; // nothing downstream can be trusted once the bytes did not parse
  }
  const doc = parsed.value;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    add("yaml-parse", `${rel}:1`, "root of the document is not a mapping", "a mapping", String(doc), "name: my-process");
    continue;
  }

  // --- target-passthrough (ADR-0205): no per-target escape hatch, ever ---
  for (const k of Object.keys(doc)) {
    if (/^x-[a-z0-9]+(-[a-z0-9]+)*$/i.test(k)) {
      add(
        "target-passthrough",
        `${rel}:${lineOf(text, k)}`,
        `per-target passthrough key \`${k}\` is forbidden (ADR-0205)`,
        "one shared `body:` that every adapter renders",
        k,
        "move the content into `body:`, or accept the residue as a named finding",
      );
    }
  }

  // --- name-semver: asserted against the spine's live PROCESS_RE ---
  const name = doc.name;
  const version = doc.version;
  if (typeof name !== "string" || typeof version !== "string") {
    add("name-semver", `${rel}:1`, "`name` and `version` must both be present strings", "name: my-process / version: 1.0.0", `name=${JSON.stringify(name)} version=${JSON.stringify(version)}`, "version: 1.0.0");
  } else if (!PROCESS_RE.test(`${name}@${version}`)) {
    add(
      "name-semver",
      `${rel}:${lineOf(text, "name:")}`,
      "`name@version` does not satisfy the spine's PROCESS_RE",
      String(PROCESS_RE),
      `${name}@${version}`,
      "commit-msg-draft@1.0.0",
    );
  }

  // --- permissions-invalid (ADR-0205) ---
  if (!PERMISSIONS.includes(doc.permissions)) {
    add(
      "permissions-invalid",
      `${rel}:${lineOf(text, "permissions:")}`,
      "`permissions` is missing or not one of the two allowed values",
      PERMISSIONS.join(" | "),
      JSON.stringify(doc.permissions),
      "permissions: declared",
    );
  }

  // --- inputs-shape ---
  const inputs = doc.inputs;
  const inputNames = new Set();
  if (!Array.isArray(inputs)) {
    add("inputs-shape", `${rel}:${lineOf(text, "inputs:")}`, "`inputs` is missing or not a list", "a list (use `inputs: []` for none)", JSON.stringify(inputs), "inputs: []");
  } else {
    inputs.forEach((inp, idx) => {
      const at = `${rel}:${lineOf(text, "inputs:")}`;
      if (!inp || typeof inp !== "object" || Array.isArray(inp)) {
        add("inputs-shape", at, `inputs[${idx}] is not a mapping`, "a mapping with name/type/required", JSON.stringify(inp), "- name: base");
        return;
      }
      if (typeof inp.name !== "string" || !/^[a-z][a-z0-9_-]*$/.test(inp.name)) {
        add("inputs-shape", at, `inputs[${idx}].name is missing or malformed`, "^[a-z][a-z0-9_-]*$", JSON.stringify(inp.name), "name: base");
      } else inputNames.add(inp.name);
      if (inp.type !== "string") {
        add("inputs-shape", at, `inputs[${idx}].type must be \`string\` in v1`, "string", JSON.stringify(inp.type), "type: string");
      }
      if (typeof inp.required !== "boolean") {
        add("inputs-shape", at, `inputs[${idx}].required must be a boolean`, "true or false", JSON.stringify(inp.required), "required: false");
      }
      if (inp.required === true && "default" in inp) {
        add("inputs-shape", at, `inputs[${idx}] is required AND has a default`, "a default makes it not required", `${inp.name}: required + default`, "drop one of the two");
      }
      for (const k of Object.keys(inp)) {
        if (!["name", "type", "required", "default", "description"].includes(k)) {
          add("inputs-shape", at, `inputs[${idx}] has unknown key \`${k}\``, "name, type, required, default, description", k, "remove it");
        }
      }
    });
  }

  // --- tool-unknown (ADR-0206) ---
  // A tools entry is EITHER a bare primitive (`- git.op`) or a single-key mapping carrying
  // that primitive's scopes (`- git.op:` then a list). Scopes are canonical, not dialect:
  // "this process may run git status and git commit" is a fact about the process, and it is
  // what lets an adapter regenerate a command-scoped permission line. A bare primitive list
  // could not, which is the concrete shape ADR-0205's derived-frontmatter rule needs.
  if (!Array.isArray(doc.tools)) {
    add("tool-unknown", `${rel}:${lineOf(text, "tools:")}`, "`tools` is missing or not a list", "a list of abstract primitives", JSON.stringify(doc.tools), "tools:\n  - git.op");
  } else {
    for (const t of doc.tools) {
      if (typeof t === "string") {
        if (!TOOL_SET.has(t)) {
          add("tool-unknown", `${rel}:${lineOf(text, t)}`, `unknown abstract tool \`${t}\``, TOOLS.join(", "), t, "an eighth primitive is a decision, not an edit -- route it through /arc-change");
        }
        continue;
      }
      if (!t || typeof t !== "object" || Array.isArray(t)) {
        add("tool-unknown", `${rel}:${lineOf(text, "tools:")}`, "tools entry is neither a primitive nor a scoped mapping", "`- git.op` or `- git.op:` with a scope list", JSON.stringify(t), "- git.op");
        continue;
      }
      const keys = Object.keys(t);
      if (keys.length !== 1) {
        add("tool-unknown", `${rel}:${lineOf(text, "tools:")}`, `scoped tools entry has ${keys.length} keys`, "exactly one primitive per entry", keys.join(", "), "- git.op:\n    - status");
        continue;
      }
      const prim = keys[0];
      if (!TOOL_SET.has(prim)) {
        add("tool-unknown", `${rel}:${lineOf(text, prim)}`, `unknown abstract tool \`${prim}\``, TOOLS.join(", "), prim, "an eighth primitive is a decision, not an edit -- route it through /arc-change");
        continue;
      }
      const scopes = t[prim];
      if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((s) => typeof s !== "string" || !s)) {
        add("tool-unknown", `${rel}:${lineOf(text, prim)}`, `scopes for \`${prim}\` must be a non-empty list of strings`, "a list of scope strings", JSON.stringify(scopes), "- git.op:\n    - status");
      }
    }
  }

  // --- schema-keyword / schema-shape ---
  if (!doc.output || typeof doc.output !== "object") {
    add("schema-shape", `${rel}:${lineOf(text, "output:")}`, "`output` block is missing", "a JSON-Schema-subset document", JSON.stringify(doc.output), "output:\n  type: object");
  } else {
    for (const f of validateSchemaDoc(doc.output)) {
      const isKeyword = /unsupported schema keyword/.test(f.what);
      add(
        isKeyword ? "schema-keyword" : "schema-shape",
        `${rel}:${lineOf(text, "output:")}`,
        `${f.path}: ${f.what}`,
        f.expected ?? KEYWORDS.join(", "),
        f.found,
        f.example,
      );
    }
  }

  // --- evals-path ---
  if (!Array.isArray(doc.evals) || doc.evals.length === 0) {
    add("evals-path", `${rel}:${lineOf(text, "evals:")}`, "`evals` is missing or empty", "a non-empty list of repo-relative paths", JSON.stringify(doc.evals), "evals:\n  - tests/fixtures/engine/evals/x/basic.json");
  } else {
    for (const p of doc.evals) {
      const at = `${rel}:${lineOf(text, String(p))}`;
      if (typeof p !== "string" || !p) {
        add("evals-path", at, "eval entry is not a string path", "a repo-relative path", JSON.stringify(p), "tests/fixtures/engine/evals/x/basic.json");
        continue;
      }
      const abs = resolve(root, p);
      // Escape check is on the RESOLVED path, not on the literal text: `a/../../etc` has
      // no leading `..` and would pass a textual check while landing outside the repo.
      if (abs !== root && !abs.startsWith(root + sep)) {
        add("evals-path", at, "eval path escapes the repository root", "a path inside the repo", p, "keep fixtures under tests/fixtures/engine/evals/");
        continue;
      }
      if (resolve(file) === abs) {
        add("evals-path", at, "eval path names the process file itself", "a fixture file", p, "point it at a JSON fixture");
        continue;
      }
      if (!existsSync(abs)) {
        add("evals-path", at, "eval fixture does not exist", "an existing file", p, "create the fixture, or correct the path");
      }
    }
  }

  // --- body + placeholders ---
  const body = doc.body;
  if (typeof body !== "string" || !body.trim()) {
    add("placeholder-malformed", `${rel}:${lineOf(text, "body:")}`, "`body` block scalar is missing or empty", "the process's target-neutral prose", JSON.stringify(short(body, 30)), "body: |");
  } else {
    const bodyLine = lineOf(text, "body:");
    // Dialect-native placeholders: the body is shared by every adapter (ADR-0205), so a
    // claude-code placeholder sitting in it makes the body target-specific through a side
    // door -- exactly what the no-passthrough rule exists to prevent.
    for (const re of [/\$\{\d+(:-[^}]*)?\}/g, /\$ARGUMENTS\b/g, /(^|[^\\$])\$\d\b/g]) {
      for (const m of body.matchAll(re)) {
        add(
          "placeholder-dialect",
          `${rel}:${bodyLine}`,
          `dialect-native placeholder \`${m[0].trim()}\` inside \`body:\``,
          "{{input.NAME}} or {{input.NAME|default:VALUE}}",
          m[0].trim(),
          "{{input.base|default:main}}",
        );
      }
    }
    // Neutral placeholders: closed grammar, closed filter set (ADR-0206).
    for (const m of body.matchAll(/\{\{([^}]*)\}\}/g)) {
      const inner = m[1];
      const whole = `{{${inner}}}`;
      const gm = inner.match(/^input\.([a-z][a-z0-9_-]*)(?:\|([a-z]+):(.*))?$/);
      if (!gm) {
        add(
          "placeholder-malformed",
          `${rel}:${bodyLine}`,
          `malformed placeholder \`${short(whole, 40)}\``,
          "{{input.NAME}} or {{input.NAME|default:VALUE}} -- root is always `input`, one level deep",
          whole,
          "{{input.base|default:main}}",
        );
        continue;
      }
      if (gm[2] !== undefined && !FILTERS.includes(gm[2])) {
        add(
          "placeholder-malformed",
          `${rel}:${bodyLine}`,
          `unknown placeholder filter \`${gm[2]}\``,
          `the filter set is closed at: ${FILTERS.join(", ")}`,
          gm[2],
          "{{input.base|default:main}}",
        );
      }
      if (Array.isArray(inputs) && !inputNames.has(gm[1])) {
        add(
          "placeholder-malformed",
          `${rel}:${bodyLine}`,
          `placeholder names input \`${gm[1]}\`, which \`inputs:\` does not declare`,
          `one of: ${[...inputNames].join(", ") || "(none declared)"}`,
          gm[1],
          "declare it under inputs:, or fix the name",
        );
      }
    }
    // An unbalanced `{{` never reaches the matcher above, so it needs its own pass --
    // otherwise the most obvious broken placeholder is the one the check cannot see.
    const opens = (body.match(/\{\{/g) || []).length;
    const closes = (body.match(/\}\}/g) || []).length;
    if (opens !== closes) {
      add(
        "placeholder-malformed",
        `${rel}:${bodyLine}`,
        `unbalanced placeholder braces in \`body:\` (${opens} \`{{\` vs ${closes} \`}}\`)`,
        "every {{ closed by a }}",
        `${opens} open / ${closes} close`,
        "{{input.base}}",
      );
    }
  }

  // --- baseline-drift (ADR-0202): the pinned hash, recomputed, never assumed ---
  const bl = doc.baseline;
  if (!bl || typeof bl !== "object" || Array.isArray(bl)) {
    add("baseline-drift", `${rel}:${lineOf(text, "baseline:")}`, "`baseline` block is missing", "target, path, commit, sha256", JSON.stringify(bl), "baseline:\n  target: claude-code");
  } else {
    for (const k of ["target", "path", "commit", "sha256"]) {
      if (typeof bl[k] !== "string" || !bl[k]) {
        add("baseline-drift", `${rel}:${lineOf(text, "baseline:")}`, `baseline.${k} is missing`, "a string", JSON.stringify(bl[k]), `${k}: ...`);
      }
    }
    if (typeof bl.path === "string" && typeof bl.sha256 === "string" && /^[0-9a-f]{64}$/.test(bl.sha256)) {
      const abs = resolve(root, bl.path);
      if (!existsSync(abs)) {
        add("baseline-drift", `${rel}:${lineOf(text, bl.path)}`, "baseline.path does not exist", "the live pilot file", bl.path, "correct the path");
      } else {
        // LF-normalise before hashing so a checkout with autocrlf does not read as drift.
        // What that destroys -- line-ending information -- is measured by Phase 01's
        // separate `lf-only` check on GENERATED files, never folded into this one.
        const live = sha256(readFileSync(abs, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
        if (live !== bl.sha256) {
          add(
            "baseline-drift",
            `${rel}:${lineOf(text, bl.sha256)}`,
            `the pinned baseline for \`${bl.path}\` has moved since ${bl.commit}`,
            `sha256 ${bl.sha256}`,
            `sha256 ${live}`,
            "adjudicate the drift, then re-pin deliberately -- never absorb it silently (ADR-0202)",
          );
        }
      }
    } else if (typeof bl.sha256 === "string" && bl.sha256 && !/^[0-9a-f]{64}$/.test(bl.sha256)) {
      add("baseline-drift", `${rel}:${lineOf(text, "sha256")}`, "baseline.sha256 is not 64 lowercase hex", "^[0-9a-f]{64}$", short(bl.sha256, 20), "sha256: 4eb875...");
    }
  }
}

// ---------- report ----------
const out = [];
for (const f of findings) {
  out.push(`[${f.check}] ${f.where} — ${f.what}`);
  if (f.expected !== undefined) out.push(`  Expected: ${f.expected}`);
  if (f.found !== undefined) out.push(`  Found:    ${f.found}`);
  if (f.example !== undefined) out.push(`  Example:  ${f.example}`);
}
if (findings.length) {
  out.push("");
  out.push(`process-lint: ${findings.length} check(s) FAILED across ${files.length} file(s)`);
  console.log(out.join("\n"));
  process.exit(1);
}
console.log(`process-lint: all checks passed ✔ (${files.length} file(s))`);
process.exit(0);
