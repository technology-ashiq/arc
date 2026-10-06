// Stand-in for growth's adapters.mjs: an HN adapter that returns success and never fetches.
// The miner must read that as COULD_NOT_SCAN, never as a quiet market (REQ-01).
export function hnAlgoliaAdapter() {
  return async () => [];
}
