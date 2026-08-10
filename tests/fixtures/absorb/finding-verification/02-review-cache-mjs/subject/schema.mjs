// Shape, defaults and key validation for the on-disk review cache.

export const DEFAULTS = {
  // Time-to-live for one cached verdict, in seconds.
  ttlSeconds: 300,
  maxEntries: 200,
};

const SAFE_KEY = /^[a-z0-9][a-z0-9._-]*$/;

export function assertSafeKey(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('cache key must be a non-empty string');
  }
  if (!SAFE_KEY.test(key)) {
    throw new TypeError(`unsafe cache key: ${key}`);
  }
}
