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
#   existence     a registry lookup was RECORDED, naming this name at this version
#   allowlist     the name was decided in advance, not discovered live
#   version       pinned exactly -- a range is not a pin, and for a skill a pin is a git SHA
#   hash          an integrity string read from the underlying package registry
#   provenance    TWO fields, recorded separately: who may publish, and which CI built it
#   content-scan  the FETCHED source, scanned for exfiltration and curl-pipe-sh
#   human-ok      required whenever the source is write-capable, or cannot be read at all
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
# skills have no scope field at all. So write-capability is COMPUTED from the source, and
# silence means yes: a compiled binary or an opaque layer is write-capable because it cannot be
# shown to be anything else.
#
# It never uses popularity. Stars, downloads and repo age measure adoption, and adoption is
# what a supply-chain attack manufactures. They may be displayed by the scout as context; they
# can never be a pass criterion, and this script does not read them.
#
# Existence-verification does NOT defeat slopsquatting -- the attacker registers a real package
# under the hallucinated name, so the check passes by design. The ALLOWLIST is that control.
#
# Usage:
#   capability-vet.sh --candidate <dir> --allowlist <file> --lock <file> [--name <n>]
#   capability-vet.sh --audit --lock <file> [--max-age <days>]
#
# Exit: 0 PASS · 1 one or more BLOCKs · 2 bad arguments.

set -u

STALE_DAYS=30

die() { printf 'capability-vet: %s\n' "$1" >&2; exit 2; }

CANDIDATE=""; ALLOWLIST=""; LOCK=""; AUDIT=0; MAX_AGE="$STALE_DAYS"
while [ $# -gt 0 ]; do
  case "$1" in
    --candidate) CANDIDATE="${2:-}"; shift 2 || die "--candidate needs a value" ;;
    --allowlist) ALLOWLIST="${2:-}"; shift 2 || die "--allowlist needs a value" ;;
    --lock)      LOCK="${2:-}";      shift 2 || die "--lock needs a value" ;;
    --max-age)   MAX_AGE="${2:-}";   shift 2 || die "--max-age needs a value" ;;
    --audit)     AUDIT=1; shift ;;
    -h|--help)   sed -n '2,44p' "$0"; exit 0 ;;
    *)           die "unknown argument '$1'" ;;
  esac
done

# ---------------------------------------------------------------------------
# JSON is read through node, which every other arc script already requires. A shell-side JSON
# parser would be a second grammar to attack, and this file's whole job is to be attacked.
# ---------------------------------------------------------------------------
jget() {  # jget <file> <key>   -- prints the value or nothing
  node -e '
    const fs = require("node:fs");
    try {
      const o = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const v = o[process.argv[2]];
      if (v === undefined || v === null) process.exit(0);
      process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
    } catch { process.exit(0); }
  ' "$1" "$2" 2>/dev/null
}

today() { date -u +%Y-%m-%d; }

# ---------------------------------------------------------------------------
# --audit: report lock rows nobody has re-checked
# ---------------------------------------------------------------------------
if [ "$AUDIT" -eq 1 ]; then
  [ -n "$LOCK" ] || die "--audit needs --lock"
  [ -f "$LOCK" ] || die "no lock file at $LOCK"
  node -e '
    const fs = require("node:fs");
    const lock = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const maxAge = Number(process.argv[2]);
    const rows = lock.capabilities || [];
    const now = Date.now();
    let stale = 0;
    for (const r of rows) {
      const t = Date.parse(r.checked + "T00:00:00Z");
      // A row with an unreadable date is STALE, not fresh: a date nobody can parse is a date
      // nobody has checked, and defaulting it to fresh would hide exactly the rotten rows.
      const days = Number.isNaN(t) ? Infinity : Math.floor((now - t) / 86400000);
      if (days > maxAge) {
        stale++;
        console.log(`stale  ${r.name}@${r.version} — last checked ${r.checked} (${days === Infinity ? "unparseable date" : days + " days ago"}, limit ${maxAge})`);
      }
    }
    console.log(`${rows.length} capability row(s), ${stale} stale.`);
  ' "$LOCK" "$MAX_AGE"
  exit 0
fi

[ -n "$CANDIDATE" ] || die "need --candidate <dir>"
[ -n "$LOCK" ]      || die "need --lock <file>"
[ -d "$CANDIDATE" ] || die "no candidate directory at $CANDIDATE"

MANIFEST="$CANDIDATE/candidate.json"
[ -f "$MANIFEST" ] || die "no candidate.json in $CANDIDATE"

NAME="$(jget "$MANIFEST" name)"
REGISTRY="$(jget "$MANIFEST" registry)"
VERSION="$(jget "$MANIFEST" version)"
HASH="$(jget "$MANIFEST" hash)"
PUB="$(jget "$MANIFEST" 'publisher-auth')"
BUILD="$(jget "$MANIFEST" 'build-attestation')"
RECORD="$(jget "$MANIFEST" 'registry-record')"
HUMAN_OK="$(jget "$MANIFEST" 'human-ok')"

BLOCKS=0
REFUSED_ON=""
WHY=""
block() {  # block <check> <what> <expected> <found>
  BLOCKS=$((BLOCKS + 1))
  REFUSED_ON="${REFUSED_ON:+$REFUSED_ON, }$1"
  [ -n "$WHY" ] || WHY="$2"
  printf 'BLOCK [%s] %s\n' "$1" "$2"
  printf '  Expected: %s\n' "$3"
  printf '  Found:    %s\n' "$4"
}

# ---------------------------------------------------------------------------
# 1. existence -- FIRST, and on its own. A name that resolves to nothing must be refused
#    before five other opinions are printed, or the report reads as though the thing exists
#    and merely fails a policy.
# ---------------------------------------------------------------------------
REC_PATH=""
[ -n "$RECORD" ] && REC_PATH="$CANDIDATE/$RECORD"
if [ -z "$RECORD" ] || [ ! -s "$REC_PATH" ]; then
  block existence \
    "no recorded registry lookup for '${NAME:-(unnamed)}'" \
    "a non-empty registry response saved beside the candidate, named by \`registry-record\`" \
    "${RECORD:-(no registry-record field)}"
  printf '\n%s\n' "Refused at the existence check. Nothing else was evaluated."
  printf '%s\n' "Note: existence does NOT defeat slopsquatting — an attacker registers a real"
  printf '%s\n' "package under the hallucinated name. The allowlist is that control."
  exit 1
fi
if ! grep -q -- "$NAME" "$REC_PATH" 2>/dev/null; then
  block existence \
    "the recorded registry response does not name '$NAME'" \
    "a registry record naming the candidate" \
    "$(head -c 120 "$REC_PATH" 2>/dev/null)"
  printf '\n%s\n' "Refused at the existence check. Nothing else was evaluated."
  exit 1
fi
# Whether the record OFFERS the pinned version is a question about the pin, not about
# existence — a range fails it, and reporting that as "this does not exist" would send you
# looking for the wrong problem. It is checked with the version below.

# ---------------------------------------------------------------------------
# 2. allowlist -- decided in advance. This is the control that defeats slopsquatting.
# ---------------------------------------------------------------------------
if [ -z "$ALLOWLIST" ] || [ ! -f "$ALLOWLIST" ]; then
  block allowlist \
    "no allowlist file to check '$NAME' against" \
    "a readable allowlist naming what may be admitted" \
    "${ALLOWLIST:-(none given)}"
elif ! grep -qxF -- "$NAME" "$ALLOWLIST"; then
  # An EMPTY allowlist refuses everything, and that is the correct default rather than a
  # misconfiguration: nothing may be admitted until someone names what may be.
  block allowlist \
    "'$NAME' is not on the allowlist" \
    "a name decided in advance, one per line in $ALLOWLIST" \
    "$(wc -l < "$ALLOWLIST" | tr -d ' ') allowed name(s), none of them '$NAME'"
fi

# ---------------------------------------------------------------------------
# 3. version -- pinned exactly. A skill publishes no version, so its pin is a git commit SHA.
# ---------------------------------------------------------------------------
case "$REGISTRY" in
  skill|git)
    if ! printf '%s' "$VERSION" | grep -qE '^[0-9a-f]{40}$'; then
      block version \
        "a $REGISTRY candidate is pinned by commit SHA, and '$VERSION' is not one" \
        "40 hex characters — skills publish no version or hash in their format" \
        "${VERSION:-(absent)}"
    fi
    ;;
  *)
    if ! printf '%s' "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'; then
      block version \
        "version '${VERSION:-(absent)}' is not an exact pin" \
        "an exact version such as 1.2.3 — a range, a tag or \`latest\` moves under you" \
        "${VERSION:-(absent)}"
    elif ! grep -q -- "$VERSION" "$REC_PATH" 2>/dev/null; then
      block version \
        "the recorded registry response does not offer version '$VERSION'" \
        "the pinned version present in the registry record" \
        "$(head -c 120 "$REC_PATH" 2>/dev/null)"
    fi
    ;;
esac

# ---------------------------------------------------------------------------
# 4. hash -- an integrity string from the UNDERLYING package registry. server.json carries a
#    hash only for MCPB packages, so a gate trusting it alone would pass unhashed code.
# ---------------------------------------------------------------------------
if ! printf '%s' "$HASH" | grep -qE '^sha(256|512)-[A-Za-z0-9+/=]{16,}$'; then
  block hash \
    "no usable integrity hash for $NAME@$VERSION" \
    "npm dist.integrity, PyPI digests.sha256 or an OCI digest — \`sha512-…\` or \`sha256-…\`" \
    "${HASH:-(absent)}"
fi

# ---------------------------------------------------------------------------
# 5. provenance -- TWO fields, never collapsed. They answer different questions: who may
#    publish under this name, and which CI built this artifact. Most packages have only the
#    first, so `build-attestation: none published` is a legitimate RECORDED answer; its
#    ABSENCE is not.
# ---------------------------------------------------------------------------
if [ -z "$PUB" ]; then
  block provenance \
    "no \`publisher-auth\` recorded" \
    "who may publish under this name — registry namespace authentication, and when it was checked" \
    "(absent)"
fi
if [ -z "$BUILD" ]; then
  block provenance \
    "no \`build-attestation\` recorded" \
    "which CI built this artifact — or the words \`none published\`, recorded as its own field" \
    "(absent)"
fi

# ---------------------------------------------------------------------------
# 6. content scan -- over the FETCHED source. A pattern list is a floor, not an analyser;
#    ADR-0110's revisit trigger is a candidate that passes it and is still hostile.
# ---------------------------------------------------------------------------
SRC="$CANDIDATE/src"

# ONE recursive grep per pattern, never a grep per file.
#
# Two bugs live in the history of these six lines and both are worth keeping written down.
# The list of readable files was first a newline-joined STRING read back with `while read`,
# and a string with no trailing newline drops its last line — with one source file that is
# every file, so the scan found nothing and `exfil`, `curl-pipe-sh` and `self-report-lies` all
# came back PASS: a gate reporting a clean scan it had never performed.
#
# The fix after that was correct and unusably slow. A real candidate is ~140 files, and a
# `grep` per file per pattern is ~560 process spawns; on Windows, where spawn cost dominates
# everything, the first REAL vetting run exceeded two minutes and was killed. A gate nobody
# will wait for is a gate that gets skipped.
#
# `-I` skips binaries, which is what makes "nothing readable here" a real signal rather than
# an empty result: a compiled artifact produces no matches and no file list, and the verdict
# below treats that as write-capable rather than clean.
# Hits are reported relative to the candidate, never as the absolute path they were scanned
# at. The lock file is committed, and a record naming `/tmp/tmp.G1CRiWGxrK/...` is a record of
# one machine's afternoon rather than of the candidate.
scan() {  # scan <regex> -- prints the first matching path:line, or nothing
  [ -d "$SRC" ] || return 0
  LC_ALL=C grep -rInE -- "$1" "$SRC" 2>/dev/null | head -1 | sed "s|^$CANDIDATE/||"
}

READABLE=""
[ -d "$SRC" ] && READABLE="$(LC_ALL=C grep -rIl . "$SRC" 2>/dev/null | head -1)"

PIPE_SH='(curl|wget|iwr|Invoke-WebRequest)[^|;&]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|d|)sh|iex[[:space:]]*\('
EXFIL='(process\.env|os\.environ|ENV\[)[^;]*(fetch|axios|request|urlopen|requests\.(post|put)|http\.request|net\.connect)|(fetch|axios\.post|requests\.post|urlopen)[^;]*(process\.env|os\.environ|SECRET|TOKEN|API_?KEY|PASSWORD)'

HIT_PIPE="$(scan "$PIPE_SH")"
HIT_EXFIL="$(scan "$EXFIL")"
if [ -n "$HIT_PIPE" ]; then
  block content-scan \
    "the fetched source pipes a download into a shell" \
    "no \`curl … | sh\` — code fetched at run time is code nothing vetted" \
    "$HIT_PIPE"
fi
if [ -n "$HIT_EXFIL" ]; then
  block content-scan \
    "the fetched source sends environment or secret material outbound" \
    "no exfiltration pattern" \
    "$HIT_EXFIL"
fi

# ---------------------------------------------------------------------------
# 7. write-capability -- COMPUTED, and silence means yes.
# ---------------------------------------------------------------------------
WRITES='(writeFile|appendFile|createWriteStream|mkdir|rmdir|unlink|rimraf|fs\.rm|copyFile|renameSync|open\([^)]*["'"'"']w)|child_process|spawn\(|execSync|execFile|\bexec\(|subprocess\.|os\.system|shutil\.|Popen\(|>[[:space:]]*/'
HIT_WRITE="$(scan "$WRITES")"

# An install-time lifecycle hook is arbitrary code that runs on install, before anything has
# looked at it. THIS script never runs it — but classing a package that ships one as read-only
# would be describing the tarball and not the thing that happens when someone uses it.
HOOK=""
if [ -f "$CANDIDATE/package.json" ]; then
  HOOK="$(node -e '
    const fs = require("node:fs");
    try {
      const s = (JSON.parse(fs.readFileSync(process.argv[1], "utf8")).scripts) || {};
      const hooks = ["preinstall", "install", "postinstall", "prepare", "prepublish"];
      const found = hooks.filter((h) => s[h]);
      if (found.length) process.stdout.write(found.join(", "));
    } catch { /* an unreadable manifest is handled by the scan verdict below */ }
  ' "$CANDIDATE/package.json" 2>/dev/null)"
fi

WRITE_CAPABLE=0; WHY=""
if [ -z "$READABLE" ]; then
  WRITE_CAPABLE=1
  WHY="its source could not be read — an inconclusive scan is write-capable, never clean"
elif [ -n "$HIT_WRITE" ]; then
  WRITE_CAPABLE=1
  WHY="its source writes, spawns or deletes: $HIT_WRITE"
fi
if [ -n "$HOOK" ]; then
  WRITE_CAPABLE=1
  WHY="${WHY:+$WHY; }it ships install-time lifecycle script(s): $HOOK"
fi

# The candidate's own claim is REPORTED and never believed. MCP's spec: ToolAnnotations are
# hints, "not guaranteed to provide a faithful description of tool behavior".
DECLARED_RO="$(jget "$MANIFEST" 'declared-read-only')"
if [ "$DECLARED_RO" = "true" ] && [ "$WRITE_CAPABLE" -eq 1 ]; then
  printf 'NOTE  the candidate declares itself read-only; the scan disagrees and the scan wins.\n'
fi

if [ "$WRITE_CAPABLE" -eq 1 ]; then
  if ! printf '%s' "$HUMAN_OK" | grep -qE '^[A-Za-z][A-Za-z0-9_-]*[[:space:]]+[0-9]{4}-[0-9]{2}-[0-9]{2}'; then
    block human-ok \
      "$NAME is write-capable and carries no recorded human OK — $WHY" \
      "\`human-ok: <name> <YYYY-MM-DD>\` in candidate.json, recorded by the person who agreed" \
      "${HUMAN_OK:-(absent)}"
  fi
fi

# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------
if [ "$BLOCKS" -gt 0 ]; then
  # A refusal is a DECISION, and a decision that only ever existed on a terminal is the
  # failure mode this whole repository keeps rediscovering. So the lock file records it —
  # under `refusals`, never under `capabilities`. Nothing is admitted by this branch: the
  # record exists so the same candidate is not proposed again blind, and so the facts that
  # WERE established (a verified hash, a recorded publisher) are not thrown away with it.
  node -e '
    const fs = require("node:fs");
    const [lockPath, name, registry, version, hash, pub, build, checked, refusedOn, why] = process.argv.slice(1);
    let lock = { capabilities: [] };
    try { lock = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch { /* a new lock file */ }
    if (!Array.isArray(lock.capabilities)) lock.capabilities = [];
    if (!Array.isArray(lock.refusals)) lock.refusals = [];
    lock.capabilities = lock.capabilities.filter((c) => c.name !== name);   // never admitted
    const row = { name, registry, version, hash: hash || null, "publisher-auth": pub || null,
                  "build-attestation": build || null, checked, "refused-on": refusedOn, why };
    const i = lock.refusals.findIndex((c) => c.name === name);
    if (i >= 0) lock.refusals[i] = row; else lock.refusals.push(row);
    lock.refusals.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  ' "$LOCK" "$NAME" "$REGISTRY" "$VERSION" "$HASH" "$PUB" "$BUILD" "$(today)" "$REFUSED_ON" "$WHY" 2>/dev/null

  printf '\n%s\n' "$BLOCKS condition(s) refused $NAME@$VERSION. It was NOT admitted."
  printf '%s\n' "The refusal is recorded in $LOCK so the same candidate is not proposed again blind."
  exit 1
fi

CLASS="read-only"
[ "$WRITE_CAPABLE" -eq 1 ] && CLASS="write-capable (human OK recorded: $HUMAN_OK)"

node -e '
  const fs = require("node:fs");
  const [lockPath, name, registry, version, hash, pub, build, checked, src, cls] = process.argv.slice(1);
  let lock = { capabilities: [] };
  try { lock = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch { /* a new lock file */ }
  if (!Array.isArray(lock.capabilities)) lock.capabilities = [];
  const row = { name, registry, version, hash, "publisher-auth": pub, "build-attestation": build, checked, source: src, class: cls };
  const i = lock.capabilities.findIndex((c) => c.name === name);
  if (i >= 0) lock.capabilities[i] = row; else lock.capabilities.push(row);
  lock.capabilities.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
' "$LOCK" "$NAME" "$REGISTRY" "$VERSION" "$HASH" "$PUB" "$BUILD" "$(today)" "$CANDIDATE" "$CLASS"

printf 'PASS  %s@%s — %s\n' "$NAME" "$VERSION" "$CLASS"
printf '  hash:        %s\n' "$HASH"
printf '  publisher:   %s\n' "$PUB"
printf '  build:       %s\n' "$BUILD"
printf '  recorded in: %s\n' "$LOCK"
printf '\n%s\n' "Vetted is not installed. This wrote a lock row and no dependency (ADR-0110)."
exit 0
