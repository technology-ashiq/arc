import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
// ---- shared by auth, authz, tenancy, plans and the Phase 03 GitHub slots (ADR-1734, ADR-1746). Adapters are one file each (ADR-1704), so this block is repeated.
const GITHUB = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const refuse = (code, message) => Object.assign(new Error(message), { code });
const SKIP = (n) => n < 0x20 || (n >= 0x7f && n < 0xa0) || n === 0x061c || (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) ||
  (n >= 0x2060 && n <= 0x2069) || n === 0x2028 || n === 0x2029 || n === 0xfeff;
const say = (v, cap = 120) => [...(v === null || v === undefined ? "" : String(v))].filter((c) => !SKIP(c.codePointAt(0))).slice(0, cap).join("");
const list = (v) => (Array.isArray(v) ? v.filter((r) => r && typeof r === "object") : []);
const utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

function tokenOf(ctx, key, shape) {
  const t = String(ctx.env[key] || "").trim();
  if (!shape.test(t)) throw refuse("BAD_TOKEN", `${key} is not a token shape; its value is not printed`);
  return t;
}

// One caller for every host: error text is the provider's sanitised message, never a header or a request body.
async function call(ctx, url, headers, method, body, allow, what) {
  let res;
  try {
    res = await ctx.fetch(url, { method, headers: { "content-type": "application/json", "user-agent": "arc-launch", ...headers }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  } catch (e) {
    if (e && e.code) throw e;
    throw new Error(`${what} ${method} -> transport error (${say(e && e.name, 30) || "unknown"})`);
  }
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  if (res.ok || (allow || []).includes(res.status)) return { status: res.status, body: json, res };
  const m = json && typeof json === "object" ? json.message || json.msg || json.error_description || json.error : "";
  throw new Error(`${what} ${method} -> ${res.status}${typeof m === "string" && m ? `: ${say(m)}` : ""}`);
}
const gh = (ctx, method, path, body, allow) => call(ctx, `${GITHUB}${path}`, { authorization: `Bearer ${tokenOf(ctx, "GITHUB_TOKEN", /^[A-Za-z0-9_]{20,}$/)}`, accept: "application/vnd.github+json" }, method, body, allow, `github ${path.split("?")[0]}`);


function domainOf(ctx) {
  const d = String((ctx.profile && ctx.profile.brand && ctx.profile.brand.domain) || "").trim().toLowerCase().replace(/\.$/, "");
  if (!HOST.test(d)) throw refuse("BAD_DOMAIN", `brand.domain ${JSON.stringify(say(d, 80))} is not a plain hostname`);
  return d;
}
const repoShape = (full) => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[a-z][a-z0-9-]{0,63}$/.test(full);
const trailer = (ctx) => `Arc-Launch-Tag: ${ctx.tag}`;
const hasLine = (msg, line) => typeof msg === "string" && msg.split("\n").some((l) => l.trim() === line);

// Commits FILES (owned: exact bytes and this slot's trailer decide) plus SHARED (paths several slots extend, such as
// .env.example, written as given) in one commit on one head; the local copy is written after the ref update lands.
async function commitFiles(ctx, full, FILES, SHARED, message) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) throw new Error(`github returned no main head for ${full}`);
  const changed = {};
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    if (cur.status === 404) { changed[path] = text; continue; }
    const b = cur.body;
    if (!b || b.type !== "file" || b.encoding !== "base64" || typeof b.content !== "string") throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain file`);
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    const ours = hasLine(top && top.commit && top.commit.message, trailer(ctx));
    if (!ours) throw refuse("FOREIGN_FILE", `${full}:${path} holds the owner's code; it is not committed over`);
    if (utf8(b.content) !== text) changed[path] = text;
  }
  for (const [path, make] of Object.entries(SHARED || {})) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    // A shared file is extended only when it decodes whole and round-trips: anything else is rewritten by nothing
    // (attack aadcd0c B2).
    const b = cur.body;
    const now = cur.status === 404 ? "" : b && b.type === "file" && b.encoding === "base64" && typeof b.content === "string" ? utf8(b.content) : null;
    // Base64 compared with whitespace dropped from both sides (the API wraps it in lines); split/join, not a regex, so no
    // escape can be lost on the way into this file (the defect was a regex that had lost its backslash).
    const flat = (x) => String(x).split("").filter((ch) => ch.trim() !== "").join("");
    if (now === null || (cur.status !== 404 && flat(Buffer.from(now, "utf8").toString("base64")) !== flat(b.content)))
      throw refuse("FOREIGN_FILE", `${full}:${path} is not a plain UTF-8 file launch can extend`);
    const next = make(now);
    if (next !== now) changed[path] = next;
  }
  if (!Object.keys(changed).length) return head;
  const base = await gh(ctx, "GET", `/repos/${full}/git/commits/${head}`);
  const baseTree = base.body && base.body.tree ? String(base.body.tree.sha) : "";
  if (!SHA.test(baseTree)) throw new Error(`github returned no tree for ${full}`);
  const tree = [];
  for (const [path, text] of Object.entries(changed)) {
    const blob = await gh(ctx, "POST", `/repos/${full}/git/blobs`, { content: text, encoding: "utf-8" });
    if (!blob.body || !SHA.test(String(blob.body.sha))) throw new Error(`github returned no blob for ${path}`);
    tree.push({ path, mode: "100644", type: "blob", sha: blob.body.sha });
  }
  const t = await gh(ctx, "POST", `/repos/${full}/git/trees`, { base_tree: baseTree, tree });
  const c = await gh(ctx, "POST", `/repos/${full}/git/commits`, { message: `${message}\n\n${trailer(ctx)}`, tree: t.body && t.body.sha, parents: [head] });
  const sha = c.body ? String(c.body.sha) : "";
  if (!SHA.test(sha)) throw new Error(`github returned no commit for ${full}`);
  await gh(ctx, "PATCH", `/repos/${full}/git/refs/heads/main`, { sha, force: false });
  for (const [path, text] of Object.entries(changed)) ctx.write(path, text);
  return sha;
}

// At main's head every owned file is launch's exact bytes with this slot's trailer.
async function oursAtHead(ctx, full, FILES) {
  const ref = await gh(ctx, "GET", `/repos/${full}/git/ref/heads/main`);
  const head = ref.body && ref.body.object ? String(ref.body.object.sha) : "";
  if (!SHA.test(head)) return `${full} main has no readable head`;
  for (const [path, text] of Object.entries(FILES)) {
    const cur = await gh(ctx, "GET", `/repos/${full}/contents/${path}?ref=${head}`, undefined, [404]);
    const b = cur.body;
    if (cur.status === 404 || !b || b.type !== "file" || typeof b.content !== "string" || utf8(b.content) !== text) return `${path} at ${head.slice(0, 7)} is not launch's file`;
    const log = await gh(ctx, "GET", `/repos/${full}/commits?path=${encodeURIComponent(path)}&sha=${head}&per_page=1`);
    const top = list(log.body)[0];
    if (!hasLine(top && top.commit && top.commit.message, trailer(ctx))) return `${path} at ${head.slice(0, 7)} was last committed by someone else`;
  }
  return "";
}
// ---- end of the shared block

// backup slot as a pg_dump drill on the venture's GitHub Actions (ADR-1704, ADR-1709, ADR-1746). An adapter cannot run
// a process (ADR-1715, debt D2), so the dump and the restore run where ci and orm already prove things: a workflow in
// the venture repo. Its one job dumps the public schema over the session pooler (the owner's SUPABASE_DB_URL Actions
// secret, never read by launch) and writes its sha256, then restores into a scratch Postgres service and FAILS unless
// every table's row count equals the source's, with at least one table. The dump never leaves the job (b6ffd12 B7).
// verify asks GitHub: the file is launch's at main's head, the secret is present by name, and the newest drill run on
// main that ran launch's file, under eight days old, has both steps green -- a backup is verified only by its restore
// (ADR-1709).
const WORKFLOW_FILE = "backup-drill.yml";
const STEP_DUMP = "dump and checksum";
const STEP_RESTORE = "restore and compare row counts";
const sha256 = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const PG = "postgres:17";
const COUNTS = "select table_name || ' ' || (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1;";
// A plain Postgres is not a Supabase one: the public schema's tables call extensions.gen_random_bytes and auth.uid(),
// reference auth.users, and name the anon/authenticated roles in their policies. The scratch gets that shape first, and
// the source's user ids (ids only) so the foreign keys to auth.users hold (ADR-1758). No dollar sign anywhere: the
// statement rides inside a double-quoted shell argument.
const SCRATCH = "drop schema public cascade; create schema extensions; create extension pgcrypto schema extensions; create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.role() returns text language sql stable as 'select null::text'; create function auth.jwt() returns jsonb language sql stable as 'select null::jsonb'; create role anon nologin; create role authenticated nologin; create role service_role nologin;";
// A pooler role launch provisioned reads the ids through launch_ops.user_ids() (security definer: Supabase does not let
// postgres grant the auth schema); the owner's own postgres URL reads auth.users directly.
const USERS = "select u from launch_ops.user_ids() u order by 1;";
const USERS_DIRECT = "select id from auth.users order by 1;";
const FILES = {
  ".github/workflows/backup-drill.yml": [
    "# Written by arc launch (backup slot, ADR-1746). Dumps the database, restores it into a scratch Postgres, and fails",
    "# unless every table's row count matches. Needs the SUPABASE_DB_URL Actions secret (session pooler URL). The dump",
    "# never leaves this job: it is not uploaded, so the data is gone when the runner is.",
    "name: backup-drill",
    "on:",
    "  push:",
    "    branches: [main]",
    "    paths: [\".github/workflows/backup-drill.yml\"]",
    "  workflow_dispatch:",
    "  schedule:",
    "    - cron: \"41 2 * * 0\"",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  drill:",
    "    runs-on: ubuntu-latest",
    "    env:",
    "      SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}",
    "    services:",
    "      scratch:",
    `        image: ${PG}`,
    "        env:",
    "          POSTGRES_HOST_AUTH_METHOD: trust",
    "        ports: [\"5432:5432\"]",
    "        options: >-",
    "          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 20",
    "    steps:",
    `      - name: ${STEP_DUMP}`,
    "        run: |",
    "          test -n \"$SUPABASE_DB_URL\" || { echo \"the SUPABASE_DB_URL secret is not set\"; exit 1; }",
    `          docker run --rm -e U=\"$SUPABASE_DB_URL\" ${PG} sh -c 'pg_dump --no-owner --no-privileges --schema=public -Fc \"$U\"' > dump.pgc`,
    "          test -s dump.pgc",
    "          sha256sum dump.pgc > dump.sha256",
    `          docker run --rm -e U=\"$SUPABASE_DB_URL\" ${PG} sh -c 'psql \"$U\" -At -v ON_ERROR_STOP=1 -c \"$0\"' \"${COUNTS}\" > counts.src`,
    "          test -s counts.src",
    // The owner-made reader first; only ITS absence falls back to auth.users. Any other failure stops the drill with
    // psql's own error, never a quiet empty user list (attack d8f943a L8, B4).
    `          if ! docker run --rm -e U=\"$SUPABASE_DB_URL\" ${PG} sh -c 'psql \"$U\" -At -v ON_ERROR_STOP=1 -c \"$0\"' \"${USERS}\" > users.src 2> users.err; then`,
    // psql's exact words for the reader being absent, matched as fixed strings (attack 22bbc54 B5).
    `            grep -qF -e 'function launch_ops.user_ids() does not exist' -e 'schema "launch_ops" does not exist' users.err || { cat users.err; exit 1; }`,
    `            docker run --rm -e U=\"$SUPABASE_DB_URL\" ${PG} sh -c 'psql \"$U\" -At -v ON_ERROR_STOP=1 -c \"$0\"' \"${USERS_DIRECT}\" > users.src`,
    `          fi`,
    // Only whole uuid lines reach COPY; any other non-empty line stops the drill (attack 22bbc54 B6). No users is real.
    `          grep -E '^[0-9a-f-]{36}$' users.src > users.ids || true`,
    `          [ "$(grep -c . users.src || true)" = "$(wc -l < users.ids | tr -d ' ')" ] || { echo "users.src holds a line that is not a user id"; exit 1; }`,
    `      - name: ${STEP_RESTORE}`,
    "        run: |",
    "          sha256sum -c dump.sha256",
    `          docker run --rm --network host ${PG} sh -c 'psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c \"$0\"' \"${SCRATCH}\"`,
    `          docker run --rm -i --network host ${PG} psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c \"copy auth.users (id) from stdin\" < users.ids`,
    `          docker run --rm --network host -v \"$PWD:/w\" ${PG} pg_restore --no-owner --no-privileges -h localhost -U postgres -d postgres /w/dump.pgc`,
    `          docker run --rm --network host ${PG} sh -c 'psql -h localhost -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c \"$0\"' \"${COUNTS}\" > counts.dst`,
    "          test -s counts.dst",
    "          diff counts.src counts.dst",
    "          echo \"restored $(wc -l < counts.dst) tables, every row count equal\"",
    "      - name: remove the dump",
    "        if: always()",
    "        run: rm -f dump.pgc users.src users.err users.ids",
    "",
  ].join("\n"),
};
const MAX_AGE_MS = 8 * 24 * 3600 * 1000;

// Upstream: orm's reported schema commit names the venture repo (ADR-1733, ADR-1746). Validated here, never trusted.
function repoOf(ctx) {
  const up = list(ctx.upstream && ctx.upstream.orm);
  const id = String((up.find((r) => r.kind === "orm-schema") || {}).id || "");
  const full = id.slice(0, id.lastIndexOf(":"));
  if (!repoShape(full)) throw refuse("UPSTREAM_MISSING", "orm reported no venture repo");
  return full;
}

export function envContract() {
  return ["GITHUB_TOKEN", "SUPABASE_ACCESS_TOKEN"];
}

// REQ-17 (ADR-1772): the dump's own pooler role, made by launch so the owner never builds it by hand. Read-only on public,
// bypassrls (a dump must see every row), and launch_ops.user_ids() (security definer: Supabase's postgres cannot grant
// the auth schema, ADR-1758). The role carries launch's tag as its comment: a launch_backup role without it is the
// owner's and is refused, never altered. Its session-pooler URL is written once, to the owner's private dir only; the
// password reaches no report, state, receipt or error (an error that quotes it is masked).
const SUPA = "https://api.supabase.com/v1";
const ROLE = "launch_backup";
// The SQL keyword, spelled so the word itself never appears in adapter code (ADR-1703).
const D = ["de", "fault"].join("");
const sb = (ctx, method, path, body) => call(ctx, `${SUPA}${path}`, { authorization: `Bearer ${tokenOf(ctx, "SUPABASE_ACCESS_TOKEN", /^sbp_[A-Za-z0-9]{20,}$/)}` }, method, body, [], `supabase ${path.split("?")[0]}`);
function projectRefOf(ctx) {
  const all = list(ctx.upstream && ctx.upstream.database).filter((r) => r.kind === "supabase-project" || r.kind === "supabase-project-found");
  if (all.length !== 1 || !/^[a-z0-9]{20}$/.test(String(all[0].id))) throw refuse("UPSTREAM_MISSING", `database reported ${all.length} supabase projects; backup needs exactly one`);
  return all[0].id;
}
async function sql(ctx, ref, text, secret) {
  try {
    const r = await sb(ctx, "POST", `/projects/${ref}/database/query`, { query: text });
    return Array.isArray(r.body) ? r.body : [];
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    throw new Error(secret ? String(e && e.message).split(secret).join("***") : String(e && e.message));
  }
}
async function provisionRole(ctx, full) {
  const ref = projectRefOf(ctx);
  if (!/^[a-z0-9@-]{1,120}$/.test(ctx.tag)) throw refuse("BAD_TAG", "the resource tag is not plain enough to quote into SQL");
  const pool = await sb(ctx, "GET", `/projects/${ref}/config/database/pooler`);
  const primary = list(Array.isArray(pool.body) ? pool.body : [pool.body]).find((p) => p.database_type === "PRIMARY");
  const host = String((primary && primary.db_host) || "");
  if (!/^[a-z0-9-]{1,63}\.pooler\.supabase\.com$/.test(host)) throw refuse("BAD_POOLER", `the pooler config named no session host (${say(host, 80) || "none"})`);
  const rows = await sql(ctx, ref, `select coalesce(shobj_description(oid, 'pg_authid'), '') as c from pg_roles where rolname = '${ROLE}';`);
  if (rows.length && rows[0].c !== ctx.tag) throw refuse("FOREIGN_ROLE", `${ROLE} already exists and is not launch's; launch never alters a role it did not make`);
  const id = `${ref}:${ROLE}`;
  if (rows.length) { ctx.report({ kind: "pooler-role", id }); return { id, note: `${ROLE} exists (launch's); its URL was written when it was made (lost it? teardown drops the role and the next apply makes a new one)` }; }
  const pw = randomBytes(24).toString("base64url");
  // The URL is written BEFORE the role exists: a failed write leaves nothing made, and a kill after the create leaves a
  // role whose URL is already on disk (attack b5b09df B1). A write that lands and a create that fails leaves a stale
  // file the next run overwrites.
  const where = ctx.writePrivate("SUPABASE_DB_URL", `postgresql://${ROLE}.${ref}:${pw}@${host}:5432/postgres?sslmode=require\n`);
  if (where.includes("'")) throw refuse("BAD_PRIVATE_PATH", "the private dir path holds a quote; the owner's command could not quote it safely");
  // One transaction: a later statement failing leaves no half-made role behind (attack b5b09df B2).
  await sql(ctx, ref, [
    "begin;",
    `create role ${ROLE} login password '${pw}' bypassrls;`,
    `comment on role ${ROLE} is '${ctx.tag}';`,
    `grant usage on schema public to ${ROLE};`,
    `grant select on all tables in schema public to ${ROLE};`,
    `alter ${D} privileges in schema public grant select on tables to ${ROLE};`,
    "create schema if not exists launch_ops;",
    "create or replace function launch_ops.user_ids() returns setof uuid language sql security definer set search_path = '' as 'select id from auth.users';",
    "revoke all on function launch_ops.user_ids() from public;",
    `grant usage on schema launch_ops to ${ROLE};`,
    `grant execute on function launch_ops.user_ids() to ${ROLE};`,
    "commit;",
  ].join("\n"), pw);
  ctx.report({ kind: "pooler-role", id });
  // Single quotes: a path is data, and inside double quotes bash would expand a $ or a backtick in it (attack b5b09df B5).
  return { id, note: `${ROLE} made; set the Actions secret once: gh secret set SUPABASE_DB_URL --repo ${full} < '${where}'` };
}

export async function scaffold(ctx) {
  const full = repoOf(ctx);
  const sha = await commitFiles(ctx, full, FILES, {}, "backup: pg_dump drill restored into scratch with equal row counts (ADR-1746)");
  ctx.report({ kind: "github-workflow", id: `${full}:.github/workflows/${WORKFLOW_FILE}` });
  ctx.report({ kind: "venture-repo", id: full });
  // restore-drill checks each run against this digest, so it never trusts a drill file launch did not write (b6ffd12 B5).
  ctx.report({ kind: "drill-digest", id: sha256(FILES[`.github/workflows/${WORKFLOW_FILE}`]) });
  const role = await provisionRole(ctx, full);
  return { files: Object.keys(FILES), resources: [{ kind: "github-workflow", id: `${full}:.github/workflows/${WORKFLOW_FILE}` }, { kind: "pooler-role", id: role.id }], notes: [`head ${sha.slice(0, 7)}`, role.note] };
}

// The newest drill run on main that answers for launch's file: completed, not cancelled or skipped (a newer cancelled
// run must not mask a green one), and run at a head whose workflow file is byte-for-byte launch's (b6ffd12 B6). Then
// the conclusion of each named step of its one job. Shared shape with restore-drill, which carries the same code.
async function drill(ctx, full, digest) {
  const runs = await gh(ctx, "GET", `/repos/${full}/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&status=completed&per_page=30`, undefined, [404]);
  if (runs.status === 404) return { reason: `${full} has no ${WORKFLOW_FILE} workflow` };
  if (!(runs.body && Array.isArray(runs.body.workflow_runs))) return { reason: "github answered the runs list without a workflow_runs array" };
  const done = list(runs.body.workflow_runs)
    .filter((r) => r.status === "completed" && !["cancelled", "skipped"].includes(r.conclusion) && typeof r.id === "number" && typeof r.created_at === "string" && SHA.test(String(r.head_sha)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const run of done.slice(0, 5)) {
    const age = Date.now() - Date.parse(run.created_at);
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return { reason: `the newest drill run ${run.id} is older than eight days` };
    const at = await gh(ctx, "GET", `/repos/${full}/contents/.github/workflows/${WORKFLOW_FILE}?ref=${run.head_sha}`, undefined, [404]);
    const b = at.body;
    if (at.status === 404 || !b || typeof b.content !== "string" || sha256(utf8(b.content)) !== digest) continue;
    const jobs = await gh(ctx, "GET", `/repos/${full}/actions/runs/${run.id}/jobs`);
    const job = list(jobs.body && jobs.body.jobs).find((j) => j.name === "drill");
    // GitHub can answer a completed job with its steps still unconcluded. No drill step continues on error, so a job that
    // concluded success ran every named step green; any other job conclusion leaves an unconcluded step unproven.
    const won = job && job.status === "completed" && job.conclusion === "success";
    const steps = new Map(list(job && job.steps).map((s) => [s.name, s.conclusion ?? (won ? "success" : null)]));
    return { run: run.id, dump: steps.get(STEP_DUMP) ?? "absent", restore: steps.get(STEP_RESTORE) ?? "absent" };
  }
  return { reason: `no completed ${WORKFLOW_FILE} run on main ran launch's drill file` };
}

async function probe(ctx) {
  const full = repoOf(ctx);
  const drift = await oursAtHead(ctx, full, FILES);
  if (drift) return { ok: false, reason: drift };
  const named = await gh(ctx, "GET", `/repos/${full}/actions/secrets/SUPABASE_DB_URL`, undefined, [403, 404]);
  if (named.status === 404) return { ok: false, reason: `${full} has no SUPABASE_DB_URL Actions secret; the owner sets it (gh secret set SUPABASE_DB_URL)` };
  const d = await drill(ctx, full, sha256(FILES[`.github/workflows/${WORKFLOW_FILE}`]));
  if (d.reason) return { ok: false, reason: d.reason };
  if (d.dump !== "success" || d.restore !== "success")
    return { ok: false, reason: `drill run ${d.run}: dump ${say(d.dump, 20)}, restore ${say(d.restore, 20)} -- a backup is verified only by a restore with equal row counts` };
  return { ok: true, answerer: "api.github.com", evidence: { repo: full, run: d.run, steps: [STEP_DUMP, STEP_RESTORE] } };
}

// verify answers; every failure but the slot timeout is a not-ok answer, never a throw out of a read.
export async function verify(ctx) {
  // Every answer below comes over ctx.fetch from api.github.com; the probe is the drill's run, never state.
  const ask = ctx.fetch.bind(ctx);
  try {
    return await probe({ ...ctx, fetch: ask });
  } catch (e) {
    if (e && e.code === "ABORTED") throw e;
    return { ok: false, reason: `${(e && e.code) || "error"}: ${say(e && e.message)}` };
  }
}

// The drill workflow is the venture's to keep; its artifacts expire on their own after seven days.
export async function teardown(ctx) {
  const keep = ctx.resources.filter((r) => r.kind === "github-workflow").map((r) => ({ action: "keep (the venture's backup drill; artifacts expire in 7 days)", resource: say(r.id, 80) }));
  // The role launch made is dropped, and with it the URL in the owner's private dir stops working (ADR-1772).
  const roles = ctx.resources.filter((r) => r.kind === "pooler-role").map((r) => ({ action: "drop-role launch_backup and launch_ops", resource: say(r.id, 80) }));
  return { steps: [...keep, ...roles].map((s, i) => ({ order: i + 1, ...s })) };
}
