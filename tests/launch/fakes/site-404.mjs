// Preload (`node --import`) for a worker run in a contract arm: the venture's domain answers every path 404, and any
// other host is unreachable. The worker's ctx.fetch wraps this global, so its host guard still runs first.
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.hostname !== "sandbox.automemory.ai") throw new TypeError("fetch failed");
  return new Response("<h1>404</h1>", { status: 404, headers: { "content-type": "text/html" } });
};
