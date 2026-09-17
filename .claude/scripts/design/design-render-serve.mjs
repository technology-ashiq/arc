#!/usr/bin/env node
// design-render-serve.mjs -- the loopback server an explore render is confined to (ADR-1418).
//
// design-render.sh used to open an explore page as file://, and a file:// page loads any file on
// disk. The fifth adversarial pass had a composer frame its sibling from its OWN page: every tool
// boundary allowed it, and the sibling's pixels landed in the one render the composer may read.
//
// So an explore page is served from its variant directory and nothing else, under a policy sent
// as a header, which the page cannot loosen. The browser's origin model does the refusing; this
// file does not try to enumerate leak shapes. What it does is RECORD every request that did not
// resolve to a file inside the root, and every blocked-load report the browser posts back.
// design-render.sh refuses the capture when that record is not empty.
//
//   node design-render-serve.mjs --root <variant dir> --dir <private dir> --max-seconds <1..3600>
//
// Writes <dir>/record (created empty at start, one line per event:
//   kind <TAB> method <TAB> detail, kind one of missing|outside|malformed|method|violation|lifetime|error)
// and then <dir>/port, whole, once listening.
// Exit: 0 stopped by a signal | 1 bad invocation or cannot listen | 3 lifetime cap reached.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const USAGE = 'usage: design-render-serve.mjs --root <dir> --dir <dir> --max-seconds <1..3600>';

function fail(msg) {
  process.stderr.write(`design-render-serve: ${msg}\n`);
  process.exit(1);
}

// Echoed values are capped: a 20KB argument used to come back as 20KB of stderr (lane defect #14).
const cap = (s, n = 200) => String(s).replace(/[\x00-\x1f\x7f]/g, '?').slice(0, n);

const argv = process.argv.slice(2);
const args = new Map();
for (let i = 0; i < argv.length; i += 2) {
  const flag = argv[i];
  if (flag !== '--root' && flag !== '--dir' && flag !== '--max-seconds') fail(`unknown argument '${cap(flag, 80)}'. ${USAGE}`);
  if (i + 1 >= argv.length) fail(`${flag} needs a value`);
  // Two values for one flag is an operator error, never last-wins (lane defect #13).
  if (args.has(flag)) fail(`${flag} given twice`);
  args.set(flag, argv[i + 1]);
}
for (const flag of ['--root', '--dir', '--max-seconds']) {
  if (!args.has(flag)) fail(`${flag} is required. ${USAGE}`);
}

const maxRaw = args.get('--max-seconds');
if (!/^[1-9][0-9]{0,3}$/.test(maxRaw) || Number(maxRaw) > 3600) {
  fail(`--max-seconds takes a whole number from 1 to 3600, got '${cap(maxRaw, 20)}'`);
}
const MAX_SECONDS = Number(maxRaw);

function realDir(flag) {
  let real;
  try {
    real = fs.realpathSync.native(args.get(flag));
  } catch {
    fail(`${flag} '${cap(args.get(flag))}' does not exist`);
  }
  if (!fs.statSync(real).isDirectory()) fail(`${flag} '${cap(args.get(flag))}' is not a directory`);
  return real;
}
const ROOT = realDir('--root');
const DIR = realDir('--dir');

// Both sides are realpath'd the same way, so a symlink, a junction or an 8.3 short name compares
// as the directory it really is.
const ROOT_PREFIX = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
const inside = (real) => real === ROOT || real.startsWith(ROOT_PREFIX);

// The record lives outside what is served, or the page could read the evidence against it.
if (inside(DIR)) fail('--dir must not be inside --root: the server would serve its own record');

const RECORD = path.join(DIR, 'record');
try {
  fs.writeFileSync(RECORD, '');
} catch (e) {
  fail(`cannot create the record in --dir: ${cap(e.message)}`);
}
// A record that cannot be appended loses detection, not prevention: the request was already
// answered 404 or blocked. The renderer refuses when the record file is missing altogether.
function record(kind, method, detail) {
  try {
    fs.appendFileSync(RECORD, `${kind}\t${cap(method, 16)}\t${cap(detail, 300)}\n`);
  } catch {
    /* see above */
  }
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src 'self'",
  "child-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  // No allow-popups: a popup takes the browser's focus, and the capture would be of that page.
  'sandbox allow-scripts allow-same-origin',
  'report-uri /__arc/csp-report',
].join('; ');

const headers = (extra = {}) => ({
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  ...extra,
});

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

// Decides what a request path names. The raw path is checked BEFORE decoding and the decoded one
// after, and decoding happens exactly once: `%252e%252e` is a directory literally named `%2e%2e`,
// which does not exist, never a second traversal.
function resolve(rawUrl) {
  const cut = rawUrl.search(/[?#]/);
  const raw = cut === -1 ? rawUrl : rawUrl.slice(0, cut);
  if (!raw.startsWith('/')) return { kind: 'malformed' };
  if (raw.includes('\\') || raw.split('/').some((s) => s === '..' || s === '.')) return { kind: 'outside' };
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: 'malformed' };
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return { kind: 'outside' };
  const segs = decoded.split('/').slice(1);
  if (segs.some((s) => s === '..' || s === '.')) return { kind: 'outside' };
  // A colon is a drive letter or an NTFS stream on Windows; no page of ours needs one.
  if (segs.some((s) => s.includes(':'))) return { kind: 'malformed' };
  if (segs.some((s) => s === '')) return { kind: decoded === '/favicon.ico' ? 'favicon' : 'missing' };
  let real;
  try {
    real = fs.realpathSync.native(path.join(ROOT, ...segs));
  } catch {
    return { kind: decoded === '/favicon.ico' ? 'favicon' : 'missing' };
  }
  if (!inside(real)) return { kind: 'outside' };
  let st;
  try {
    st = fs.statSync(real);
  } catch {
    return { kind: 'missing' };
  }
  if (!st.isFile()) return { kind: 'missing' };
  return { kind: 'file', file: real };
}

function summariseReport(body) {
  try {
    const parsed = JSON.parse(body);
    const items = Array.isArray(parsed) ? parsed.map((r) => r && r.body) : [parsed && parsed['csp-report']];
    const parts = items.filter(Boolean).map((r) => {
      const blocked = r['blocked-uri'] ?? r.blockedURL ?? '?';
      const directive = r['violated-directive'] ?? r.effectiveDirective ?? '?';
      return `${directive} ${blocked}`;
    });
    if (parts.length) return parts.join(' | ');
  } catch {
    /* recorded raw below */
  }
  return body.length ? body : '(empty report)';
}

const REPORT_LIMIT = 16 * 1024;

const server = http.createServer((req, res) => {
  const method = req.method || '';
  const rawUrl = req.url || '';

  if (method === 'POST' && rawUrl === '/__arc/csp-report') {
    let body = '';
    let over = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (over) return;
      body += chunk;
      if (body.length > REPORT_LIMIT) {
        over = true;
        body = body.slice(0, REPORT_LIMIT);
      }
    });
    // Recorded on end AND on an aborted body: a report that never finished is still a report.
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      record('violation', method, summariseReport(body));
      if (!res.headersSent) {
        res.writeHead(204, headers());
        res.end();
      }
    };
    req.on('end', finish);
    req.on('error', finish);
    req.on('aborted', finish);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    record('method', method, rawUrl);
    res.writeHead(405, headers({ Allow: 'GET, HEAD' }));
    res.end();
    return;
  }

  const verdict = resolve(rawUrl);
  // A browser asks for /favicon.ico on its own; that is not the page reaching out.
  if (verdict.kind === 'favicon') {
    res.writeHead(204, headers());
    res.end();
    return;
  }
  if (verdict.kind !== 'file') {
    record(verdict.kind, method, rawUrl);
    res.writeHead(404, headers({ 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end(method === 'HEAD' ? undefined : 'not found\n');
    return;
  }

  const type = TYPES[path.extname(verdict.file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, headers({ 'Content-Type': type }));
  if (method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(verdict.file);
  stream.on('error', (e) => {
    record('error', method, `${rawUrl} ${e.code || e.message}`);
    res.destroy();
  });
  stream.pipe(res);
});

// A malformed request line is the page (or something else) speaking non-HTTP to the origin. A
// reset or broken pipe is the browser closing a kept-alive socket, which every render ends with.
server.on('clientError', (err, socket) => {
  if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') record('malformed', '-', err.code || err.message);
  socket.destroy();
});

server.on('error', (e) => {
  record('error', '-', e.code || e.message);
  fail(`cannot listen on 127.0.0.1: ${cap(e.message)}`);
});

// The backstop for a renderer that was killed before it could stop this: nothing outlives the cap,
// so no CI job waits on a forgotten server.
setTimeout(() => {
  record('lifetime', '-', `the ${MAX_SECONDS}s cap was reached`);
  process.exit(3);
}, MAX_SECONDS * 1000);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const tmp = path.join(DIR, 'port.tmp');
  try {
    fs.writeFileSync(tmp, String(port));
    fs.renameSync(tmp, path.join(DIR, 'port'));
  } catch (e) {
    fail(`cannot write the port file: ${cap(e.message)}`);
  }
});
