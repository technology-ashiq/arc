#!/usr/bin/env node
/**
 * Test probe for the legal suites. Exists so that no JavaScript is ever embedded in a shell
 * string: an apostrophe inside a single-quoted `node -e` closes the string, and a backtick or
 * a `$` inside a double-quoted one runs as a command. Both have landed in this repo, the
 * second time inside the comment explaining the first (retro-log 2026-08-03, 2026-08-12).
 *
 * Every subcommand prints ONE line and exits 0 on success, or prints an error to stderr and
 * exits nonzero. A subcommand that cannot do its job never prints a number that could be
 * mistaken for an answer -- "0 findings" and "could not read the sidecar" must not look alike.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

// This file lives at <repo>/tests/, so the repo root is two levels up. Imported through
// pathToFileURL rather than a bare path: on Windows a drive-letter path is not a valid ESM
// specifier and `await import("C:\\...")` fails with ERR_UNSUPPORTED_ESM_URL_SCHEME -- on
// exactly one of the three CI legs, which is where this repo's invisible failures live.
const ARC_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const [, , cmd, ...rest] = process.argv;

function die(msg) {
  console.error(`legal-probe: ${msg}`);
  process.exit(9);
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { die(`cannot read ${p}: ${e.message}`); }
}

function get(obj, dotted) {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[Number(part)] : cur[part];
  }
  return cur;
}

switch (cmd) {
  /** findings <run.json> <group|any> <level|any> -> a count, always a number */
  case "findings": {
    const [file, group, level] = rest;
    const run = readJson(file);
    if (!Array.isArray(run.findings)) die("the sidecar has no findings array");
    const n = run.findings.filter(
      (f) => (group === "any" || f.group === group) && (level === "any" || f.level === level),
    ).length;
    console.log(String(n));
    break;
  }

  /** finding-clauses <run.json> <group> <level> -> space-separated clause ids */
  case "finding-clauses": {
    const [file, group, level] = rest;
    const run = readJson(file);
    const ids = run.findings
      .filter((f) => (group === "any" || f.group === group) && (level === "any" || f.level === level))
      .map((f) => f.clause);
    console.log(ids.join(" "));
    break;
  }

  /** field <run.json> <dotted.path> -> the value, JSON-encoded when not a scalar */
  case "field": {
    const [file, path] = rest;
    const v = get(readJson(file), path);
    if (v === undefined) die(`no such field: ${path}`);
    console.log(typeof v === "object" ? JSON.stringify(v) : String(v));
    break;
  }

  /** clauses <run.json> <page> -> the clause ids emitted on that page */
  case "clauses": {
    const [file, page] = rest;
    const run = readJson(file);
    const p = (run.pages || []).find((x) => x.page === page);
    if (!p) die(`no page "${page}" in the sidecar`);
    console.log(p.clauses.join(" "));
    break;
  }

  /** pagesha <run.json> <page> -> that page's output_sha256 */
  case "pagesha": {
    const [file, page] = rest;
    const run = readJson(file);
    const p = (run.pages || []).find((x) => x.page === page);
    if (!p) die(`no page "${page}" in the sidecar`);
    console.log(p.output_sha256);
    break;
  }

  /** sha <file> -> sha256 of the bytes on disk */
  case "sha": {
    const [file] = rest;
    let buf;
    try { buf = readFileSync(file); } catch (e) { die(`cannot read ${file}: ${e.message}`); }
    if (buf.length === 0) die(`${file} is empty; an empty fixture is a silent pass generator`);
    console.log(createHash("sha256").update(buf).digest("hex"));
    break;
  }

  /**
   * canon <case> -> the canonicaliser's answer for a constructed input.
   * Prints `same`, `differ`, or `refused:<CODE>`. Every case is one the repo has actually
   * been bitten by, or one an attacker would try first.
   */
  case "canon": {
    const [name, libPath] = rest;
    const lib = await import(libPath ? pathToFileURL(libPath).href : new URL("../.claude/scripts/legal/lib/canonical.mjs", import.meta.url).href);
    const { canonicalHash } = lib;
    const cmp = (a, b) => (canonicalHash(a) === canonicalHash(b) ? "same" : "differ");
    const refuse = (fn) => {
      try { fn(); return "accepted"; }
      catch (e) { return "refused:" + (e.code || "UNKNOWN"); }
    };

    switch (name) {
      case "int-vs-string":
        console.log(cmp({ v: 1000 }, { v: "1000" }));
        break;
      case "disabled-vs-unset":
        console.log(cmp({ v: null }, {}));
        break;
      case "nfc-vs-nfd": {
        // Built from ESCAPES, never typed as two literals. Typed literally, an editor or a
        // filesystem normalises both to the same form and the case then compares a string
        // with itself -- which passes whatever the canonicaliser does. That is the vacuous
        // pass, inside the very test written to prove normalisation happens. The guard below
        // makes the degenerate case impossible rather than unlikely.
        const nfc = "Renú";        // one codepoint: U+00FA
        const nfd = "Renú";  // two codepoints: u + combining acute
        if (nfc === nfd) die("the NFC and NFD inputs are identical; this case would prove nothing");
        if (nfc.normalize("NFC") !== nfd.normalize("NFC")) die("the two inputs are not the same character");
        console.log(cmp({ v: nfc }, { v: nfd }));
        break;
      }
      case "key-boundary":
        // {"ab":"c"} and {"a":"bc"} must not share a preimage through concatenation.
        console.log(cmp({ ab: "c" }, { a: "bc" }));
        break;
      case "array-vs-string":
        console.log(cmp({ v: ["a"] }, { v: "a" }));
        break;
      case "nan":
        console.log(refuse(() => canonicalHash({ v: NaN })));
        break;
      case "infinity":
        console.log(refuse(() => canonicalHash({ v: Infinity })));
        break;
      case "neg-infinity":
        console.log(refuse(() => canonicalHash({ v: -Infinity })));
        break;
      case "bigint":
        console.log(refuse(() => canonicalHash({ v: 10n })));
        break;
      case "undefined":
        console.log(refuse(() => canonicalHash({ v: undefined })));
        break;
      case "float":
        console.log(refuse(() => canonicalHash({ v: 1.5 })));
        break;
      case "date-object":
        console.log(refuse(() => canonicalHash({ v: new Date(0) })));
        break;
      case "cycle": {
        const a = {};
        a.self = a;
        console.log(refuse(() => canonicalHash(a)));
        break;
      }
      default:
        die(`unknown canon case: ${name}`);
    }
    break;
  }

  /** parse <facts.yaml> -> `ok` or `refused:<CODE>` from the bounded YAML parser */
  case "parse": {
    const [file, libPath] = rest;
    const lib = await import(libPath ? pathToFileURL(libPath).href : new URL("../.claude/scripts/legal/lib/yaml.mjs", import.meta.url).href);
    try {
      lib.parseFactsYaml(readFileSync(file, "utf8"));
      console.log("ok");
    } catch (e) {
      console.log("refused:" + (e.code || "UNKNOWN"));
    }
    break;
  }

  /**
   * mutate <sandbox-root> <kind> -> patch the engine or the data in place, so a negative
   * control RUNS rather than being grepped for. A guard whose control is a grep has no
   * control (retro-log 2026-08-04: a mutant module walked straight past one).
   */
  case "mutate": {
    const [root, kind] = rest;
    const setsRoot = join(root, "products", "legal", "templates");
    const dataDir = join(root, "products", "legal", "data");
    const patch = (p, from, to) => {
      const s = readFileSync(p, "utf8");
      if (!s.includes(from)) die(`mutation anchor not found in ${p}: ${from.slice(0, 60)}`);
      writeFileSync(p, s.split(from).join(to), "utf8");
    };

    /**
     * Patch a template in EVERY set, not just v1.
     *
     * These mutations were written when v1 was the only set, so the template directory was
     * hardcoded to it. The moment ventures could pin different sets, a mutation aimed at v1 did
     * nothing at all to a venture on v2 -- and the tests asserting the lint went RED went GREEN,
     * because the tree they were testing had never been made bad. That is the vacuous pass with
     * an extra step, and CI caught it on exactly the two branch-mismatch tests whose fixture had
     * moved to v2.
     *
     * A mutation's intent is "make the template bad". Which set the venture under test happens to
     * pin is not the mutation's business, so it writes to every set carrying the anchor -- and
     * dies if NO set does, because a mutation that changed nothing is not a control.
     */
    const patchTemplate = (name, from, to) => {
      const sets = readdirSync(setsRoot).sort();
      if (!sets.length) die(`no template sets under ${setsRoot}`);
      let hits = 0;
      for (const set of sets) {
        const p = join(setsRoot, set, name);
        let s;
        try { s = readFileSync(p, "utf8"); } catch { continue; }
        if (!s.includes(from)) continue;
        writeFileSync(p, s.split(from).join(to), "utf8");
        hits++;
      }
      if (!hits) die(`mutation anchor not found in ${name} in ANY template set (${sets.join(", ")}): ${from.slice(0, 60)}`);
    };

    /** Overwrite a template in EVERY set, for mutations that replace rather than patch. */
    const writeTemplateAllSets = (name, text) => {
      const sets = readdirSync(setsRoot).sort();
      let hits = 0;
      for (const set of sets) {
        const p = join(setsRoot, set, name);
        try { readFileSync(p, "utf8"); } catch { continue; }
        writeFileSync(p, text, "utf8");
        hits++;
      }
      if (!hits) die(`${name} exists in no template set under ${setsRoot}`);
    };

    switch (kind) {
      case "unpinned-clause":
        // Emit a clause marker the pinned template never declared.
        patch(
          join(root, ".claude", "scripts", "legal", "lib", "template.mjs"),
          "out.push(`<!-- clause:${id} -->\\n${trimmed}\\n<!-- /clause:${id} -->\\n`);",
          "out.push(`<!-- clause:${id} -->\\n${trimmed}\\n<!-- /clause:${id} -->\\n<!-- clause:GHOST.INJECTED -->\\nghost\\n<!-- /clause:GHOST.INJECTED -->\\n`);",
        );
        break;
      case "empty-page":
        // Render the privacy page to nothing at all: every clause body blanked.
        writeTemplateAllSets("privacy.tmpl.md", "\n");
        break;
      case "denylist-bypass":
        // Blank the denylist. If the value lint still reports a claim, it is not reading this
        // file at all; if it reports nothing, the fixture proves the list is load-bearing.
        writeFileSync(join(dataDir, "claim-denylist.json"), JSON.stringify({ tokens: [], allowed_in_context: { phrases: [] } }, null, 2), "utf8");
        break;
      case "claim-in-template":
        // Put a compliance badge into authored prose, where no facts-side check can see it.
        patchTemplate("terms.tmpl.md", "## Who you are agreeing with", "## Who you are agreeing with\n\nOur service is ISO 27001 certified.");
        break;
      case "branch-leak":
        // Drop the guard from a payment clause so it renders under every branch.
        patchTemplate("refund-cancellation.tmpl.md", "{{#clause id=REFUND.WINDOW when=payment_model=gateway}}", "{{#clause id=REFUND.WINDOW}}");
        break;
      case "drop-required-clause":
        // Remove a mandatory clause from the template but leave it in the required list.
        patchTemplate("privacy.tmpl.md", "{{#clause id=PRIVACY.GRIEVANCE}}", "{{#clause id=PRIVACY.GRIEVANCE when=venture=no-such-venture}}");
        break;
      case "map-drift":
        // Guard a clause on a branch the clause-map does not list it under.
        patchTemplate("refund-cancellation.tmpl.md", "{{#clause id=REFUND.WINDOW when=payment_model=gateway}}", "{{#clause id=REFUND.WINDOW when=payment_model=mor}}");
        break;
      case "strip-window-source":
        // Take the evidence link off a grievance-window row.
        {
          const p = join(dataDir, "grievance-windows.json");
          const rows = JSON.parse(readFileSync(p, "utf8"));
          delete rows[0].source_url;
          writeFileSync(p, JSON.stringify(rows, null, 2), "utf8");
        }
        break;
      // ---- REQ-06 publish-gate mutants. Three shapes, because a grep for `publish: []` passes
      // two of them: an inline list, a block list, and the key deleted outright.
      case "publish-target-inline":
        patch(join(root, "hq.policy.yaml"), "  publish: []", '  publish: ["legal.publish"]');
        break;
      case "publish-target-block":
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  publish:\n    - legal.publish");
        break;
      case "publish-key-deleted":
        {
          const p = join(root, "hq.policy.yaml");
          const src = readFileSync(p, "utf8");
          if (!src.includes("  publish: []")) die(`mutation anchor not found in ${p}: publish: []`);
          writeFileSync(p, src.split(/\r?\n/).filter((l) => l !== "  publish: []").join("\n"), "utf8");
        }
        break;
      /**
       * publish-shape-<n> -- the five YAML spellings of a LIVE publish target that the
       * hand-rolled reader passed at exit 0. The gate caught only the indented dash, which was
       * the shape its own mutant used: the mutants had been derived from the implementation.
       * These are the attacker's, not the author's.
       */
      case "publish-shape-decoy":
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  legacy:\n    publish: []\n  publish:\n    - legal.publish");
        break;
      case "publish-shape-same-indent":
        // The most idiomatic YAML of the five.
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  publish:\n  - legal.publish");
        break;
      case "publish-shape-duplicate-key":
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  publish: []\n  publish:\n    - legal.publish");
        break;
      case "publish-shape-tab":
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  publish:\n  -\tlegal.publish");
        break;
      case "publish-shape-no-value":
        patch(join(root, "hq.policy.yaml"), "  publish: []", "  publish:");
        break;
      case "claim-anchor-missing":
        // Point a cross-page claim at a facts field nothing sets. The claim then has no value to
        // look for, and the tempting implementation skips it -- which passes every page while
        // checking none of them.
        {
          const p = join(dataDir, "cross-page-claims.json");
          const doc = JSON.parse(readFileSync(p, "utf8"));
          doc.claims[0].fact = "commitments.no_such_field";
          writeFileSync(p, JSON.stringify(doc, null, 2), "utf8");
        }
        break;
      case "cross-page-drift":
        // Put the pricing page back to the vague promise the reader panels caught: the same
        // commitment as the terms page, with the NUMBER taken out. Every per-page lint stays
        // green -- the page is well-formed, every clause traces, nothing mandatory is missing,
        // and the scenario asking "what are the plans and what do they cost" is still answered.
        // Only a cross-page check can see it, which is the whole argument for ADR-1013.
        patchTemplate("pricing.tmpl.md",
          "**If we raise the price of a plan you are on, we tell you at least {{ facts.commitments.price_notice_days }} days before your next renewal, and you may cancel at the old price until then.** The new price applies from that renewal.",
          "If we change what a plan costs, we tell you before your next payment, and the change applies from the payment after that.");
        break;
      case "orphan-scenario":
        // Rename a clause the scenario set names. This is the template edit ADR-1009 says must
        // fail: the page still renders, still traces, still carries a clause in that position --
        // and the question SCN.NOTICE.LANGUAGE asks no longer has anywhere to be answered.
        // The required-clause list is renamed WITH the template so the mandatory-clause check
        // stays satisfied. Without that, this mutant would go red on the MISSING class and prove
        // nothing about the ORPHANED one -- a control that fires for the wrong reason is not a
        // control for the thing it was written for. PRIVACY.LANGUAGE carries no `when=`, so it is
        // absent from clause-map.json by design and there is nothing to rename there.
        patchTemplate("privacy.tmpl.md", "{{#clause id=PRIVACY.LANGUAGE}}", "{{#clause id=PRIVACY.LANGUAGE_RENAMED}}");
        patch(join(dataDir, "required-clauses.json"), '"PRIVACY.LANGUAGE"', '"PRIVACY.LANGUAGE_RENAMED"');
        break;
      case "scenario-guard-typo":
        // One character off in a scenario guard. It must FAIL, not skip: a guard that cannot be
        // evaluated and is treated as "not applicable" silently excuses the row it guards, which
        // is fixed-defect-list row 11 exactly, on a second path.
        {
          const p = join(dataDir, "scenarios.json");
          const set = JSON.parse(readFileSync(p, "utf8"));
          const row = set.scenarios.find((s) => s.when === "payment_model=gateway");
          if (!row) die("no scenario guarded on payment_model=gateway to corrupt");
          row.when = "payment_modle=gateway";
          writeFileSync(p, JSON.stringify(set, null, 2), "utf8");
        }
        break;
      case "scenario-orphan-page":
        // Aim a scenario at a page the pinned set does not render. The per-page pass can never
        // see it, so only the set-level check can.
        {
          const p = join(dataDir, "scenarios.json");
          const set = JSON.parse(readFileSync(p, "utf8"));
          set.scenarios[0].page = "no-such-page";
          writeFileSync(p, JSON.stringify(set, null, 2), "utf8");
        }
        break;
      case "drop-subprocessors":
        // Take the sub-processor list OFF a venture that is not required to have one, and the
        // disclosure clause must vanish with it. This is the negative half of the
        // `derived.subprocessors` guard, and no fixture carries it: all six name at least a
        // host and a mailer, so every rendered page proved the clause could appear and none
        // proved it could be withheld. A guard only ever seen saying yes is not a guard.
        // The key is REMOVED rather than emptied on purpose -- the bounded YAML subset has no
        // flow collections, so `[]` is a parse error, and a bare `sub_processors:` would test
        // the parser's empty-value handling instead of the render branch.
        {
          const p = join(root, "tests", "fixtures", "legal", "ventures", "fixture-none-nogst", "facts.yaml");
          const src = readFileSync(p, "utf8");
          const lines = src.split(/\r?\n/);
          const at = lines.findIndex((l) => l.startsWith("sub_processors:"));
          if (at < 0) die(`mutation anchor not found in ${p}: sub_processors:`);
          let end = at + 1;
          while (end < lines.length && /^\s+-\s/.test(lines[end])) end++;
          if (end === at + 1) die(`sub_processors in ${p} has no list items to remove`);
          lines.splice(at, end - at);
          writeFileSync(p, lines.join("\n"), "utf8");
        }
        break;
      default:
        die(`unknown mutation: ${kind}`);
    }
    console.log("mutated:" + kind);
    break;
  }

  /** write <path> -- read stdin? no. `write <path> <text>` keeps quoting in ONE place. */
  case "write": {
    const [file, ...text] = rest;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text.join(" ") + "\n", "utf8");
    console.log("wrote:" + file);
    break;
  }

  /**
   * decision <approval.json> <out.json> [verdict] [recorded_at] [--facts SHA] [--set SHA]
   *
   * Mint a decision receipt bound to an approval payload. This is the offline FAKE for the spine
   * (CLAUDE.md: every external dependency gets an interface, a fake and a real impl) -- the real
   * receipt is written by `arc-inbox approve` on the canonical clone, which no test can reach:
   * the spine is gitignored, so a worktree has its own and CI has none at all.
   *
   * It takes overrides on purpose. A fake that can only produce VALID receipts cannot test a
   * gate whose entire job is refusing invalid ones.
   */
  case "decision": {
    const [approvalFile, outFile, verdict = "approve", recordedAt = "2026-08-13T00:00:00Z", ...flags] = rest;
    const approval = JSON.parse(readFileSync(approvalFile, "utf8"));
    const at = (name, fallback) => {
      const i = flags.indexOf(name);
      return i >= 0 && flags[i + 1] !== undefined ? flags[i + 1] : fallback;
    };
    const receipt = {
      kind: "decision.recorded",
      id: "01TESTDECISION0000000000000",
      decides: "01TESTREQUEST00000000000000",
      subject: approval.subject,
      verdict,
      recorded_at: recordedAt,
      facts_sha256: at("--facts", approval.facts_sha256),
      template_set_sha: at("--set", approval.template_set_sha),
    };
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, JSON.stringify(receipt, null, 2) + "\n", "utf8");
    console.log("decision:" + receipt.verdict);
    break;
  }

  /**
   * tamper-page <dir> <page> -- change a rendered page's bytes AFTER it was approved.
   *
   * This is the case a hash chain exists for and the one a re-render cannot catch: the approval
   * and the fresh render agree perfectly, and the file that would actually be published is a
   * different file. Hashing the run record's copy of the text instead of the bytes on disk
   * passes this.
   */
  /**
   * mutate-facts <sandbox> <venture> <key> <value> -- change one top-level scalar in a venture's
   * facts file. The TOCTOU lever: it is what someone editing their own facts after approval
   * actually does, and the resulting tree is entirely VALID -- which is why only the chain, and
   * never a lint, can catch it.
   */
  case "mutate-facts": {
    const [sandbox, venture, key, value] = rest;
    const p = join(sandbox, "tests", "fixtures", "legal", "ventures", venture, "facts.yaml");
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    const at = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (at < 0) die(`no top-level key "${key}" in ${p}`);
    const before = lines[at];
    lines[at] = `${key}: ${value}`;
    if (before === lines[at]) die(`"${key}" is already ${value}; a mutation that changes nothing is not a control`);
    writeFileSync(p, lines.join("\n"), "utf8");
    console.log(`mutated:${key}`);
    break;
  }

  /**
   * stale-published <dir> -- relabel a published record as written under an OLDER preimage
   * version, and break its facts hash.
   *
   * This is the format-upgrade case, and it is also the attack: a tamperer who can edit the
   * record can also relabel it. `verify` must therefore classify by whether THIS BUILD can
   * re-derive the claimed algorithm, never by believing the label -- and page bytes, which the
   * preimage version does not govern, must still come back TAMPERED.
   */
  /** json-del <file> <key> -- remove a top-level key. The falsy-skip lever. */
  case "json-del": {
    const [file, key] = rest;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    if (!(key in doc)) die(`${file} has no key "${key}" to delete; a mutation that changes nothing is not a control`);
    delete doc[key];
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("deleted:" + key);
    break;
  }

  /** json-set <file> <key> <value> -- forge a top-level value. */
  case "json-set": {
    const [file, key, value] = rest;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    if (doc[key] === value) die(`${file}.${key} is already "${value}"; that is not a mutation`);
    doc[key] = value;
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("set:" + key);
    break;
  }

  /**
   * stray-page <dir> <name> -- drop an unapproved page into the publish directory.
   *
   * It carries a false certification claim and a refund denial on purpose: this is what an
   * unapproved file actually costs, and the gate reported success on it.
   */
  case "stray-page": {
    const [dir, name] = rest;
    writeFileSync(join(dir, `${name}.mdx`), "# Terms\n\nWe are ISO 27001 certified and refunds are never given.\n", "utf8");
    console.log("stray:" + name);
    break;
  }

  /** data-edit <sandbox> <file> <from> <to> -- edit a pinned DATA file, not a template. */
  case "data-edit": {
    const [sandbox, file, from, to] = rest;
    const p = join(sandbox, "products", "legal", "data", file);
    const src = readFileSync(p, "utf8");
    if (!src.includes(from)) die(`anchor not found in ${p}: ${from}`);
    writeFileSync(p, src.split(from).join(to), "utf8");
    console.log("edited:" + file);
    break;
  }

  /**
   * pin <sandbox> <venture> <value|--delete> -- rewrite or remove a venture's template pin.
   *
   * `--delete` is the one that matters: a venture with no pin must be REFUSED, never defaulted
   * to the newest set. A default there would float a venture onto a set nobody chose for it, and
   * would look identical to a deliberate upgrade.
   */
  case "pin": {
    const [sandbox, venture, value] = rest;
    const p = join(sandbox, "tests", "fixtures", "legal", "ventures", venture, "pins.yaml");
    if (value === "--delete") {
      rmSync(p);
      console.log("deleted:pins.yaml");
      break;
    }
    const src = readFileSync(p, "utf8");
    const at = src.split(/\r?\n/).findIndex((l) => l.startsWith("template_set:"));
    if (at < 0) die(`no template_set line in ${p}`);
    const lines = src.split(/\r?\n/);
    if (lines[at] === `template_set: ${value}`) die(`${venture} is already pinned to ${value}; that is not a mutation`);
    lines[at] = `template_set: ${value}`;
    writeFileSync(p, lines.join("\n"), "utf8");
    console.log("pinned:" + value);
    break;
  }

  /**
   * json-set-line <file> <prefix> <replacement> -- replace the one line starting with a prefix.
   *
   * For text files rather than JSON, despite the name's family: the CI guard is a shell script
   * and its version marker is a comment line. Refuses when the prefix matches zero lines or more
   * than one -- a mutation that hit nothing, or hit several things, is not a control.
   */
  case "json-set-line": {
    const [file, prefix, replacement] = rest;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const hits = lines.filter((l) => l.startsWith(prefix)).length;
    if (hits !== 1) die(`prefix "${prefix}" matches ${hits} line(s) in ${file}; a mutation must hit exactly one`);
    writeFileSync(file, lines.map((l) => (l.startsWith(prefix) ? replacement : l)).join("\n"), "utf8");
    console.log("replaced:" + prefix);
    break;
  }

  /**
   * drop-set-approval <approved-sets.json> <set> -- remove ONE set's approval, leaving the record
   * otherwise intact.
   *
   * The state SET_NOT_APPROVED describes, which nothing could previously create: the existing
   * test deleted the whole `sets` map and therefore exercised SET_RECORD_UNREADABLE instead. An
   * attacker's one-line mutant passed every approved-set test and published an unapproved set.
   */
  case "drop-set-approval": {
    const [file, set] = rest;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    if (!doc.sets || typeof doc.sets !== "object") die(`${file} has no sets map`);
    if (!(set in doc.sets)) die(`${file} has no approval for "${set}" to drop`);
    delete doc.sets[set];
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("dropped:" + set);
    break;
  }

  /** repoint-page <published.json> <page> <newId> -- make the record name a different path. */
  case "repoint-page": {
    const [file, page, newId] = rest;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    const row = (doc.pages || []).find((p) => p.page === page);
    if (!row) die(`${file} has no page "${page}"`);
    row.page = newId;
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("repointed:" + newId);
    break;
  }

  /**
   * relabel-preimage <dir> <label> -- change ONLY the declared preimage version.
   *
   * Deliberately separate from `stale-published`, which relabels AND zeroes the facts hash in one
   * step. That combination meant the "a stale format is UNVERIFIABLE" test's fixture WAS the
   * attack, and the suite asserted its outcome was correct -- there was no case where the format
   * moved and the bytes did not. These two conditions have to be producible apart to be told
   * apart.
   */
  case "relabel-preimage": {
    const [dir, label] = rest;
    const p = join(dir, "_published.json");
    const doc = JSON.parse(readFileSync(p, "utf8"));
    if (!doc.run) die(`${p} has no run block to relabel`);
    if (doc.run.preimage_version === label) die(`already labelled "${label}"; that is not a mutation`);
    doc.run.preimage_version = label;
    writeFileSync(p, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("relabelled:" + label);
    break;
  }

  /** crlf-pages <dir> -- rewrite every .mdx with CRLF, as a Windows checkout would. */
  case "crlf-pages": {
    const [dir] = rest;
    let n = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".mdx")) continue;
      const p = join(dir, f);
      const src = readFileSync(p, "utf8");
      if (!src.includes("\n")) continue;
      writeFileSync(p, src.split("\r\n").join("\n").split("\n").join("\r\n"), "utf8");
      n++;
    }
    if (!n) die(`no .mdx files under ${dir} to convert; a mutation that changed nothing is not a control`);
    console.log("crlf:" + n);
    break;
  }

  case "stale-published": {
    const [dir] = rest;
    const p = join(dir, "_published.json");
    const doc = JSON.parse(readFileSync(p, "utf8"));
    if (!doc.run) die(`${p} has no run block to relabel`);
    doc.run.preimage_version = "arc-legal-canon/0";
    doc.facts_sha256 = "0".repeat(64);
    writeFileSync(p, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("staled:arc-legal-canon/0");
    break;
  }

  case "tamper-page": {
    const [dir, page] = rest;
    const file = join(dir, `${page}.mdx`);
    const src = readFileSync(file, "utf8");
    writeFileSync(file, src + "\n<!-- inserted after approval -->\n", "utf8");
    console.log("tampered:" + file);
    break;
  }

  /** approval-unknown-key <approval.json> -- add a key the closed profile does not allow. */
  case "approval-unknown-key": {
    const [file] = rest;
    const doc = JSON.parse(readFileSync(file, "utf8"));
    doc.force = true;
    writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log("added:force");
    break;
  }

  /** groups -> the lint groups the engine declares, space separated, sorted */
  case "groups": {
    const { GROUPS } = await import(pathToFileURL(join(ARC_ROOT, ".claude", "scripts", "legal", "lib", "lints.mjs")).href);
    if (!Array.isArray(GROUPS) || !GROUPS.length) die("lints.mjs declares no GROUPS");
    console.log([...GROUPS].sort().join(" "));
    break;
  }

  /**
   * groups-reported <run.json> -> exit 0 iff every DECLARED group is one the run reports on.
   *
   * A group can otherwise be added to GROUPS, never wired into runAllLints, and report zero
   * findings forever -- indistinguishable from a group that ran and found nothing. Comparing the
   * declaration against `trial_groups` in the sidecar is two derived lists, never a literal.
   */
  case "groups-reported": {
    const [file] = rest;
    const run = JSON.parse(readFileSync(file, "utf8"));
    const { GROUPS } = await import(pathToFileURL(join(ARC_ROOT, ".claude", "scripts", "legal", "lib", "lints.mjs")).href);
    const reported = new Set(run.groups_run || []);
    const missing = GROUPS.filter((g) => !reported.has(g));
    if (missing.length) die(`declared but not reported in trial_groups: ${missing.join(", ")}`);
    console.log(`${GROUPS.length} group(s) declared and reported`);
    break;
  }

  /** scenario-count <scenarios.json> -> how many rows the answerability fixture declares */
  case "scenario-count": {
    const [file] = rest;
    const set = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(set.scenarios)) die(`${file} has no scenarios array`);
    console.log(String(set.scenarios.length));
    break;
  }

  /** scenario-pages <scenarios.json> -> the distinct page ids the set aims at, sorted */
  case "scenario-pages": {
    const [file] = rest;
    const set = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(set.scenarios) || !set.scenarios.length) die(`${file} has no scenarios`);
    const pages = [...new Set(set.scenarios.map((s) => s.page))].sort();
    if (pages.some((p) => typeof p !== "string" || !p)) die(`${file} has a scenario with no page`);
    console.log(pages.join(" "));
    break;
  }

  /** count-tests <bats-file> -> how many `@test` lines the FILE declares */
  case "count-tests": {
    const [file] = rest;
    const src = readFileSync(file, "utf8");
    const n = src.split(/\r?\n/).filter((l) => l.startsWith("@test ")).length;
    if (n === 0) die(`${file} declares no tests; an empty suite is indistinguishable from a passing one`);
    console.log(String(n));
    break;
  }

  /** ls-pages <dir> -> the .mdx files rendered into a directory, sorted */
  case "ls-pages": {
    const [dir] = rest;
    let names;
    try { names = readdirSync(dir); } catch (e) { die(`cannot list ${dir}: ${e.message}`); }
    const pages = names.filter((f) => f.endsWith(".mdx")).sort();
    for (const p of pages) {
      if (statSync(join(dir, p)).size === 0) die(`${p} is empty`);
    }
    console.log(pages.join(" "));
    break;
  }

  default:
    die(`unknown command: ${cmd || "(none)"}`);
}
