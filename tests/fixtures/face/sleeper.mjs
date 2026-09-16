// A child that ignores SIGTERM and never exits on its own, so tests/face/cdp-client.mjs can
// prove proc.mjs's stopTree escalates instead of waiting forever (face v2 Phase 00).
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
process.stdout.write("sleeping\n");
