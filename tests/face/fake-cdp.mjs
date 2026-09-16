// fake-cdp.mjs -- a scripted CDP endpoint for tests/face/cdp-client.mjs. It speaks the server
// side of RFC 6455 over node:http so face/scripts/cdp.mjs can be proven with no Chrome and no
// install. It is deliberately a SEPARATE implementation of the frame format from the client's
// (masking checked here, unmasked frames written here), so a symmetric bug in cdp.mjs's codec
// cannot pass both ends at once.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function serverFrame(payload, opcode = 0x1, fin = true) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8");
  const len = data.length;
  let head;
  if (len < 126) head = Buffer.from([(fin ? 0x80 : 0) | opcode, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = (fin ? 0x80 : 0) | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = (fin ? 0x80 : 0) | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, data]);
}

/**
 * @param {{ onMessage?: (msg, api) => void, acceptOverride?: string, refuseStatus?: number }} script
 * @returns {Promise<{ url: string, port: number, received: object[], unmaskedFrames: number, pongs: Buffer[], api: object, close: () => Promise<void> }>}
 */
export async function startFakeCdp(script = {}) {
  const state = { received: [], unmaskedFrames: 0, pongs: [], sockets: new Set() };
  const server = createServer((req, res) => {
    if (script.refuseStatus) { res.writeHead(script.refuseStatus); res.end("refused"); return; }
    res.writeHead(404); res.end();
  });
  server.on("upgrade", (req, socket) => {
    if (script.refuseStatus) {
      socket.end(`HTTP/1.1 ${script.refuseStatus} Refused\r\nContent-Length: 0\r\n\r\n`);
      return;
    }
    const key = req.headers["sec-websocket-key"];
    const accept = script.acceptOverride ?? createHash("sha1").update(key + GUID).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    state.sockets.add(socket);
    let buf = Buffer.alloc(0);
    const api = {
      reply: (obj) => socket.write(serverFrame(JSON.stringify(obj))),
      raw: (bytes) => socket.write(bytes),
      frame: serverFrame,
      ping: (data) => socket.write(serverFrame(Buffer.from(data), 0x9)),
      closeWith: (code) => { const b = Buffer.alloc(2); b.writeUInt16BE(code, 0); socket.write(serverFrame(b, 0x8)); },
      drop: () => socket.destroy(),
    };
    state.api = api;
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const opcode = buf[0] & 0x0f;
        const masked = (buf[1] & 0x80) !== 0;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const need = off + (masked ? 4 : 0) + len;
        if (buf.length < need) return;
        let payload = buf.subarray(off + (masked ? 4 : 0), need);
        if (masked) {
          const k = buf.subarray(off, off + 4);
          payload = Buffer.from(payload.map((b, i) => b ^ k[i % 4]));
        } else {
          state.unmaskedFrames++;
        }
        buf = buf.subarray(need);
        if (opcode === 0xa) { state.pongs.push(Buffer.from(payload)); continue; }
        if (opcode === 0x8) { socket.end(); continue; }
        if (opcode !== 0x1) continue;
        let msg;
        try { msg = JSON.parse(payload.toString("utf8")); } catch { continue; }
        state.received.push(msg);
        if (script.onMessage) script.onMessage(msg, api);
      }
    });
    socket.on("error", () => {});
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return {
    url: `ws://127.0.0.1:${port}/devtools/browser/fake`,
    port,
    get received() { return state.received; },
    get unmaskedFrames() { return state.unmaskedFrames; },
    get pongs() { return state.pongs; },
    get api() { return state.api; },
    close: () => new Promise((r) => { for (const s of state.sockets) s.destroy(); server.close(() => r()); }),
  };
}
