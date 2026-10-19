// Sets slot states on a fixture board so an apply --all fixture can start mid-walk (ADR-1767). Writes through the
// real saveState, so the file stays a schema-1 state that loadState accepts. Refuses (exit 1) on an unknown state
// file or a malformed pair -- a setter that silently wrote nothing would leave every walk fixture starting from zero.
//   node tests/launch/walk-state.mjs STATE_DIR SLUG slot=state [slot=state ...]
import { loadState, saveState, setSlot } from "../../.claude/scripts/launch/lib/state.mjs";

const [dir, slug, ...pairs] = process.argv.slice(2);
const state = loadState(dir, slug);
if (!state) { console.error(`walk-state: no board for ${slug} in ${dir}`); process.exit(1); }
if (!pairs.length) { console.error("walk-state: no slot=state pair given"); process.exit(1); }
for (const p of pairs) {
  const m = /^([a-z0-9-]+)=([a-z-]+)$/.exec(p);
  if (!m) { console.error(`walk-state: ${p} is not slot=state`); process.exit(1); }
  setSlot(state, m[1], { state: m[2] });
}
saveState(dir, state);
console.log(`walk-state: set ${pairs.length}`);
