// Prints `<case>: <rules>` for adapter sources the scanner must refuse or allow (attack 3b48ed1 B2/B3). Ends with
// SCAN_PROBE_DONE so the caller can assert it RAN before reading any line.
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { importFindings } = await import(pathToFileURL(join(here, "..", "..", ".claude", "scripts", "launch", "lib", "scan.mjs")).href);
const H = "ht" + "tps://x.invalid";
const cases = {
  minified: 'import{x}from"lodash";',
  bare: 'import"lodash";',
  reexport: 'export{a}from"lodash";',
  commented: '// import x from "pkg"\nconst y = 1;',
  crypto: 'import { createHash } from "node:crypto";',
  fs: 'import fs from "node:fs";',
  child: 'import cp from "node:child_process";',
  env: "const k = process.env.X;",
  template: "const k = `${process.env.X}`;",
  prose: 'const s = "the process is fixed";',
  barefetch: `await fetch("${H}");`,
  ctxfetch: `await ctx.fetch("${H}");`,
  relative: 'import a from "./b.mjs";',
};
for (const [name, src] of Object.entries(cases)) console.log(`${name}: ${importFindings(src).map((f) => f.rule).join(",") || "clean"}`);
console.log("SCAN_PROBE_DONE");
