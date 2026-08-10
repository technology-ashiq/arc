import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULTS, assertSafeKey } from './schema.mjs';

const CACHE_DIR = join(process.cwd(), '.cache', 'reviews');

function entryPath(key) {
  assertSafeKey(key);
  return join(CACHE_DIR, `${key}.json`);
}

// Returns the cached value, or null when there is no usable entry.
export async function readCache(key) {
  let raw;
  try {
    raw = await readFile(entryPath(key), 'utf8');
  } catch {
    return null;
  }
  const entry = JSON.parse(raw);
  if (Date.now() > entry.expiresAt) {
    return null;
  }
  return entry.value;
}

export async function writeCache(key, value, ttlSeconds = DEFAULTS.ttlSeconds) {
  await mkdir(CACHE_DIR, { recursive: true });
  const entry = {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value,
  };
  writeFile(entryPath(key), JSON.stringify(entry), 'utf8');
}
