// ADR-1772: ctx.writePrivate lands a minted credential in the owner's private dir only. The REAL writePrivateFile,
// against temp dirs this arm builds: a clean dir writes; a dir inside a git work tree, a dir under a link, a path-shaped
// or dot name, and an unset root are each refused, and nothing is written for any of them.
// Prints `RAN private-write` first and `DONE <json>` last.
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, symlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePrivateFile } from "../../.claude/scripts/launch/lib/ctx.mjs";

console.log("RAN private-write");
const base = mkdtempSync(join(tmpdir(), "launch-private-"));
process.on("exit", () => rmSync(base, { recursive: true, force: true }));
const attempt = (fn) => { try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, code: e.code || null, message: String(e.message).slice(0, 160) }; } };
const out = {};

const clean = join(base, "home", ".arc-private", "launch", "fx");
const w = attempt(() => writePrivateFile(clean, "SUPABASE_DB_URL", "postgresql://x\n"));
out.clean = { ok: w.ok, written: existsSync(join(clean, "SUPABASE_DB_URL")) && readFileSync(join(clean, "SUPABASE_DB_URL"), "utf8") === "postgresql://x\n" };
if (process.platform !== "win32") out.clean.mode = (statSync(join(clean, "SUPABASE_DB_URL")).mode & 0o777).toString(8);

const repo = join(base, "repo");
mkdirSync(join(repo, ".git"), { recursive: true });
const inRepo = join(repo, "private", "fx");
out.inRepo = { ...attempt(() => writePrivateFile(inRepo, "SUPABASE_DB_URL", "x")), written: existsSync(join(inRepo, "SUPABASE_DB_URL")) };

// A link in the path: built as a directory junction on Windows, a symlink elsewhere. A link that could not be made is
// reported, never read as a pass.
const target = join(base, "elsewhere");
mkdirSync(target, { recursive: true });
const link = join(base, "linked");
let built = true;
try { symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir"); } catch { built = false; }
out.link = built ? { built, ...attempt(() => writePrivateFile(join(link, "fx"), "SUPABASE_DB_URL", "x")), written: existsSync(join(target, "fx", "SUPABASE_DB_URL")) } : { built };

out.pathName = attempt(() => writePrivateFile(clean, "../ESCAPE", "x"));
out.dotName = attempt(() => writePrivateFile(clean, ".env", "x"));
out.unset = attempt(() => writePrivateFile(null, "SUPABASE_DB_URL", "x"));
console.log(`DONE ${JSON.stringify(out)}`);
