#!/usr/bin/env bash
# ci-install-tools.sh -- the tools the ubuntu CI jobs need (ci ADR-2201): bats, jq, gitleaks, opengrep.
# The Linux branch of the old ci.yml install steps, moved verbatim. Scanners stay best-effort, as
# before: a scanner-dependent test skips VISIBLY when its tool did not install, so a download hiccup
# is never a red build -- and the banner says which ones are missing.
set -u
mkdir -p "$HOME/bin"

npm install -g bats
sudo apt-get update && sudo apt-get install -y jq

VER=8.30.1
curl -fsSL -o gl.tgz "https://github.com/gitleaks/gitleaks/releases/download/v${VER}/gitleaks_${VER}_linux_x64.tar.gz" \
  && tar -xzf gl.tgz -C "$HOME/bin" gitleaks || echo "gitleaks install skipped"
rm -f gl.tgz

# PINNED, not `latest`. On 2026-08-12 an unpinned opengrep release stopped flagging the planted eval()
# three arc-scan tests depend on, and every branch went red at once. Moving this pin is a reviewed
# diff that re-runs the arc-scan suite, never a bump.
base=https://github.com/opengrep/opengrep/releases/download/v1.26.0
curl -fsSL -o "$HOME/bin/opengrep" "$base/opengrep_manylinux_x86" \
  && chmod +x "$HOME/bin/opengrep" || echo "opengrep install skipped"

[ -n "${GITHUB_PATH:-}" ] && echo "$HOME/bin" >> "$GITHUB_PATH"
export PATH="$HOME/bin:$PATH"
echo "jq:       $(command -v jq       || echo MISSING)"
echo "bats:     $(command -v bats     || echo MISSING)"
echo "gitleaks: $(command -v gitleaks || echo MISSING)"
echo "opengrep: $(command -v opengrep || echo MISSING)"
