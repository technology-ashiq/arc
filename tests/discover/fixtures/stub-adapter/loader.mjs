// Test-only ESM loader: swaps growth's adapters.mjs for ./adapters.mjs, so a bats arm can drive
// an adapter that returns success without fetching. The real module is never edited (ADR-1901).
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("growth/lib/adapters.mjs")) {
    return { url: new URL("./adapters.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
