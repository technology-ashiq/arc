#!/usr/bin/env node
/**
 * The scheduler's entry for the dispatcher (org Phase 03, ADR-1605 / ADR-1623).
 *
 * hq.jobs.yaml entries carry no arguments, and `org-dispatch` with none must never emit -- a human
 * running it bare gets a usage error, not proposals on the spine. So the ONE place that emits on a
 * schedule is this wrapper: every governed team, today, written to the spine. It adds nothing else.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, "..", "org-dispatch.mjs"), "--all", "--emit"], { stdio: "inherit", timeout: 110_000 });
process.exitCode = r.error ? 2 : (r.status ?? 2);
