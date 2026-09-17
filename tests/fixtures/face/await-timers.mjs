// A process with nothing else alive that awaits proc.mjs's timers at top level, so
// tests/face/cdp-client.mjs can prove two things in a child it can observe from outside:
//   - an awaited delay / waitExit timeout holds the process until it resumes (an unref()ed
//     timer lets node exit with code 13 before "resumed" is ever written);
//   - settleWithin clears its timer once the race settles (an uncleared 60 s timer keeps the
//     process alive long past the caller's timeout).
import { pathToFileURL } from "node:url";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const proc = await import(pathToFileURL(join(REPO, "face", "scripts", "proc.mjs")).href);

await proc.delay(50);
const exited = await proc.waitExit({ exitCode: null, signalCode: null, once() {}, off() {} }, 50);
process.stdout.write(`resumed exited=${exited}\n`);
const won = await proc.settleWithin(Promise.resolve("first"), 60000, "timer");
process.stdout.write(`settled=${won}\n`);
