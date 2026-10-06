// Test-only ESM loader: the discover miner's import of growth's adapters.mjs gets ./adapters.mjs,
// an adapter that returns success without fetching. Only the miner's import is swapped -- growth's
// own modules still need the real file's other exports. The real module is never edited (ADR-1901).
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("growth/lib/adapters.mjs") && String(context.parentURL || "").endsWith("/discover/miners/hn.mjs")) {
    return { url: new URL("./adapters.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
