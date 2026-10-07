#!/usr/bin/env node
// design-rival-stitch.mjs -- the ONE place a real Stitch call happens (Cycle 16 Phase 07 S2, ADR-1409).
//
// Run only as a child of design-rival.mjs, never by hand: the parent builds the request, installs the
// pinned SDK into a private directory, and starts this file with an allow-listed environment whose only
// secret is STITCH_API_KEY. The SDK reads its key from that variable, so the key is never in argv.
//
//   node design-rival-stitch.mjs <sdk-entry-path>     request JSON on stdin, one JSON line on stdout
//
// stdout is {ok:true, screen, htmlUrl} or {ok:false, error:{name, code, message}}. The parent classifies
// the error and scrubs the key; this file only reports what the SDK did.
import { pathToFileURL } from "node:url";

const entry = process.argv[2];
const say = (v) => process.stdout.write(JSON.stringify(v) + "\n");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", async () => {
  let req;
  try { req = JSON.parse(input); } catch { return say({ ok: false, error: { name: "BadRequest", code: "BAD_REQUEST", message: "the request on stdin is not JSON" } }); }
  try {
    const { stitch } = await import(pathToFileURL(entry).href);
    const project = await stitch.createProject(req.title);
    const screen = await project.generate(req.prompt, req.deviceType);
    const htmlUrl = await screen.getHtml();
    say({ ok: true, screen: screen.data ?? null, htmlUrl });
  } catch (e) {
    say({ ok: false, error: { name: String(e?.name ?? "Error"), code: e?.code ?? e?.status ?? null, message: String(e?.message ?? e).slice(0, 2000) } });
  }
});
