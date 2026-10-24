#!/usr/bin/env bash
# ci-install-tools.sh -- the tools the ubuntu CI jobs need (ci ADR-2201): bats, jq, gitleaks, opengrep.
# The Linux branch of the old ci.yml install steps. Scanners stay best-effort, as before: a
# scanner-dependent test skips VISIBLY when its tool did not install, so a download hiccup is never a
# red build, and the `security` job refuses to run without them. A binary whose sha256 is not the
# pinned one is NEVER installed (attack L13): presence must mean the binary we reviewed.
set -u
mkdir -p "$HOME/bin"

npm install -g bats
sudo apt-get update && sudo apt-get install -y jq

# $1 url, $2 pinned sha256, $3 output path. Prints why and returns 1 on a failed download or mismatch.
fetch_pinned() {
  curl -fsSL -o "$3" "$1" || { echo "download failed: $1"; return 1; }
  got="$(sha256sum "$3" | cut -d' ' -f1)"
  [ "$got" = "$2" ] || { echo "::error::sha256 mismatch for $1 (got $got)"; rm -f "$3"; return 1; }
}

# Published digests, checked against gitleaks_8.30.1_checksums.txt and the opengrep release API (2026-10-24).
VER=8.30.1
fetch_pinned "https://github.com/gitleaks/gitleaks/releases/download/v${VER}/gitleaks_${VER}_linux_x64.tar.gz" \
  551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb gl.tgz \
  && tar -xzf gl.tgz -C "$HOME/bin" gitleaks || echo "gitleaks install skipped"
rm -f gl.tgz

# PINNED, not `latest`. On 2026-08-12 an unpinned opengrep release stopped flagging the planted eval()
# three arc-scan tests depend on, and every branch went red at once. Moving this pin is a reviewed
# diff that re-runs the arc-scan suite, never a bump.
fetch_pinned "https://github.com/opengrep/opengrep/releases/download/v1.26.0/opengrep_manylinux_x86" \
  40c21299eeddabf743b856daa843d24f9d4a027130671cd45b3b21776fd9ab26 "$HOME/bin/opengrep" \
  && chmod +x "$HOME/bin/opengrep" || echo "opengrep install skipped"

[ -n "${GITHUB_PATH:-}" ] && echo "$HOME/bin" >> "$GITHUB_PATH"
export PATH="$HOME/bin:$PATH"
echo "jq:       $(command -v jq       || echo MISSING)"
echo "bats:     $(command -v bats     || echo MISSING)"
echo "gitleaks: $(command -v gitleaks || echo MISSING)"
echo "opengrep: $(command -v opengrep || echo MISSING)"
