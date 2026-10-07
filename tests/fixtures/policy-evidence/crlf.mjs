// crlf.mjs -- rewrite a file's line endings to CRLF, or report whether it has any CR. Git Bash's grep does not see a
// CR the way a shell test expects, so the CRLF fixture is built and checked here instead.
//
//   node crlf.mjs write <file>    LF -> CRLF, in place
//   node crlf.mjs check <file>    prints "CR <count>"
import { readFileSync, writeFileSync } from "node:fs";

const [cmd, file] = process.argv.slice(2);
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
const text = readFileSync(file, "utf8");
if (cmd === "write") writeFileSync(file, text.split(CR + LF).join(LF).split(LF).join(CR + LF), "utf8");
else if (cmd === "check") console.log(`CR ${text.split(CR).length - 1}`);
else { console.error(`crlf: unknown command ${cmd}`); process.exit(2); }
