// loader-probe.mjs -- counts what a policy-evidence loader accepts from a root's spine (POL-L, the M-sha fixture).
//
//   node loader-probe.mjs <load.mjs> <root>
//
// Prints `LOADED <n> REJECTED <m>`. The caller has tampered a sealed line in place, so the real loader must load 0
// and reject 1; a loader without the sha recompute loads the tampered line.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [loadPath, root] = process.argv.slice(2);
const L = await import(pathToFileURL(resolve(loadPath)).href);
const { events, rejected } = L.loadSpineEvents(resolve(root));
process.stdout.write(`LOADED ${events.length} REJECTED ${rejected}\n`);
