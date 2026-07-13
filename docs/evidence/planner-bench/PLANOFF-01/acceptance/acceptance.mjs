#!/usr/bin/env node
/**
 * PLANOFF-01 — shared black-box acceptance suite.
 *
 * Grades EVERY arm's build identically. It knows nothing about any arm's internals: it speaks only
 * the HTTP contract frozen in ../goal.md. No dependencies — Node >= 20 (built-in fetch) only.
 *
 * The arm must never see this file. Run it only after the arm's evidence is captured.
 *
 *   BASE_URL=http://localhost:3000 node acceptance.mjs
 *   → human table on stdout, machine summary at ../runs/<arm>/acceptance.json when OUT is set:
 *   BASE_URL=... OUT=../runs/arc/acceptance.json node acceptance.mjs
 *
 * Exit code: 0 if every check passed, 1 otherwise. A non-booting app is a legitimate 0%.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT = process.env.OUT ?? '';
const LONG_URL = 'https://example.com/a-very-long-destination?utm=planoff';

/* ── tiny harness ─────────────────────────────────────────────────────────── */

const checks = [];
const results = [];

/** @param {string} id @param {string} covers @param {string} title @param {() => Promise<void>} fn */
const check = (id, covers, title, fn) => checks.push({ id, covers, title, fn });

class Failed extends Error {}
const fail = (msg) => {
  throw new Failed(msg);
};
const eq = (actual, expected, what) => {
  if (actual !== expected) fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const oneOf = (actual, allowed, what) => {
  if (!allowed.includes(actual)) fail(`${what}: expected one of ${allowed.join('/')}, got ${actual}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── HTTP helpers ─────────────────────────────────────────────────────────── */

const api = (path, { user, method = 'GET', body } = {}) =>
  fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(user ? { 'X-Test-User': user } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const visit = (code) => fetch(`${BASE}/${code}`, { redirect: 'manual' });

/** Wipes links + rate-limit state. Every check starts from zero — checks must be self-contained,
 *  otherwise earlier creates would eat the 10/min budget and poison the rate-limit check. */
const reset = async () => {
  const r = await api('/api/test/reset', { method: 'POST' });
  if (r.status !== 204 && r.status !== 200) fail(`/api/test/reset returned ${r.status} — the test shim required by the spec is missing`);
};

const createLink = async (user, body = { url: LONG_URL }) => {
  const r = await api('/api/links', { user, method: 'POST', body });
  if (r.status !== 201) fail(`POST /api/links: expected 201, got ${r.status} (${(await r.text()).slice(0, 120)})`);
  const j = await r.json();
  if (typeof j.code !== 'string' || !j.code) fail('POST /api/links: response has no "code"');
  if (typeof j.shortUrl !== 'string' || !j.shortUrl) fail('POST /api/links: response has no "shortUrl"');
  return j;
};

const listLinks = async (user) => {
  const r = await api('/api/links', { user });
  eq(r.status, 200, 'GET /api/links status');
  const j = await r.json();
  if (!Array.isArray(j)) fail('GET /api/links must return an array');
  return j;
};

/* ── checks ───────────────────────────────────────────────────────────────── */

check('A1', 'R1', 'anonymous create is rejected', async () => {
  await reset();
  const r = await api('/api/links', { method: 'POST', body: { url: LONG_URL } });
  oneOf(r.status, [401, 403], 'unauthenticated POST /api/links');
});

check('A2', 'R1', 'authenticated create returns 201 + code + shortUrl', async () => {
  await reset();
  await createLink('ada@example.com');
});

check('A3', 'R-core', 'short code redirects (302) to the long URL', async () => {
  await reset();
  const { code } = await createLink('ada@example.com');
  const r = await visit(code);
  eq(r.status, 302, `GET /${code} status`);
  eq(r.headers.get('location'), LONG_URL, 'redirect Location');
});

check('A4', 'R-core', 'visits are counted', async () => {
  await reset();
  const { code } = await createLink('ada@example.com');
  await visit(code);
  await visit(code);
  const link = (await listLinks('ada@example.com')).find((l) => l.code === code);
  if (!link) fail('created link missing from GET /api/links');
  eq(link.hits, 2, 'hit count after 2 visits');
});

check('A5', 'R1', 'a user sees only their own links', async () => {
  await reset();
  const mine = await createLink('ada@example.com');
  await createLink('grace@example.com', { url: 'https://example.org/other' });
  const adaCodes = (await listLinks('ada@example.com')).map((l) => l.code);
  eq(adaCodes.length, 1, "ada's link count");
  eq(adaCodes[0], mine.code, "ada's visible code");
});

check('A6', 'R5', 'an unknown code is 404 Not Found', async () => {
  await reset();
  const r = await visit('definitely-not-a-real-code-zzz');
  eq(r.status, 404, 'GET /<unknown>');
});

check('A7', 'T1', 'a DELETED code is 410 Gone (not 404, not a redirect)', async () => {
  await reset();
  const { code } = await createLink('ada@example.com');
  const d = await api(`/api/links/${code}`, { user: 'ada@example.com', method: 'DELETE' });
  eq(d.status, 204, `DELETE /api/links/${code}`);
  const r = await visit(code);
  eq(r.status, 410, `GET /${code} after delete — deleted is GONE, not unknown`);
});

check('A8', 'T1', 'a deleted link disappears from the dashboard', async () => {
  await reset();
  const { code } = await createLink('ada@example.com');
  await api(`/api/links/${code}`, { user: 'ada@example.com', method: 'DELETE' });
  const codes = (await listLinks('ada@example.com')).map((l) => l.code);
  if (codes.includes(code)) fail('deleted link still listed on the dashboard');
});

check('A9', 'T2', 'a link before its expiry still redirects', async () => {
  await reset();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const { code } = await createLink('ada@example.com', { url: LONG_URL, expiresAt });
  const r = await visit(code);
  eq(r.status, 302, `GET /${code} 60s before expiry`);
});

check('A10', 'T2', 'an EXPIRED link is 410 Gone (evaluated at read time)', async () => {
  await reset();
  const expiresAt = new Date(Date.now() + 2_000).toISOString();
  const { code } = await createLink('ada@example.com', { url: LONG_URL, expiresAt });
  await sleep(3_000);
  const r = await visit(code);
  eq(r.status, 410, `GET /${code} after expiry — expired is GONE, and must not depend on a cron`);
});

check('A11', 'R3', 'a custom alias is honoured', async () => {
  await reset();
  const { code } = await createLink('ada@example.com', { url: LONG_URL, alias: 'planoff-alias' });
  eq(code, 'planoff-alias', 'returned code for a custom alias');
  const r = await visit('planoff-alias');
  eq(r.status, 302, 'GET /planoff-alias');
});

check('A12', 'T3', 'a duplicate alias is 409 Conflict (not 500, not a silent rename)', async () => {
  await reset();
  await createLink('ada@example.com', { url: LONG_URL, alias: 'dup-alias' });
  const r = await api('/api/links', {
    user: 'ada@example.com',
    method: 'POST',
    body: { url: 'https://example.org/second', alias: 'dup-alias' },
  });
  eq(r.status, 409, 'POST /api/links with a taken alias');
});

check('A13', 'T3', 'alias uniqueness is global, not per-user', async () => {
  await reset();
  await createLink('ada@example.com', { url: LONG_URL, alias: 'shared-alias' });
  const r = await api('/api/links', {
    user: 'grace@example.com',
    method: 'POST',
    body: { url: 'https://example.org/second', alias: 'shared-alias' },
  });
  eq(r.status, 409, "POST /api/links with another user's alias");
});

check('A14', 'T4', 'the 11th create in a minute is 429', async () => {
  await reset();
  for (let i = 0; i < 10; i++) {
    const r = await api('/api/links', { user: 'ada@example.com', method: 'POST', body: { url: `${LONG_URL}&i=${i}` } });
    if (r.status !== 201) fail(`create #${i + 1} of 10 should be allowed, got ${r.status} — the limit is 10/min, not fewer`);
  }
  const r = await api('/api/links', { user: 'ada@example.com', method: 'POST', body: { url: `${LONG_URL}&i=11` } });
  eq(r.status, 429, 'create #11 within the same minute');
});

check('A15', 'T4', 'the 429 tells the caller how long to wait (Retry-After)', async () => {
  await reset();
  for (let i = 0; i < 10; i++) {
    await api('/api/links', { user: 'ada@example.com', method: 'POST', body: { url: `${LONG_URL}&j=${i}` } });
  }
  const r = await api('/api/links', { user: 'ada@example.com', method: 'POST', body: { url: `${LONG_URL}&j=11` } });
  eq(r.status, 429, 'create #11 within the same minute');
  const retry = r.headers.get('retry-after');
  if (!retry) fail('429 carries no Retry-After header — the spec says the caller must be told how long to wait');
  if (!/^\d+$/.test(retry.trim()) && Number.isNaN(Date.parse(retry))) {
    fail(`Retry-After is neither delta-seconds nor an HTTP-date: ${JSON.stringify(retry)}`);
  }
});

/* ── run ──────────────────────────────────────────────────────────────────── */

const reachable = await fetch(BASE, { redirect: 'manual' }).then(
  () => true,
  () => false,
);
if (!reachable) {
  console.error(`✗ ${BASE} is not reachable. The app does not boot — that is a legitimate 0%, not a suite bug.`);
}

for (const c of checks) {
  if (!reachable) {
    results.push({ ...c, fn: undefined, pass: false, error: 'app not reachable' });
    continue;
  }
  try {
    await c.fn();
    results.push({ id: c.id, covers: c.covers, title: c.title, pass: true, error: null });
  } catch (e) {
    results.push({ id: c.id, covers: c.covers, title: c.title, pass: false, error: e instanceof Failed ? e.message : `${e}` });
  }
}

const passed = results.filter((r) => r.pass).length;
const total = results.length;
const pct = Math.round((passed / total) * 100);

console.log(`\nPLANOFF-01 acceptance — ${BASE}\n`);
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.id.padEnd(4)} [${r.covers.padEnd(6)}] ${r.title}`);
  if (!r.pass) console.log(`       ↳ ${r.error}`);
}
console.log(`\nACCEPTANCE: ${passed}/${total} passed (${pct}%)\n`);

const trapChecks = results.filter((r) => r.covers.startsWith('T'));
const trapsPassed = trapChecks.filter((r) => r.pass).length;
console.log(`TRAP CHECKS: ${trapsPassed}/${trapChecks.length} passed (A7,A8=T1 · A9,A10=T2 · A12,A13=T3 · A14,A15=T4)`);
console.log('MANUAL (not automatable — record in scorecard.md): T5 offline-email seam · persistence across restart · X-Test-User ignored when APP_ENV!=test\n');

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify({ bench: 'PLANOFF-01', base_url: BASE, ran_at: new Date().toISOString(), passed, total, pct, reachable, results }, null, 2),
  );
  console.log(`→ ${OUT}`);
}

process.exit(passed === total ? 0 : 1);
