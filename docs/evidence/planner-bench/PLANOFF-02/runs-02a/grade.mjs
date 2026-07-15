#!/usr/bin/env node
'use strict';
// grade.mjs — zero-dependency black-box acceptance grader for "snip" (PLANOFF-02A).
//
// Usage: node grade.mjs <app-dir> <phase1|phase2> <out.json>
//
// Design notes:
//  - Every probe is wrapped so a throw never escapes: the grader always writes <out.json>
//    and always exits 0. The JSON is the result, not the process exit code.
//  - Phase 1 spawns ONE app twice: a `test`-mode instance (primary) and a `production`-mode
//    instance (secondary, isolated DB) used only for the shim-inertness probes (A1, A10).
//  - Phase 2 reuses the exact same spawn/probe machinery, then layers team-feature probes on
//    top. Phase-2 route names are NOT fixed by the spec (that's an arm's design decision), so
//    those probes try a short list of reasonable candidate routes and fail gracefully — never
//    throw — when nothing matches.

import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function isValidRetryAfter(val) {
  if (val == null) return false;
  const s = String(val).trim();
  if (s === '') return false;
  if (/^\d+$/.test(s)) return true; // delta-seconds
  const d = Date.parse(s); // HTTP-date or any parseable date string
  return !Number.isNaN(d);
}

/** Wraps a probe body so a thrown error becomes pass:false instead of crashing the grader. */
async function probe(id, fn) {
  try {
    const r = await fn();
    return { id, pass: !!(r && r.pass), detail: (r && r.detail) || '' };
  } catch (err) {
    return { id, pass: false, detail: `probe threw: ${err && err.message ? err.message : String(err)}` };
  }
}

/** fetch wrapper with manual redirects, JSON body, and a hard per-request timeout. */
async function req(baseUrl, method, pathAndQuery, { headers = {}, json, redirectManual = false, timeoutMs = 5000 } = {}) {
  const opts = { method, headers: { ...headers } };
  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  }
  if (redirectManual) opts.redirect = 'manual';
  opts.signal = AbortSignal.timeout(timeoutMs);
  const r = await fetch(baseUrl + pathAndQuery, opts);
  let text = '';
  try { text = await r.text(); } catch { /* ignore */ }
  let json_ = null;
  try { json_ = text ? JSON.parse(text) : null; } catch { /* not JSON, fine */ }
  return { status: r.status, headers: r.headers, text, json: json_ };
}

/** Extracts the links array from a list response regardless of envelope shape: a bare
 *  array, or { links | data | items | results: [...] }. Returns [] if none found. */
function asList(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const k of ['links', 'data', 'items', 'results']) if (Array.isArray(json[k])) return json[k];
    for (const v of Object.values(json)) if (Array.isArray(v)) return v;
  }
  return [];
}

/** Tries a list of candidate {method, path, json, headers} requests in order; returns the
 *  first response whose status isn't 404 (i.e. the route seems to exist). Never throws. */
async function tryCandidates(baseUrl, candidates, fallbackHeaders) {
  for (const c of candidates) {
    try {
      const r = await req(baseUrl, c.method, c.path, { headers: c.headers || fallbackHeaders, json: c.json });
      if (r.status !== 404) return { found: true, response: r, candidate: c };
    } catch {
      // network error hitting this candidate route; try the next one
    }
  }
  return { found: false };
}

// ---------------------------------------------------------------------------
// app lifecycle: spawn, boot-poll, kill
// ---------------------------------------------------------------------------

async function spawnApp({ appDir, port, appEnv, dbPath, bootTimeoutMs = 20_000 }) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: appDir,
    env: { ...process.env, PORT: String(port), APP_ENV: appEnv, DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (d) => { stdout += d.toString(); });
  child.stderr?.on('data', (d) => { stderr += d.toString(); });
  child.on('error', () => { /* surfaced via booted=false below */ });

  const baseUrl = `http://127.0.0.1:${port}`;
  const start = Date.now();
  let booted = false;
  while (Date.now() - start < bootTimeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) break; // crashed before booting
    try {
      await fetch(`${baseUrl}/api/links`, {
        headers: { 'X-Test-User': 'boot-check@harness.local' },
        signal: AbortSignal.timeout(1000),
      });
      booted = true;
      break;
    } catch {
      await sleep(200);
    }
  }
  return {
    child,
    baseUrl,
    port,
    dbPath,
    appEnv,
    booted,
    getStdout: () => stdout,
    getStderr: () => stderr,
  };
}

function killApp(app) {
  return new Promise((resolve) => {
    if (!app || !app.child || app.child.exitCode !== null || app.child.signalCode !== null) return resolve();
    const child = app.child;
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
    }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    try { child.kill('SIGTERM'); } catch { clearTimeout(timer); resolve(); }
  });
}

// ---------------------------------------------------------------------------
// Phase-1 probes (A1..A12)
// ---------------------------------------------------------------------------
//
// Sequencing rationale (why this order, not the ID order):
//   A7, A2, A3, A4, A5, A6 build/read state without needing a clean rate-limiter window.
//   A8 resets first (clean 60s window) then bursts 11 creates.
//   A9 resets first (isolate its two-user fixture from everything before it).
//   A11 IS the "reset zeroes everything" probe: create -> reset -> verify gone.
//   A12 (persistence) runs last against the test-mode child because it kills and respawns it.
//   A1 / A10 run against the separate production-mode child at any point (no shared state).

async function runA7(testBase) {
  const alias = 'dupalias-' + crypto.randomBytes(3).toString('hex');
  const first = await req(testBase, 'POST', '/api/links', {
    headers: { 'X-Test-User': 'a7-alice@test.local' },
    json: { url: 'https://example.com/a7-first', alias },
  });
  const second = await req(testBase, 'POST', '/api/links', {
    headers: { 'X-Test-User': 'a7-bob@test.local' },
    json: { url: 'https://example.com/a7-second', alias },
  });
  return {
    pass: first.status === 201 && second.status === 409,
    detail: `first create (alias=${alias}) -> ${first.status}; duplicate-alias create -> ${second.status} (expected 201 then 409)`,
  };
}

async function runA2(testBase) {
  const url = 'https://example.com/a2-target';
  const cr = await req(testBase, 'POST', '/api/links', {
    headers: { 'X-Test-User': 'a2-alice@test.local' },
    json: { url },
  });
  if (cr.status !== 201 || !cr.json || !cr.json.code) {
    return { pass: false, detail: `create -> ${cr.status} (expected 201 with {code})`, code: null };
  }
  const code = cr.json.code;
  const rg = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  const loc = rg.headers.get('location');
  const pass = rg.status === 302 && loc === url;
  return { pass, detail: `GET /${code} -> ${rg.status}, Location=${loc} (expected 302 -> ${url})`, code };
}

async function runA3(testBase, code) {
  if (!code) return { pass: false, detail: 'skipped: no code from A2 to reuse' };
  const rg = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  const list = await req(testBase, 'GET', '/api/links', { headers: { 'X-Test-User': 'a2-alice@test.local' } });
  const entry = asList(list.json).find((l) => l.code === code) || null;
  const pass = rg.status === 302 && !!entry && entry.hits === 2;
  return { pass, detail: `second GET -> ${rg.status}; hits now ${entry ? entry.hits : 'n/a'} (expected 2)` };
}

async function runA4(testBase) {
  const r = await req(testBase, 'GET', '/does-not-exist-zzz-999');
  return { pass: r.status === 404, detail: `GET unknown code -> ${r.status} (expected 404)` };
}

async function runA5(testBase) {
  const headers = { 'X-Test-User': 'a5-alice@test.local' };
  const cr = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/a5-target' } });
  if (cr.status !== 201) return { pass: false, detail: `setup create -> ${cr.status}` };
  const code = cr.json.code;
  const list = await req(testBase, 'GET', '/api/links', { headers });
  const entry = asList(list.json).find((l) => l.code === code) || null;
  if (!entry || entry.id == null) {
    return { pass: false, detail: `GET /api/links did not return an id for code ${code} (needed for DELETE /api/links/:id)` };
  }
  const del = await req(testBase, 'DELETE', `/api/links/${entry.id}`, { headers });
  if (del.status !== 204) return { pass: false, detail: `DELETE -> ${del.status} (expected 204)` };
  const rg = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  return { pass: rg.status === 410, detail: `GET /${code} after delete -> ${rg.status} (expected 410, NOT 404)` };
}

async function runA6(testBase) {
  const headers = { 'X-Test-User': 'a6-alice@test.local' };
  const past = '2000-01-01T00:00:00.000Z';
  let cr = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/a6-past', expiresAt: past } });
  let code;
  let note = 'past-dated expiresAt accepted at creation';
  if (cr.status === 201 && cr.json && cr.json.code) {
    code = cr.json.code;
  } else {
    const soon = new Date(Date.now() + 1200).toISOString();
    const cr2 = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/a6-soon', expiresAt: soon } });
    if (cr2.status !== 201 || !cr2.json || !cr2.json.code) {
      return { pass: false, detail: `could not create an expiring link (past-dated -> ${cr.status}, near-future fallback -> ${cr2.status})` };
    }
    code = cr2.json.code;
    note = `past-dated rejected (${cr.status}); used near-future expiresAt + 1.5s wait instead`;
    await sleep(1500);
  }
  const rg = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  return { pass: rg.status === 410, detail: `${note}; GET /${code} -> ${rg.status} (expected 410)` };
}

async function runA8(testBase) {
  await req(testBase, 'POST', '/api/test/reset', {}); // clean rate-limit window
  const headers = { 'X-Test-User': 'a8-burst@test.local' };
  const results = [];
  for (let i = 0; i < 11; i++) {
    results.push(await req(testBase, 'POST', '/api/links', { headers, json: { url: `https://example.com/a8-${i}` } }));
  }
  const first10 = results.slice(0, 10);
  const eleventh = results[10];
  const first10Ok = first10.every((r) => r.status === 201);
  const retryAfter = eleventh.headers.get('retry-after');
  const validRetry = isValidRetryAfter(retryAfter);
  const pass = first10Ok && eleventh.status === 429 && validRetry;
  return {
    pass,
    detail: `statuses 1-10=[${first10.map((r) => r.status).join(',')}], 11th=${eleventh.status}, Retry-After=${JSON.stringify(retryAfter)}`,
  };
}

async function runA9(testBase) {
  await req(testBase, 'POST', '/api/test/reset', {}); // isolate this fixture
  const aliceH = { 'X-Test-User': 'a9-alice@test.local' };
  const bobH = { 'X-Test-User': 'a9-bob@test.local' };
  const c1 = await req(testBase, 'POST', '/api/links', { headers: aliceH, json: { url: 'https://example.com/a9-1' } });
  const c2 = await req(testBase, 'POST', '/api/links', { headers: aliceH, json: { url: 'https://example.com/a9-2' } });
  const c3 = await req(testBase, 'POST', '/api/links', { headers: bobH, json: { url: 'https://example.com/a9-3' } });
  if ([c1, c2, c3].some((r) => r.status !== 201)) {
    return { pass: false, detail: `fixture creates failed: ${[c1, c2, c3].map((r) => r.status).join(',')}` };
  }
  const aliceList = await req(testBase, 'GET', '/api/links', { headers: aliceH });
  const bobList = await req(testBase, 'GET', '/api/links', { headers: bobH });
  if (aliceList.status !== 200 || bobList.status !== 200) {
    return { pass: false, detail: `list fetch failed: alice=${aliceList.status}, bob=${bobList.status}` };
  }
  const aliceArr = asList(aliceList.json);
  const bobArr = asList(bobList.json);
  const aliceCodes = new Set(aliceArr.map((l) => l.code));
  const bobCodes = new Set(bobArr.map((l) => l.code));
  const aliceOk = aliceArr.length === 2 && aliceCodes.has(c1.json.code) && aliceCodes.has(c2.json.code) && !aliceCodes.has(c3.json.code);
  const bobOk = bobArr.length === 1 && bobCodes.has(c3.json.code) && !bobCodes.has(c1.json.code) && !bobCodes.has(c2.json.code);
  return {
    pass: aliceOk && bobOk,
    detail: `alice sees ${aliceArr.length} link(s) (expect 2, own only); bob sees ${bobArr.length} (expect 1, own only)`,
  };
}

async function runA11(testBase) {
  await req(testBase, 'POST', '/api/test/reset', {}); // start clean so this probe's fixture is unambiguous
  const headers = { 'X-Test-User': 'a11-alice@test.local' };
  const cr = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/a11-target' } });
  if (cr.status !== 201) return { pass: false, detail: `fixture create -> ${cr.status}` };
  const code = cr.json.code;
  const resetR = await req(testBase, 'POST', '/api/test/reset', {});
  const listAfter = await req(testBase, 'GET', '/api/links', { headers });
  const getAfter = await req(testBase, 'GET', '/' + encodeURIComponent(code));
  const listEmpty = listAfter.status === 200 && asList(listAfter.json).length === 0;
  const codeGone = getAfter.status === 404;
  return {
    pass: resetR.status >= 200 && resetR.status < 300 && listEmpty && codeGone,
    detail: `reset -> ${resetR.status}; post-reset list length=${asList(listAfter.json).length} (expect 0); GET /${code} -> ${getAfter.status} (expect 404)`,
  };
}

/** A12 needs to kill+respawn the SAME app (same port/db), so it lives in main() where the
 *  spawn/kill helpers and app-dir context are available; this just does the HTTP half. */
async function createPersistenceFixture(testBase) {
  const headers = { 'X-Test-User': 'a12-alice@test.local' };
  const url = 'https://example.com/a12-persisted';
  const cr = await req(testBase, 'POST', '/api/links', { headers, json: { url } });
  if (cr.status !== 201 || !cr.json || !cr.json.code) return { ok: false, detail: `fixture create -> ${cr.status}` };
  return { ok: true, code: cr.json.code, url };
}

async function verifyPersistenceFixture(testBase, fixture) {
  const rg = await req(testBase, 'GET', '/' + encodeURIComponent(fixture.code), { redirectManual: true });
  const loc = rg.headers.get('location');
  const pass = rg.status === 302 && loc === fixture.url;
  return { pass, detail: `after restart, GET /${fixture.code} -> ${rg.status}, Location=${loc} (expected 302 -> ${fixture.url})` };
}

async function runA1(prodBase) {
  const r = await req(prodBase, 'POST', '/api/links', { json: { url: 'https://example.com/a1-anon' } });
  return { pass: r.status === 401, detail: `anonymous create in production -> ${r.status} (expected 401)` };
}

async function runA10(prodBase) {
  const r = await req(prodBase, 'POST', '/api/links', {
    headers: { 'X-Test-User': 'a10-alice@test.local' },
    json: { url: 'https://example.com/a10-shim' },
  });
  return { pass: r.status === 401, detail: `production + X-Test-User header -> ${r.status} (expected 401, header must be ignored)` };
}

/** Runs the full A1..A12 Phase-1 suite against an already-booted app. `respawn` lets the
 *  caller (Phase-1 or Phase-2's regression sub-probe) supply how to kill+restart the
 *  test-mode child for A12; if omitted, A12 is skipped with an explanatory detail instead
 *  of guessing at lifecycle management it doesn't own. */
async function runPhase1Suite({ testApp, prodApp, respawnTestApp }) {
  const results = [];

  if (!testApp.booted) {
    for (const id of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A11', 'A12']) {
      results.push({ id, pass: false, detail: 'app did not boot within the 20s timeout (test-mode instance)' });
    }
  } else {
    const testBase = testApp.baseUrl;
    results.push(await probe('A7', () => runA7(testBase)));
    const a2 = await runA2(testBase);
    results.push({ id: 'A2', pass: a2.pass, detail: a2.detail });
    results.push(await probe('A3', () => runA3(testBase, a2.code)));
    results.push(await probe('A4', () => runA4(testBase)));
    results.push(await probe('A5', () => runA5(testBase)));
    results.push(await probe('A6', () => runA6(testBase)));
    results.push(await probe('A8', () => runA8(testBase)));
    results.push(await probe('A9', () => runA9(testBase)));
    results.push(await probe('A11', () => runA11(testBase)));

    if (respawnTestApp) {
      const fixture = await createPersistenceFixture(testBase);
      if (!fixture.ok) {
        results.push({ id: 'A12', pass: false, detail: `could not create persistence fixture: ${fixture.detail}` });
      } else {
        const newApp = await respawnTestApp();
        if (!newApp.booted) {
          results.push({ id: 'A12', pass: false, detail: 'app did not boot within the 20s timeout (restarted instance)' });
        } else {
          results.push(await probe('A12', () => verifyPersistenceFixture(newApp.baseUrl, fixture)));
        }
      }
    } else {
      results.push({ id: 'A12', pass: false, detail: 'skipped: no respawn hook supplied to the suite runner' });
    }
  }

  if (!prodApp || !prodApp.booted) {
    results.push({ id: 'A1', pass: false, detail: 'app did not boot within the 20s timeout (production-mode instance)' });
    results.push({ id: 'A10', pass: false, detail: 'app did not boot within the 20s timeout (production-mode instance)' });
  } else {
    results.push(await probe('A1', () => runA1(prodApp.baseUrl)));
    results.push(await probe('A10', () => runA10(prodApp.baseUrl)));
  }

  const order = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12'];
  results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return results;
}

// ---------------------------------------------------------------------------
// Phase-2 probes (P1..P9 specified, U-H1..U-H8 + U-perc unspecified/trap)
// ---------------------------------------------------------------------------
// Route names for the team-links extension are NOT fixed by the spec (arms design their own
// API shape), so every probe here tries a short list of plausible candidate routes (documented
// in CONTRACT.md) and reports a graceful failure — never a crash — when nothing matches.

async function testP1_regression({ testApp, prodApp, respawnTestApp }) {
  const sub = await runPhase1Suite({ testApp, prodApp, respawnTestApp });
  const failed = sub.filter((r) => !r.pass).map((r) => r.id);
  return {
    pass: failed.length === 0,
    detail: `Phase-1 regression on the post-Phase-2 build: ${sub.length - failed.length}/${sub.length} passed` +
      (failed.length ? `; failed=[${failed.join(',')}]` : ''),
    sub,
  };
}

async function testP2_teamShare(testBase) {
  const ownerH = { 'X-Test-User': 'p2-owner@test.local' };
  const memberH = { 'X-Test-User': 'p2-member@test.local' };
  const outsiderH = { 'X-Test-User': 'p2-outsider@test.local' };

  const ws = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p2-ws' } }], ownerH);
  if (!ws.found || ws.response.status >= 300) {
    return { pass: false, detail: 'POST /api/workspaces not found or failed — cannot exercise team share' };
  }
  const wsId = ws.response.json && (ws.response.json.id ?? ws.response.json.workspaceId);
  if (wsId == null) return { pass: false, detail: 'workspace create response had no id/workspaceId field' };

  const memberId = 'p2-member@test.local';
  const add = await tryCandidates(testBase, [{ method: 'POST', path: `/api/workspaces/${wsId}/members`, json: { email: memberId, userId: memberId, user: memberId, member: memberId } }], ownerH);
  if (!add.found || add.response.status >= 300) {
    return { pass: false, detail: `POST /api/workspaces/:id/members not found or failed (${add.found ? add.response.status : 'no route'})` };
  }

  const link = await tryCandidates(testBase, [
    { method: 'POST', path: '/api/links', json: { url: 'https://example.com/p2-shared', workspaceId: wsId }, headers: ownerH },
    { method: 'POST', path: '/api/links/share', json: { url: 'https://example.com/p2-shared', workspaceId: wsId }, headers: ownerH },
  ]);
  if (!link.found || link.response.status !== 201) {
    return { pass: false, detail: 'could not create a workspace-shared link via any candidate route' };
  }
  const code = link.response.json.code;

  const memberList = await req(testBase, 'GET', '/api/links', { headers: memberH });
  const memberSees = memberList.status === 200 && asList(memberList.json).some((l) => l.code === code);
  const outsiderList = await req(testBase, 'GET', '/api/links', { headers: outsiderH });
  const outsiderExcluded = !(outsiderList.status === 200 && asList(outsiderList.json).some((l) => l.code === code));

  return { pass: memberSees && outsiderExcluded, detail: `member sees shared link=${memberSees}; non-member excluded=${outsiderExcluded}`, ctx: { wsId, code, ownerH, memberH, outsiderH } };
}

async function testP3_ownerOnlyDelete(testBase, shareCtx) {
  if (!shareCtx) return { pass: false, detail: 'skipped: P2 team-share setup unavailable' };
  const { code, ownerH, memberH } = shareCtx;
  const list = await req(testBase, 'GET', '/api/links', { headers: ownerH });
  const entry = asList(list.json).find((l) => l.code === code) || null;
  if (!entry || entry.id == null) return { pass: false, detail: 'could not resolve link id for owner-only delete check' };

  const memberDelete = await req(testBase, 'DELETE', `/api/links/${entry.id}`, { headers: memberH });
  const memberBlocked = memberDelete.status === 403;
  const ownerDelete = await req(testBase, 'DELETE', `/api/links/${entry.id}`, { headers: ownerH });
  const ownerAllowed = ownerDelete.status === 204;
  return { pass: memberBlocked && ownerAllowed, detail: `member DELETE -> ${memberDelete.status} (expect 403); owner DELETE -> ${ownerDelete.status} (expect 204)`, code };
}

async function testP4_deletedShared410(testBase) {
  const ownerH = { 'X-Test-User': 'p4-owner@test.local' };
  const ws = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p4-ws' } }], ownerH);
  if (!ws.found || ws.response.status >= 300) return { pass: false, detail: 'workspace create unavailable — cannot test deleted-shared-410' };
  const wsId = ws.response.json && (ws.response.json.id ?? ws.response.json.workspaceId);
  const link = await tryCandidates(testBase, [{ method: 'POST', path: '/api/links', json: { url: 'https://example.com/p4-del', workspaceId: wsId }, headers: ownerH }]);
  if (!link.found || link.response.status !== 201) return { pass: false, detail: 'could not create a shared link to delete' };
  const code = link.response.json.code;
  const list = await req(testBase, 'GET', '/api/links', { headers: ownerH });
  const entry = asList(list.json).find((l) => l.code === code);
  if (!entry || entry.id == null) return { pass: false, detail: 'could not resolve shared link id for delete' };
  const del = await req(testBase, 'DELETE', `/api/links/${entry.id}`, { headers: ownerH });
  if (del.status !== 204) return { pass: false, detail: `owner delete of shared link -> ${del.status} (expected 204)` };
  const r = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  return { pass: r.status === 410, detail: `deleted shared code GET -> ${r.status} (expected 410, tombstone honored on team path)` };
}

async function testP5_expiredShared410(testBase) {
  const ownerH = { 'X-Test-User': 'p5-owner@test.local' };
  const memberH = { 'X-Test-User': 'p5-member@test.local' };
  const ws = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p5-ws' } }], ownerH);
  if (!ws.found || ws.response.status >= 300) return { pass: false, detail: 'workspace creation not available — cannot test expired-shared' };
  const wsId = ws.response.json && (ws.response.json.id ?? ws.response.json.workspaceId);
  await tryCandidates(testBase, [{ method: 'POST', path: `/api/workspaces/${wsId}/members`, json: { email: 'p5-member@test.local', userId: 'p5-member@test.local', user: 'p5-member@test.local', member: 'p5-member@test.local' } }], ownerH);
  const past = '2000-01-01T00:00:00.000Z';
  const link = await tryCandidates(testBase, [
    { method: 'POST', path: '/api/links', json: { url: 'https://example.com/p5-expired', workspaceId: wsId, expiresAt: past }, headers: ownerH },
  ]);
  if (!link.found || link.response.status !== 201) return { pass: false, detail: 'could not create an expired workspace-shared link' };
  const code = link.response.json.code;
  const r = await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  return { pass: r.status === 410, detail: `teammate GET on expired shared code -> ${r.status} (expected 410)` };
}

async function testP6_globalAliasUniqueness(testBase) {
  const ownerH = { 'X-Test-User': 'p6-owner@test.local' };
  const wsA = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p6-ws-a' } }], ownerH);
  const wsB = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p6-ws-b' } }], ownerH);
  if (!wsA.found || !wsB.found) return { pass: false, detail: 'workspace creation not available — cannot test cross-workspace alias uniqueness' };
  const wsAId = wsA.response.json && (wsA.response.json.id ?? wsA.response.json.workspaceId);
  const wsBId = wsB.response.json && (wsB.response.json.id ?? wsB.response.json.workspaceId);
  const alias = 'p6-global-' + crypto.randomBytes(3).toString('hex');
  const first = await req(testBase, 'POST', '/api/links', { headers: ownerH, json: { url: 'https://example.com/p6-a', alias, workspaceId: wsAId } });
  const second = await req(testBase, 'POST', '/api/links', { headers: ownerH, json: { url: 'https://example.com/p6-b', alias, workspaceId: wsBId } });
  return { pass: first.status === 201 && second.status === 409, detail: `workspace A create -> ${first.status}; same alias in workspace B -> ${second.status} (expected 201 then 409, uniqueness stays global)` };
}

async function testP7_migrationCorrectness(testBase) {
  // Black-box: we cannot force a pre-existing Phase-1 DB into an unknown arm's migration harness.
  // Best-effort check: the app boots against its own DB and re-running its reset/boot cycle is
  // stable. A true migration check requires the arm's fixture DB, which is out of scope for a
  // generic grader without a known migration entrypoint — recorded as a graceful partial check.
  const r = await req(testBase, 'GET', '/api/links', { headers: { 'X-Test-User': 'p7-check@test.local' } });
  const bootsAndServes = r.status === 200 || r.status === 401;
  return {
    pass: false,
    detail: 'not independently verifiable by a generic black-box grader without the arm\'s pre-migration fixture DB and migration entrypoint; ' +
      `app is otherwise responsive (GET /api/links -> ${r.status}). Treat as a manual/process check, not an automated pass.`,
  };
}

async function testP8_apiKeyPath(testBase) {
  const ownerH = { 'X-Test-User': 'p8-owner@test.local' };
  const ws = await tryCandidates(testBase, [{ method: 'POST', path: '/api/workspaces', json: { name: 'p8-ws' } }], ownerH);
  if (!ws.found || ws.response.status >= 300) return { pass: false, detail: 'workspace creation not available — cannot test API key path' };
  const wsId = ws.response.json && (ws.response.json.id ?? ws.response.json.workspaceId);
  const keyR = await tryCandidates(testBase, [
    { method: 'POST', path: `/api/workspaces/${wsId}/keys`, json: {} },
    { method: 'POST', path: '/api/keys', json: { workspaceId: wsId } },
    { method: 'POST', path: `/api/workspaces/${wsId}/api-keys`, json: {} },
  ], ownerH);
  const keyVal = keyR.found && keyR.response.json ? (keyR.response.json.key ?? keyR.response.json.apiKey ?? keyR.response.json.token ?? keyR.response.json.secret) : null;
  if (!keyR.found || keyR.response.status >= 300 || !keyVal) {
    return { pass: false, detail: `key-mint route not found or no key field (tried /api/workspaces/:id/keys and /api/keys; status=${keyR.found ? keyR.response.status : 'no route'})` };
  }
  const key = keyVal;
  const bearerH = { Authorization: `Bearer ${key}` };
  const listViaKey = await req(testBase, 'GET', '/api/links', { headers: bearerH });
  const rateLimited = [];
  for (let i = 0; i < 11; i++) {
    rateLimited.push(await req(testBase, 'POST', '/api/links', { headers: bearerH, json: { url: `https://example.com/p8-${i}` } }));
  }
  const eleventh = rateLimited[10];
  const shares429 = eleventh.status === 429;
  return {
    pass: listViaKey.status === 200 && shares429,
    detail: `Bearer-key GET /api/links -> ${listViaKey.status}; 11th Bearer-key create -> ${eleventh.status} (expected 200 then 429, sharing the create rate limit)`,
  };
}

async function testP9_analytics(testBase) {
  const ownerH = { 'X-Test-User': 'p9-owner@test.local' };
  const cr = await req(testBase, 'POST', '/api/links', { headers: ownerH, json: { url: 'https://example.com/p9-target' } });
  if (cr.status !== 201) return { pass: false, detail: `setup create -> ${cr.status}` };
  const code = cr.json.code;
  await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  const list = await req(testBase, 'GET', '/api/links', { headers: ownerH });
  const entry = asList(list.json).find((l) => l.code === code) || null;
  const linkId = entry ? entry.id : null;
  const analytics = await tryCandidates(testBase, [
    { method: 'GET', path: `/api/links/${linkId}/analytics`, headers: ownerH },
    { method: 'GET', path: `/api/analytics?code=${encodeURIComponent(code)}`, headers: ownerH },
  ]);
  if (!analytics.found || analytics.response.status !== 200) {
    return { pass: false, detail: 'no analytics endpoint found among candidates (tried /api/links/:id/analytics, /api/analytics?code=)' };
  }
  const body = analytics.response.json || {};
  const hasTotal = typeof body.total === 'number' || typeof body.clicks === 'number' || typeof body.hits === 'number';
  const hasDaily = [body.daily, body.byDay, body.series, body.buckets, body.perDay, body.groups, body.days].some((v) => v != null);
  return { pass: hasTotal && hasDaily, detail: `analytics response keys=${Object.keys(body).join(',')} (need a total/clicks count and a per-day breakdown)` };
}

async function testU_perc(testBase) {
  let r;
  try {
    r = await fetch(testBase + '/%E0%A4%A', { signal: AbortSignal.timeout(5000), redirect: 'manual' });
  } catch (e) {
    return { pass: false, detail: `request threw instead of returning a clean response: ${e.message}` };
  }
  const clean4xx = r.status >= 400 && r.status < 500;
  return { pass: clean4xx, detail: `GET /%E0%A4%A -> ${r.status} (expected a clean 4xx, not 500)` };
}

async function testU_H1(testBase) {
  // Same predicate as P2+P3 combined (isolation must flip at every seam: list, delete, and — per
  // traps.md — the non-member must also be blocked from analytics/DELETE with 403/404).
  const share = await testP2_teamShare(testBase);
  if (!share.pass || !share.ctx) return { pass: false, detail: `H1 setup (team share) failed: ${share.detail}` };
  const { code, ownerH, outsiderH } = share.ctx;
  const list = await req(testBase, 'GET', '/api/links', { headers: ownerH });
  const entry = asList(list.json).find((l) => l.code === code) || null;
  if (!entry) return { pass: false, detail: 'could not resolve fixture link for H1' };
  const outsiderDelete = await req(testBase, 'DELETE', `/api/links/${entry.id}`, { headers: outsiderH });
  const outsiderBlocked = outsiderDelete.status === 403 || outsiderDelete.status === 404;
  return { pass: outsiderBlocked, detail: `outsider DELETE on a link they can't even see -> ${outsiderDelete.status} (expected 403/404)` };
}

async function testU_H2(testBase, preMigrationCode) {
  if (!preMigrationCode) {
    return { pass: false, detail: 'no pre-migration Phase-1 code available to this generic grader (needs the arm\'s inherited DB) — not independently verifiable black-box' };
  }
  const r = await req(testBase, 'GET', '/' + encodeURIComponent(preMigrationCode), { redirectManual: true });
  return { pass: r.status === 302, detail: `pre-migration code GET -> ${r.status} (expected unchanged 302)` };
}

async function testU_H3(testBase) {
  // Deleted shared link must stay 410 on the team read path (self-contained fixture).
  const del = await testP4_deletedShared410(testBase);
  return { pass: del.pass, detail: `team-path deleted-link 410 check -> ${del.detail}` };
}

async function testU_H4_apiKeyInherits(testBase) {
  return testP8_apiKeyPath(testBase);
}

async function testU_H5_hitsEqualsClicks(testBase) {
  const headers = { 'X-Test-User': 'h5@test.local' };
  await req(testBase, 'POST', '/api/test/reset', {});
  const cr = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/h5' } });
  if (cr.status !== 201) return { pass: false, detail: `setup create -> ${cr.status}` };
  const code = cr.json.code;
  for (let i = 0; i < 3; i++) await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  const list1 = await req(testBase, 'GET', '/api/links', { headers });
  const entry1 = asList(list1.json).find((l) => l.code === code) || null;
  const hitsAfter3 = entry1 ? entry1.hits : null;
  await req(testBase, 'GET', '/does-not-exist-h5-404');
  const list2 = await req(testBase, 'GET', '/api/links', { headers });
  const entry2 = asList(list2.json).find((l) => l.code === code) || null;
  const unchangedAfter404 = entry2 && entry2.hits === hitsAfter3;
  await req(testBase, 'POST', '/api/test/reset', {});
  const listAfterReset = await req(testBase, 'GET', '/api/links', { headers });
  const emptyAfterReset = asList(listAfterReset.json).length === 0;
  const pass = hitsAfter3 === 3 && unchangedAfter404 && emptyAfterReset;
  return { pass, detail: `hits after 3 live GETs=${hitsAfter3} (expect 3); unchanged after a 404 GET=${unchangedAfter404}; empty after reset=${emptyAfterReset}` };
}

async function testU_H6_utcDailyBuckets(testBase) {
  // Cannot force click timestamps through a black-box HTTP click; try a seed/analytics
  // candidate that accepts explicit timestamps, else fail gracefully — this trap is inherently
  // hard to probe without either a time-travel seam or the arm exposing one.
  const seed = await tryCandidates(testBase, [
    { method: 'POST', path: '/api/test/seed-click', json: { at: '2026-07-14T23:30:00Z' } },
  ], {});
  if (!seed.found) {
    return { pass: false, detail: 'no black-box seam found to seed a click at an explicit UTC timestamp (e.g. /api/test/seed-click) — cannot force the midnight-straddle scenario generically' };
  }
  return { pass: false, detail: 'seed endpoint found but full UTC-bucket verification requires an arm-specific analytics query shape not covered by this generic probe' };
}

async function testU_H7_malformedAnalyticsParams(testBase) {
  const headers = { 'X-Test-User': 'h7@test.local' };
  const cr = await req(testBase, 'POST', '/api/links', { headers, json: { url: 'https://example.com/h7-analytics' } });
  const code = cr.status === 201 && cr.json ? cr.json.code : null;
  if (code) await req(testBase, 'GET', '/' + encodeURIComponent(code), { redirectManual: true });
  const list = await req(testBase, 'GET', '/api/links', { headers });
  const entry = asList(list.json).find((l) => l.code === code);
  const linkId = entry ? entry.id : null;
  const bases = [];
  if (linkId != null) bases.push(`/api/links/${linkId}/analytics`);
  if (code) bases.push(`/api/analytics?code=${encodeURIComponent(code)}`);

  let anyRouteFound = false;
  let badDate400 = false;
  let injection400 = false;
  let inverted400orEmpty = false;
  let any500 = false;

  for (const base of bases) {
    const sep = base.includes('?') ? '&' : '?';
    const r1 = await req(testBase, 'GET', `${base}${sep}from=notadate`, { headers });
    if (r1.status !== 404) anyRouteFound = true;
    if (r1.status === 400) badDate400 = true;
    if (r1.status >= 500) any500 = true;

    const r2 = await req(testBase, 'GET', `${base}${sep}groupBy=' OR 1=1--`, { headers });
    if (r2.status !== 404) anyRouteFound = true;
    if (r2.status === 400) injection400 = true;
    if (r2.status >= 500) any500 = true;

    const r3 = await req(testBase, 'GET', `${base}${sep}from=2026-07-20&to=2026-07-01`, { headers });
    if (r3.status !== 404) anyRouteFound = true;
    if (r3.status === 400 || (r3.status === 200 && r3.json && Array.isArray(r3.json.daily) && r3.json.daily.length === 0)) inverted400orEmpty = true;
    if (r3.status >= 500) any500 = true;
  }

  if (!anyRouteFound) return { pass: false, detail: 'no analytics endpoint found among candidates — cannot test malformed params' };
  const pass = !any500 && badDate400 && injection400 && inverted400orEmpty;
  return { pass, detail: `bad-date->400=${badDate400}, injection-groupBy->400=${injection400}, inverted-range->400/empty=${inverted400orEmpty}, any500=${any500}` };
}

async function testU_H8_concurrencyRace(testBase) {
  const alias = 'race-' + crypto.randomBytes(4).toString('hex');
  const N = 8;
  const headers = { 'X-Test-User': 'h8@test.local' };
  const settled = await Promise.allSettled(
    Array.from({ length: N }, (_, i) => req(testBase, 'POST', '/api/links', { headers, json: { url: `https://example.com/h8-${i}`, alias } }))
  );
  const statuses = settled.map((r) => (r.status === 'fulfilled' ? r.value.status : 'ERR'));
  const created = statuses.filter((s) => s === 201).length;
  const conflicted = statuses.filter((s) => s === 409).length;
  const bad = statuses.filter((s) => s !== 201 && s !== 409).length;
  const pass = created === 1 && conflicted === N - 1 && bad === 0;
  return { pass, detail: `${N} concurrent same-alias creates -> statuses=${JSON.stringify(statuses)} (expected exactly one 201, rest 409, zero 500)` };
}

async function runPhase2Suite({ testApp, prodApp, respawnTestApp, phase1SeedCode }) {
  const results = [];
  if (!testApp.booted) {
    for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'U-perc', 'U-H1', 'U-H2', 'U-H3', 'U-H4', 'U-H5', 'U-H6', 'U-H7', 'U-H8']) {
      results.push({ id, pass: false, detail: 'app did not boot within the 20s timeout (test-mode instance)' });
    }
    return results;
  }
  const testBase = testApp.baseUrl;

  const p1 = await testP1_regression({ testApp, prodApp, respawnTestApp });
  results.push({ id: 'P1', pass: p1.pass, detail: p1.detail });

  const p2 = await probe('P2', () => testP2_teamShare(testBase));
  results.push(p2);
  const shareCtx = (await testP2_teamShare(testBase).catch(() => null))?.ctx; // fresh ctx for downstream probes (P2 above already consumed its own)

  const p3 = await probe('P3', () => testP3_ownerOnlyDelete(testBase, shareCtx));
  results.push(p3);
  const p3Raw = await testP3_ownerOnlyDelete(testBase, shareCtx).catch(() => null);

  results.push(await probe('P4', () => testP4_deletedShared410(testBase)));
  results.push(await probe('P5', () => testP5_expiredShared410(testBase)));
  results.push(await probe('P6', () => testP6_globalAliasUniqueness(testBase)));
  results.push(await probe('P7', () => testP7_migrationCorrectness(testBase)));
  results.push(await probe('P8', () => testP8_apiKeyPath(testBase)));
  results.push(await probe('P9', () => testP9_analytics(testBase)));

  results.push(await probe('U-perc', () => testU_perc(testBase)));
  results.push(await probe('U-H1', () => testU_H1(testBase)));
  results.push(await probe('U-H2', () => testU_H2(testBase, phase1SeedCode)));
  results.push(await probe('U-H3', () => testU_H3(testBase)));
  results.push(await probe('U-H4', () => testU_H4_apiKeyInherits(testBase)));
  results.push(await probe('U-H5', () => testU_H5_hitsEqualsClicks(testBase)));
  results.push(await probe('U-H6', () => testU_H6_utcDailyBuckets(testBase)));
  results.push(await probe('U-H7', () => testU_H7_malformedAnalyticsParams(testBase)));
  results.push(await probe('U-H8', () => testU_H8_concurrencyRace(testBase)));

  return results;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const [, , appDirArg, phaseArg, outArg] = process.argv;
  const result = { app: appDirArg || null, phase: phaseArg || null, passed: 0, total: 0, probes: [] };

  if (!appDirArg || !phaseArg || !outArg || !['phase1', 'phase2'].includes(phaseArg)) {
    result.error = 'usage: node grade.mjs <app-dir> <phase1|phase2> <out.json>';
    if (outArg) {
      try { fs.writeFileSync(outArg, JSON.stringify(result, null, 2)); } catch { /* best effort */ }
    }
    console.log(`[grade] usage error: ${result.error}`);
    process.exit(0);
    return;
  }

  const appDir = path.resolve(process.cwd(), appDirArg);
  const outPath = path.resolve(process.cwd(), outArg);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planoff02a-grade-'));

  let testApp = null;
  let prodApp = null;

  try {
    const portTest = await getFreePort();
    const portProd = await getFreePort();
    const dbTest = path.join(tmpRoot, 'test.db');
    const dbProd = path.join(tmpRoot, 'prod.db');

    testApp = await spawnApp({ appDir, port: portTest, appEnv: 'test', dbPath: dbTest });
    prodApp = await spawnApp({ appDir, port: portProd, appEnv: 'production', dbPath: dbProd });

    const respawnTestApp = async () => {
      await killApp(testApp);
      testApp = await spawnApp({ appDir, port: portTest, appEnv: 'test', dbPath: dbTest });
      return testApp;
    };

    let probes;
    if (phaseArg === 'phase1') {
      probes = await runPhase1Suite({ testApp, prodApp, respawnTestApp });
    } else {
      // Phase 2 grading assumes a Phase-1 seed code MAY be supplied via env for the migration
      // trap (U-H2); a generic grader run without one fails that specific probe gracefully.
      const phase1SeedCode = process.env.PHASE1_SEED_CODE || null;
      probes = await runPhase2Suite({ testApp, prodApp, respawnTestApp, phase1SeedCode });
    }

    result.probes = probes;
    result.total = probes.length;
    result.passed = probes.filter((p) => p.pass).length;
  } catch (err) {
    result.error = `grader-level failure (not a probe failure): ${err && err.message ? err.message : String(err)}`;
  } finally {
    await killApp(testApp);
    await killApp(prodApp);
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best effort cleanup */ }
  }

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
  } catch { /* already exists or unnecessary */ }
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  const failedIds = result.probes.filter((p) => !p.pass).map((p) => p.id);
  console.log(
    `[grade] ${result.app} ${result.phase}: ${result.passed}/${result.total} passed` +
    (failedIds.length ? `; failed=[${failedIds.join(',')}]` : '') +
    (result.error ? `; ERROR: ${result.error}` : '')
  );

  process.exit(0);
}

main().catch((err) => {
  // absolute last resort — should be unreachable given the try/catch in main(), but the spec
  // demands the process itself never exits non-zero.
  console.log(`[grade] fatal (uncaught by main): ${err && err.message ? err.message : String(err)}`);
  process.exit(0);
});
