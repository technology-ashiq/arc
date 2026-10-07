// spine-probe.mjs -- small read-only probes the bats suite would otherwise embed in shell strings (attack r1 B6: a
// program inside a shell string is one apostrophe away from the shell running the rest of it).
//
//   node spine-probe.mjs refusals <events-dir>                 -> "REFUSALS <n> <first-id|-> INCIDENTS-WITH-DENIALS <m>"
//   node spine-probe.mjs cell <report.json> <subject> <cap>     -> "<last_refusal|null> <state> <cells-ok:true|false>"
//   node spine-probe.mjs kinds <validate.mjs>                   -> "KINDS <n> <kinds-naming-a-refusal> <has-note.logged>"
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "refusals") {
  const lines = readdirSync(a).filter((f) => f.endsWith(".jsonl")).sort()
    .flatMap((f) => readFileSync(join(a, f), "utf8").split("\n")).filter((l) => l.trim());
  const evs = lines.map((l) => JSON.parse(l));
  const refusals = evs.filter((e) => e.kind === "note.logged" && e.payload && e.payload.subject === "policy.refusal");
  const incidents = evs.filter((e) => e.kind === "incident.raised" && e.payload && Array.isArray(e.payload.denials) && e.payload.denials.length > 0);
  console.log(`REFUSALS ${refusals.length} ${refusals[0] ? refusals[0].id : "-"} INCIDENTS-WITH-DENIALS ${incidents.length}`);
} else if (cmd === "cell") {
  const r = JSON.parse(readFileSync(a, "utf8"));
  const x = r.cells.find((y) => y.subject === b && y.capability === c);
  console.log(`${x ? x.last_refusal : "missing"} ${x ? x.state : "missing"} ${r.subjects > 0 && r.cells.length === r.subjects * 8}`);
} else if (cmd === "kinds") {
  const { KINDS } = await import(pathToFileURL(resolve(a)).href);
  console.log(`KINDS ${KINDS.length} ${KINDS.filter((k) => /refus/.test(k)).length} ${KINDS.includes("note.logged")}`);
} else {
  console.error(`spine-probe: unknown command ${cmd}`);
  process.exit(2);
}
