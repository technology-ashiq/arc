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
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

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
    const lib = await import(libPath || new URL("../.claude/scripts/legal/lib/canonical.mjs", import.meta.url).href);
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
    const lib = await import(libPath || new URL("../.claude/scripts/legal/lib/yaml.mjs", import.meta.url).href);
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
    const tmplDir = join(root, "products", "legal", "templates", "v1");
    const dataDir = join(root, "products", "legal", "data");
    const patch = (p, from, to) => {
      const s = readFileSync(p, "utf8");
      if (!s.includes(from)) die(`mutation anchor not found in ${p}: ${from.slice(0, 60)}`);
      writeFileSync(p, s.split(from).join(to), "utf8");
    };

    switch (kind) {
      case "unpinned-clause":
        // Emit a clause marker the pinned template never declared.
        patch(
          join(root, ".claude", "scripts", "legal", "lib", "template.mjs"),
          "out.push(`<!-- clause:${id} -->\\n${bodyText.trim()}\\n<!-- /clause:${id} -->\\n`);",
          "out.push(`<!-- clause:${id} -->\\n${bodyText.trim()}\\n<!-- /clause:${id} -->\\n<!-- clause:GHOST.INJECTED -->\\nghost\\n<!-- /clause:GHOST.INJECTED -->\\n`);",
        );
        break;
      case "empty-page":
        // Render the privacy page to nothing at all: every clause body blanked.
        writeFileSync(join(tmplDir, "privacy.tmpl.md"), "\n", "utf8");
        break;
      case "denylist-bypass":
        // Blank the denylist. If the value lint still reports a claim, it is not reading this
        // file at all; if it reports nothing, the fixture proves the list is load-bearing.
        writeFileSync(join(dataDir, "claim-denylist.json"), JSON.stringify({ tokens: [], allowed_in_context: { phrases: [] } }, null, 2), "utf8");
        break;
      case "claim-in-template":
        // Put a compliance badge into authored prose, where no facts-side check can see it.
        patch(join(tmplDir, "terms.tmpl.md"), "## Who you are agreeing with", "## Who you are agreeing with\n\nOur service is ISO 27001 certified.");
        break;
      case "branch-leak":
        // Drop the guard from a payment clause so it renders under every branch.
        patch(join(tmplDir, "refund-cancellation.tmpl.md"), "{{#clause id=REFUND.WINDOW when=payment_model=gateway}}", "{{#clause id=REFUND.WINDOW}}");
        break;
      case "drop-required-clause":
        // Remove a mandatory clause from the template but leave it in the required list.
        patch(join(tmplDir, "privacy.tmpl.md"), "{{#clause id=PRIVACY.GRIEVANCE}}", "{{#clause id=PRIVACY.GRIEVANCE when=venture=no-such-venture}}");
        break;
      case "map-drift":
        // Guard a clause on a branch the clause-map does not list it under.
        patch(join(tmplDir, "refund-cancellation.tmpl.md"), "{{#clause id=REFUND.WINDOW when=payment_model=gateway}}", "{{#clause id=REFUND.WINDOW when=payment_model=mor}}");
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
