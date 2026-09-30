#!/usr/bin/env node
// tests/org/probe.mjs -- drive org's card grammar and emitter from bats without a node -e program
// (a program embedded in a shell string is where this repo's quoting defects live).
//
//   probe.mjs validate ROOT CARD.yaml   -> "VALID staffed=<bool>" or one "FINDING ..." per finding
//   probe.mjs roundtrip                 -> "ROUNDTRIP OK" when parse(emit(x)) == x for a card-shaped x
//   probe.mjs emit-colon                -> "REFUSED ..." when the emitter refuses a ": " list item
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { collect } from "../../.claude/scripts/org/org-coverage.mjs";
import { validateCard, isStaffed } from "../../.claude/scripts/org/lib/card.mjs";
import { emitYaml } from "../../.claude/scripts/org/lib/emit.mjs";
import { parseYamlSubset } from "../../.claude/scripts/engine/yaml-subset.mjs";

const [mode, a, b] = process.argv.slice(2);

if (mode === "validate") {
  const w = await collect(a);
  const r = parseYamlSubset(readFileSync(b, "utf8"));
  if (!r.ok) { console.log(`PARSE-ERROR ${r.error.message}`); process.exitCode = 1; }
  const stem = basename(b).replace(/\.role\.yaml$/, "");
  const f = !r.ok ? [] : validateCard(r.value, { tiers: w.tiers, ungrantable: w.ungrantable, drivers: w.drivers, kinds: w.kinds, stem, dept: r.value.dept });
  if (f.length) { for (const x of f) console.log(`FINDING ${x}`); process.exitCode = 1; }
  else if (r.ok) console.log(`VALID staffed=${isStaffed(r.value)}`);
} else if (mode === "roundtrip") {
  const x = { id: "p", mission: "it's 'quoted', and no", flag: true, none: null, empty: {}, list: [],
    binds: { agents: ["a"], tier: "cheap-scan" }, kpi: [{ name: "runs", over: "run.completed" }], e2: ["publishing under Ashiq's name"] };
  const r = parseYamlSubset(emitYaml(x, ["header"]));
  console.log(r.ok && JSON.stringify(r.value) === JSON.stringify(x) ? "ROUNDTRIP OK" : `ROUNDTRIP DIFF ${JSON.stringify(r.value)}`);
} else if (mode === "emit-colon") {
  try { emitYaml({ history: ["a: b"] }); console.log("WROTE"); }
  catch (e) { console.log(`REFUSED ${e.message}`); }
} else { console.error(`probe: unknown mode ${mode}`); process.exitCode = 2; }
