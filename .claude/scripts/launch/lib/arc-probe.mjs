// arc's own organs, asked by a wiring slot's adapter through ctx.probe.arc (ADR-1751). The worker builds one of these
// per run; each answer is read fresh from arc's tree or spine, never from the venture's state, and is plain data.
//   ledger    the venture's revenue events on the spine (the "first ingest receipt")
//   passport  `venture-register --dry-run` for the venture's kill lines: exit code and digest line
//   face      where the face contract seats the venture: the ventures room, a planned room, or nowhere
//   teardown  the ordered exit rendered from the board, with every recorded resource id
//   harnesses        arc's own install doctor on the venture's working tree: counts and the harnesses placed (ADR-1763)
//   harness-install  `bin/arc.mjs init --dir <venture root>`, every harness, never --force; its exit and last line
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadCatalog } from "./catalog.mjs";
import { loadState } from "./state.mjs";
import { teardownPlan } from "./board.mjs";
import { scanAll, spineRoot } from "../../hq/spine.mjs";
import { Refused, doctor, targetDir } from "../../engine/install-targets/common.mjs";

const VENTURE_REGISTER = join(ROOT, ".claude", "scripts", "hq", "venture-register.mjs");
const ARC_CLI = join(ROOT, "bin", "arc.mjs");
const CONTRACT = join(ROOT, "initiatives", "face", "contracts", "expected-set.json");
const refusal = (code, message) => Object.assign(new Error(message), { code });

// The venture root is the runner's --venture-root, never a value from the venture's own files.
function ventureDir(root) {
  if (typeof root !== "string" || root === "" || root.startsWith("-")) throw refusal("NO_VENTURE_ROOT", "the runner gave no venture root");
  return root;
}

export function makeArcProbe({ venture, profile, catalog, stateDir, root = null }) {
  return async function arcProbe(question) {
    if (question === "harnesses") {
      try {
        const d = doctor(targetDir(ventureDir(root)));
        const head = String(d.lines[0] || "");
        const m = head.match(/^doctor: (\S+) install/);
        return { installed: true, counts: { ...d.counts }, targets: m ? m[1].split("+").filter(Boolean).sort() : [], summary: String(d.lines[d.lines.length - 1] || "") };
      } catch (e) {
        if (!(e instanceof Refused)) throw e;
        return { installed: false, reason: e.reason, summary: `doctor: ${e.message}` };
      }
    }
    if (question === "harness-install") {
      const r = spawnSync(process.execPath, [ARC_CLI, "init", "--dir", ventureDir(root)],
        { cwd: ROOT, encoding: "utf8", timeout: 240000, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
      const lines = `${r.stdout || ""}\n${r.stderr || ""}`.split("\n").map((l) => l.trim()).filter(Boolean);
      return { exit: r.status, conflicts: lines.filter((l) => l.startsWith("unmanaged-conflict ")).length, last: lines.slice(-1)[0] || null };
    }
    if (question === "ledger") {
      const { events, torn, unreadable } = scanAll(spineRoot());
      if (torn.length || unreadable.length) throw refusal("SPINE_UNREADABLE", "the spine has a torn or unreadable day");
      const mine = events.map((r) => r.event).filter((e) => e && (e.kind === "revenue.simulated" || e.kind === "revenue.received") && e.venture === venture);
      return { count: mine.length, first: mine.length ? mine[0].id : null, kinds: [...new Set(mine.map((e) => e.kind))].sort() };
    }
    if (question === "passport") {
      const k = profile.kill_lines || {};
      const days = Number(k.days_without_revenue), floor = Number(k.traffic_floor_monthly);
      if (!Number.isSafeInteger(days) || !Number.isSafeInteger(floor) || typeof profile.repository !== "string")
        throw refusal("PROFILE_INCOMPLETE", "the venture profile has no kill_lines (days_without_revenue, traffic_floor_monthly) and repository");
      // owner/name only: a value starting "--" would reach venture-register as a flag, not a repository (attack 143525f B8).
      if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(profile.repository) || profile.repository.startsWith("-"))
        throw refusal("PROFILE_INCOMPLETE", "the venture profile's repository is not owner/name");
      const r = spawnSync(process.execPath, [VENTURE_REGISTER, "--slug", venture, "--days-without-revenue", String(days), "--traffic-floor", String(floor),
        "--repository", profile.repository, "--dry-run"], { cwd: ROOT, encoding: "utf8", timeout: 120000, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
      // A refusal is printed on stderr: both streams, so its reason reaches the slot.
      const lines = `${r.stdout || ""}\n${r.stderr || ""}`.split("\n").map((l) => l.trim()).filter(Boolean);
      return { exit: r.status, digest: lines.find((l) => /digest/i.test(l)) || null, last: lines.slice(-1)[0] || null };
    }
    if (question === "face") {
      const c = JSON.parse(readFileSync(CONTRACT, "utf8"));
      const room = c.ventures && c.ventures.map ? c.ventures.map[venture] : undefined;
      const planned = c.plannedRooms && c.plannedRooms.map ? c.plannedRooms.map[venture] : undefined;
      return { room: typeof room === "string" ? room : null, planned: typeof planned === "string" ? planned : null };
    }
    if (question === "teardown") {
      const state = loadState(stateDir, venture);
      if (!state) throw refusal("NO_BOARD", `no board for ${venture}`);
      const lines = teardownPlan(loadCatalog(catalog), state, profile);
      return { lines, resources: lines.filter((l) => /^ {3}4\.\d+ /.test(l)).length };
    }
    throw refusal("ARC_PROBE_UNKNOWN", `arc answers ledger, passport, face, teardown, harnesses or harness-install, not ${question}`);
  };
}
