#!/usr/bin/env node
/**
 * REQ-06 is the legal lane's one permanent non-negotiable: **no page is ever published without a
 * human decision.** Four specs repeat that sentence. Until this file existed, nothing tested it.
 *
 * The mechanism it protects is `hq.policy.yaml`'s `targets.publish`, a closed enum that is EMPTY.
 * Empty means there is no target any automation can name, so no automated publish is addressable
 * -- not "is discouraged", cannot be addressed. This gate asserts it stays empty.
 *
 * It runs on EVERY CI leg, not only on changes under `.claude/scripts/legal/**`. The value lives
 * in a shared company organ any lane can edit, and the lane most likely to add a publish target
 * is not the one that wrote this. A guard that only watches its author's own diffs is not
 * watching the change it exists to catch.
 *
 * Exit 0 empty and safe - exit 2 a publish target exists - exit 3 could not check.
 *
 * ---------------------------------------------------------------------------------------------
 * IT USES THE AUTHORITATIVE PARSER, AND THAT IS THE WHOLE POINT.
 *
 * The first cut hand-rolled a tiny YAML reader "because this reads exactly one shape in one known
 * file". A fresh shell/OS attacker then produced FIVE valid YAML spellings of a live publish
 * target that the gate passed at exit 0, printing its success banner each time -- among them the
 * most idiomatic style of all, a block sequence at the key's own indentation:
 *
 *     targets:
 *       publish:
 *       - legal.publish
 *
 * and a decoy nested key, which the reader matched at any depth and returned first:
 *
 *     targets:
 *       legacy:
 *         publish: []        <- the gate stopped here
 *       publish:
 *         - legal.publish    <- the real, live target
 *
 * The one shape it did catch was the indented dash -- which is exactly the shape its own mutant
 * used. `gate-author-cannot-be-its-attacker`, verbatim: the author's mutants were derived from
 * the implementation, so they tested what it already did.
 *
 * Sharing `parsePolicyYaml` with the enforcer makes gate and enforcement INCAPABLE of disagreeing
 * about what the policy says. Two parsers is two answers, and the second one is always the one
 * nobody is enforcing.
 * ---------------------------------------------------------------------------------------------
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const POLICY = join(REPO_ROOT, "hq.policy.yaml");

function die(code, message) {
  process.stderr.write(`publish-gate: ${message}\n`);
  process.exit(code);
}

if (!existsSync(POLICY)) die(3, `hq.policy.yaml is missing at ${POLICY}`);

// pathToFileURL, not a bare path: on Windows a drive-letter path is not a valid ESM specifier and
// `await import("C:\\...")` fails with ERR_UNSUPPORTED_ESM_URL_SCHEME -- on one CI leg only.
const parserPath = join(REPO_ROOT, ".claude", "scripts", "hq", "lib", "policy", "yaml.mjs");
if (!existsSync(parserPath)) die(3, `the authoritative policy parser is missing at ${parserPath}`);

let parsePolicyYaml;
try { ({ parsePolicyYaml } = await import(pathToFileURL(parserPath).href)); }
catch (e) { die(3, `cannot load the policy parser: ${e.message}`); }
if (typeof parsePolicyYaml !== "function") die(3, "the policy parser does not export parsePolicyYaml");

let doc;
try { doc = parsePolicyYaml(readFileSync(POLICY, "utf8")); }
catch (e) {
  // An unparseable policy is "could not check", never "checked and fine". The strict parser
  // rejects duplicate keys and tabs, which is most of why it is used here.
  die(3, `hq.policy.yaml did not parse: ${e.message}`);
}

const targets = doc?.targets;
if (targets === undefined || targets === null || typeof targets !== "object" || Array.isArray(targets))
  die(2, "hq.policy.yaml has no `targets` mapping. REQ-06 rests on `targets.publish` existing and being EMPTY; without the block there is nothing constraining what a publish target may be named.");

if (!Object.prototype.hasOwnProperty.call(targets, "publish"))
  die(2, "targets.publish is not present in hq.policy.yaml. REQ-06 rests on that key existing and being EMPTY; a deleted closed enum constrains nothing, so its absence is a WEAKER state than the one this gate protects, not a stronger one.");

const publish = targets.publish;

// `null` is what `publish:` with no value parses to. It is not an empty list -- it is a key with
// no constraint attached, and it must not read as safe.
if (publish === null || publish === undefined)
  die(2, "targets.publish is present but empty-valued (`publish:` with nothing after it). That is a key with no list, not an empty list. Write `publish: []` to mean the closed, empty enum.");

if (!Array.isArray(publish))
  die(2, `targets.publish is ${typeof publish}, not a list. REQ-06 needs it to be an EMPTY list.`);

if (publish.length)
  die(2, `targets.publish lists ${publish.length} target(s): ${publish.map(String).join(", ")}. REQ-06 makes the human gate PERMANENT. If this change is intended it needs an ADR that supersedes REQ-06, not a green build.`);

process.stdout.write("publish-gate: targets.publish is empty - REQ-06 human gate intact\n");
