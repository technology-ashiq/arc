// cdp.mjs -- a dependency-free Chrome DevTools Protocol client for the face's browser harness.
//
// Why it exists (ADR-1335): the v0.7 smoke script used Node's global `WebSocket`, which Node 18
// does not have and Node 20 hides behind --experimental-websocket, and it hardcoded one Windows
// Chrome path. CI runs Node 20 on macOS and Windows, so this file carries its own RFC 6455
// client (text frames, client masking, fragmentation, ping/pong, close) over node:http, and
// looks Chrome up per OS. It imports only node builtins and ./proc.mjs, so tests/face/cdp-client.mjs
// can exercise every decision here with no install and no browser.
//
// This is a library: it has no main().
import { request } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { spawnTracked, isDead, deathReason } from "./proc.mjs";
import { existsSync, readFileSync, statSync } from "node:fs";
import { EventEmitter } from "node:events";
import { join, posix, win32 } from "node:path";

export const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PAYLOAD = 64 * 1024 * 1024;

export class ProtocolError extends Error {}

/** The Sec-WebSocket-Accept value a server must return for a given client key. */
export function acceptKey(key) {
  return createHash("sha1").update(key + WS_GUID).digest("base64");
}

/**
 * One WebSocket frame. Clients MUST mask (RFC 6455 5.3); a server frame is unmasked.
 * @param {Buffer|string} payload
 * @param {{ opcode?: number, mask?: boolean, maskKey?: Buffer, fin?: boolean }} [opts]
 */
export function encodeFrame(payload, { opcode = 1, mask = true, maskKey, fin = true } = {}) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = (fin ? 0x80 : 0) | (opcode & 0x0f);
  if (!mask) return Buffer.concat([header, data]);
  header[1] |= 0x80;
  const key = maskKey ?? randomBytes(4);
  if (!Buffer.isBuffer(key) || key.length !== 4) throw new ProtocolError("mask key must be 4 bytes");
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = data[i] ^ key[i & 3];
  return Buffer.concat([header, key, masked]);
}

/** Streaming decoder: push raw socket chunks, get back only COMPLETE frames. */
export class FrameDecoder {
  constructor({ maxPayload = MAX_PAYLOAD } = {}) {
    this.buf = Buffer.alloc(0);
    this.max = maxPayload;
  }

  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : Buffer.from(chunk);
    const frames = [];
    for (;;) {
      if (this.buf.length < 2) break;
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      if (b0 & 0x70) throw new ProtocolError("reserved bits set without a negotiated extension");
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) break;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) break;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(this.max)) throw new ProtocolError(`frame of ${big} bytes exceeds ${this.max}`);
        len = Number(big);
        off = 10;
      }
      if (len > this.max) throw new ProtocolError(`frame of ${len} bytes exceeds ${this.max}`);
      if (opcode >= 0x8 && (!fin || len > 125)) throw new ProtocolError("control frame fragmented or over 125 bytes");
      if (![0x0, 0x1, 0x2, 0x8, 0x9, 0xa].includes(opcode)) throw new ProtocolError(`unknown opcode ${opcode}`);
      const maskLen = masked ? 4 : 0;
      const total = off + maskLen + len;
      if (this.buf.length < total) break;
      let payload;
      if (masked) {
        const key = this.buf.subarray(off, off + 4);
        payload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) payload[i] = this.buf[off + 4 + i] ^ key[i & 3];
      } else {
        payload = Buffer.from(this.buf.subarray(off, total));
      }
      frames.push({ fin, opcode, masked, payload });
      this.buf = this.buf.subarray(total);
    }
    return frames;
  }
}

/** A connected client socket: emits 'message' (string), 'close' ({ code, reason, error }). */
export class WsClient extends EventEmitter {
  constructor(socket, head) {
    super();
    this.socket = socket;
    this.decoder = new FrameDecoder();
    this.parts = null;
    this.closed = false;
    socket.setNoDelay(true);
    socket.on("data", (chunk) => this._onData(chunk));
    socket.on("error", (error) => this._finish({ code: 1006, reason: "socket error", error }));
    socket.on("close", () => this._finish({ code: 1006, reason: "socket closed" }));
    if (head && head.length) this._onData(head);
  }

  send(text) {
    if (this.closed) throw new ProtocolError("socket is closed");
    this.socket.write(encodeFrame(text, { opcode: 0x1 }));
  }

  close(code = 1000) {
    if (this.closed) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code, 0);
    try { this.socket.write(encodeFrame(body, { opcode: 0x8 })); } catch { /* already gone */ }
    this.socket.end();
    this._finish({ code, reason: "client close" });
  }

  _onData(chunk) {
    let frames;
    try {
      frames = this.decoder.push(chunk);
    } catch (error) {
      this._finish({ code: 1002, reason: error.message, error });
      this.socket.destroy();
      return;
    }
    for (const f of frames) {
      if (f.opcode === 0x9) {
        try { this.socket.write(encodeFrame(f.payload, { opcode: 0xa })); } catch { /* closing */ }
      } else if (f.opcode === 0xa) {
        // unsolicited pong: ignored
      } else if (f.opcode === 0x8) {
        const code = f.payload.length >= 2 ? f.payload.readUInt16BE(0) : 1005;
        try { this.socket.write(encodeFrame(f.payload.subarray(0, 2), { opcode: 0x8 })); } catch { /* gone */ }
        this.socket.end();
        this._finish({ code, reason: f.payload.subarray(2).toString("utf8") });
      } else if (f.opcode === 0x0) {
        if (!this.parts) { this._protocol("continuation frame with no message in progress"); return; }
        this.parts.push(f.payload);
        if (f.fin) this._emitMessage();
      } else {
        if (this.parts) { this._protocol("new data frame inside a fragmented message"); return; }
        this.parts = [f.payload];
        this.opcode = f.opcode;
        if (f.fin) this._emitMessage();
      }
    }
  }

  _emitMessage() {
    const data = Buffer.concat(this.parts);
    this.parts = null;
    this.emit("message", this.opcode === 0x1 ? data.toString("utf8") : data);
  }

  _protocol(reason) {
    this._finish({ code: 1002, reason, error: new ProtocolError(reason) });
    this.socket.destroy();
  }

  _finish(info) {
    if (this.closed) return;
    this.closed = true;
    this.emit("close", info);
  }
}

/**
 * Open a ws:// URL. Rejects on a non-101 answer and on a wrong Sec-WebSocket-Accept, because a
 * socket that did not complete the handshake is not a WebSocket, whatever it later sends.
 */
export function openSocket(url, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { reject(new ProtocolError(`not a URL: ${url}`)); return; }
    if (u.protocol !== "ws:") { reject(new ProtocolError(`only ws:// is supported, got ${u.protocol}`)); return; }
    const key = randomBytes(16).toString("base64");
    const req = request({
      host: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key,
      },
    });
    const timer = setTimeout(() => { req.destroy(); reject(new ProtocolError(`handshake timed out after ${timeoutMs} ms`)); }, timeoutMs);
    req.on("upgrade", (res, socket, head) => {
      clearTimeout(timer);
      if (res.headers["sec-websocket-accept"] !== acceptKey(key)) {
        socket.destroy();
        reject(new ProtocolError("handshake answered with the wrong Sec-WebSocket-Accept"));
        return;
      }
      resolve(new WsClient(socket, head));
    });
    req.on("response", (res) => {
      clearTimeout(timer);
      res.resume();
      reject(new ProtocolError(`handshake refused: HTTP ${res.statusCode}`));
    });
    req.on("error", (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

/** JSON-RPC over the socket, with flat per-target sessions. */
export class CdpSession {
  constructor(ws, { callTimeoutMs = 30000 } = {}) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.malformed = 0;
    this.callTimeoutMs = callTimeoutMs;
    this.closed = false;
    ws.on("message", (m) => this._onMessage(m));
    ws.on("close", (info) => {
      this.closed = true;
      const why = info && info.error ? info.error.message : `socket closed (${info ? info.code : "?"})`;
      for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(`CDP ${p.method}: ${why}`)); }
      this.pending.clear();
    });
  }

  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error(`CDP ${method}: session is closed`));
    const id = ++this.nextId;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out after ${this.callTimeoutMs} ms`));
      }, this.callTimeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      try { this.ws.send(JSON.stringify(msg)); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  close() { this.ws.close(); }

  _onMessage(text) {
    let m;
    try { m = JSON.parse(text); } catch { this.malformed++; return; }
    if (m === null || typeof m !== "object") { this.malformed++; return; }
    if (typeof m.id === "number") {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      clearTimeout(p.timer);
      if (m.error) p.reject(new Error(`CDP ${p.method}: ${m.error.message ?? JSON.stringify(m.error)}`));
      else p.resolve(m.result ?? {});
      return;
    }
    if (typeof m.method === "string") {
      for (const h of this.handlers.get(m.method) ?? []) h(m.params ?? {}, m.sessionId);
    }
  }
}

/** A path Chrome can be RUN from: a regular file. A directory "exists" and crashes spawn. */
export function isRegularFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

// The path rules of the platform being asked about, not of the host running the lookup, so a
// linux lookup tested on the windows runner still splits PATH on ":" and joins with "/".
const pathFor = (platform) => (platform === "win32" ? win32 : posix);

function scanPath(names, env, exists, platform) {
  const P = pathFor(platform);
  const found = [];
  for (const dir of String(env.PATH ?? "").split(P.delimiter)) {
    if (!dir) continue;
    for (const n of names) found.push(P.join(dir, n));
  }
  return found.filter((p) => exists(p));
}

function regAppPaths() {
  const out = [];
  for (const hive of ["HKLM", "HKCU"]) {
    try {
      const text = execFileSync("reg", ["query", `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`, "/ve"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000, windowsHide: true });
      const m = text.match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m);
      if (m) out.push(m[1].replace(/^"|"$/g, ""));
    } catch { /* key absent */ }
  }
  return out;
}

/**
 * Find Chrome. Every place looked is returned in `tried`, so a miss names where it looked
 * instead of saying "not found" (ADR-1335). CHROME_BIN is used when set, never relied on.
 */
export function findChrome({ env = process.env, platform = process.platform, exists = isRegularFile, regQuery = regAppPaths } = {}) {
  const P = pathFor(platform);
  const join = P.join;
  const tried = [];
  const pick = (source, candidates) => {
    for (const p of candidates) {
      if (!p) continue;
      tried.push(`${source}: ${p}`);
      if (exists(p)) return { path: p, source, tried };
    }
    return null;
  };
  if (env.CHROME_BIN) {
    const hit = pick("CHROME_BIN", [env.CHROME_BIN]);
    if (hit) return hit;
  } else {
    tried.push("CHROME_BIN: (not set)");
  }
  let hit = null;
  if (platform === "win32") {
    let reg = [];
    try { reg = regQuery(); } catch { reg = []; }
    if (reg.length === 0) tried.push("registry App Paths\\chrome.exe: (no value)");
    hit = pick("registry", reg)
      || pick("ProgramFiles", [
        env.ProgramFiles && join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
        env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
        env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      ]);
  } else if (platform === "darwin") {
    hit = pick("Applications", [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      env.HOME && join(env.HOME, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    ]);
  } else {
    const onPath = scanPath(["google-chrome", "google-chrome-stable"], env, exists, platform);
    if (onPath.length === 0) tried.push("PATH: google-chrome, google-chrome-stable (none)");
    hit = pick("PATH", onPath) || pick("default", ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"]);
  }
  return hit ?? { path: null, source: null, tried };
}

/** Headless flags. Port 0 lets Chrome pick a free port and write it to DevToolsActivePort. */
export function chromeArgs({ userDataDir, platform = process.platform, width = 1440, height = 1000 }) {
  return [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},${height}`,
    "--no-first-run",
    "--no-default-browser-check",
    // Software WebGL on every OS: the face renders three.js, and a macOS runner has no GPU to
    // give headless Chrome (CI 2026-09-17: "Could not create a WebGL context").
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-extensions",
    "--disable-breakpad",
    "--disable-crash-reporter",
    ...(platform === "linux" ? ["--no-sandbox"] : []),
    "about:blank",
  ];
}

/** Parse Chrome's DevToolsActivePort file: line 1 the port, line 2 the browser target path. */
export function parseDevToolsActivePort(text) {
  const [portLine, pathLine] = String(text).split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!pathLine || !pathLine.startsWith("/devtools/browser/")) return null;
  return { port, path: pathLine.trim() };
}

export function launchChrome(chromePath, args) {
  // Its own process group on POSIX, stderr captured, a spawn error recorded instead of thrown:
  // proc.mjs holds the lifecycle rules every harness child follows.
  return spawnTracked(chromePath, args);
}

/** Wait until Chrome has written its DevTools port, or has exited, or the cap passes. */
export async function waitForDevTools(userDataDir, child, { timeoutMs = 30000, pollMs = 100 } = {}) {
  const file = join(userDataDir, "DevToolsActivePort");
  const started = Date.now();
  let unparsed = null;
  while (Date.now() - started < timeoutMs) {
    if (child.spawnError) throw new Error(`Chrome could not start: ${child.spawnError.message}`);
    if (isDead(child)) throw new Error(`Chrome ${deathReason(child)} before DevTools was ready: ${child.stderrTail().slice(-500)}`);
    if (existsSync(file)) {
      const text = readFileSync(file, "utf8");
      const parsed = parseDevToolsActivePort(text);
      if (parsed) return `ws://127.0.0.1:${parsed.port}${parsed.path}`;
      unparsed = text;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  // Absent and unreadable are different results (fixed-defects.md).
  if (unparsed !== null) throw new Error(`Chrome's DevToolsActivePort did not parse within ${timeoutMs} ms: ${JSON.stringify(unparsed.slice(0, 200))}`);
  throw new Error(`Chrome wrote no DevToolsActivePort within ${timeoutMs} ms: ${child.stderrTail().trim().slice(-500)}`);
}

/** A page target attached with a flat session; `on` only sees this page's events. */
export async function openPage(session) {
  const { targetId } = await session.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await session.send("Target.attachToTarget", { targetId, flatten: true });
  return {
    targetId,
    sessionId,
    send: (method, params) => session.send(method, params, sessionId),
    on: (method, handler) => session.on(method, (params, sid) => { if (sid === sessionId) handler(params); }),
  };
}
