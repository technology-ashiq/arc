#!/usr/bin/env node
// A lock holder that stays inside its critical section, so a fixture can ask the one question
// that matters: can a waiter delete the lock of a process that is alive and still working?
//
// It exists because that is not reachable through the emitter -- a real append takes single-
// digit milliseconds, so the window cannot be opened from outside. The holder prints its own
// verdict; the fixture asserts on that line rather than on timing.
//
// usage: slow-holder.mjs <holdMs>   (ARC_SPINE_ROOT points at the spine)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eventsDir, spineRoot, withLock } from "../../../.claude/scripts/hq/lib/spine-io.mjs";

const holdMs = Number(process.argv[2]);
const root = spineRoot();
const lock = join(eventsDir(root), ".lock");

withLock(root, () => {
  const mine = readFileSync(lock, "utf8").trim();
  // Node has no sleep; Atomics.wait on a throwaway buffer is the portable synchronous one --
  // and it must be synchronous, or this stops being one uninterrupted critical section.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
  let now = "<deleted>";
  try { now = readFileSync(lock, "utf8").trim(); } catch { /* a breaker removed it */ }
  process.stdout.write(now === mine ? "HOLDER_KEPT_LOCK\n" : "HOLDER_LOST_LOCK\n");
});
