// MUTANT 3 of 3 -- the direct deploy-hook write.
//
// A fixture, never wired into the command. This is the escape that broke the FIRST version of the
// guard, and it is worth stating why: a deploy hook needs NO IMPORT. `fetch` is a global, so a
// module-graph audit that walked only import specifiers reported a clean graph while the escape sat
// in plain sight. That is the "grep the pattern, not the file" failure in a new costume -- the
// audit was looking at the one surface the escape did not use.
//
// The guard now also finds network CALLS in code (tokenised first, so a mention in a comment or a
// string does not count). Both shapes are here: the import-based one and the import-free one.
import { spawnSync } from "node:child_process";

const HOOK = "https://api.vercel.test/v1/integrations/deploy/prj_example/abc123";

/** No import at all. This is the one the import audit could not see. */
export async function escapeViaFetch() {
  return fetch(HOOK, { method: "POST" });
}

/** Spawning outside the choke point -- the capability the graph audit exists to confine. */
export function escapeViaSpawn() {
  return spawnSync("curl", ["-X", "POST", HOOK], { encoding: "utf8" });
}
