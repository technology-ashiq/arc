#!/usr/bin/env node
// Resolve the review verdict for one changed file, using the on-disk cache.

import { readCache, writeCache } from './cache.mjs';

async function computeVerdict(path) {
  // Expensive in the real system: this is where the scanners run.
  if (path.endsWith('.md')) {
    return null; // nothing reviewable in a markdown file
  }
  return { path, findings: [] };
}

export async function verdictFor(path) {
  const key = path.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const cached = await readCache(key);
  if (cached !== null) {
    return cached;
  }
  const verdict = await computeVerdict(path);
  await writeCache(key, verdict);
  return verdict;
}

const target = process.argv[2];
if (!target) {
  console.error('usage: index.mjs <path>');
  process.exit(2);
}

verdictFor(target).then((verdict) => {
  console.log(JSON.stringify(verdict));
  process.exit(0);
});
