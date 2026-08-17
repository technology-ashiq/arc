#!/bin/sh
# Phase 06 fixtures 1, 4, 6, 7 -- probed against the CONTAINER boundary directly, with no model
# call. The runtime runs entirely inside this image (ADR-0208 option 1), so what the container can
# reach IS what the runtime can reach.
echo "=== F1: can the container see the arc repo or any host path? ==="
for p in /host /c /mnt /workspace /repo; do
  if [ -e "$p" ]; then echo "  VISIBLE: $p -> $(ls "$p" 2>/dev/null | head -1)"; fi
done
echo "  bind mounts present:"
grep -E "/opt/data" /proc/mounts 2>/dev/null | head -2 | sed "s/^/    /"
echo "  any OTHER bind mount from the host:"
grep -cE "^(/dev/|//|[a-zA-Z]:)" /proc/mounts 2>/dev/null

echo "=== F1b: write inside the mount (expected: allowed, it is the workspace) ==="
if touch /opt/data/.f1probe 2>/dev/null; then echo "  wrote /opt/data/.f1probe"; rm -f /opt/data/.f1probe; else echo "  refused"; fi

echo "=== F6: escape the mount by traversal ==="
if touch /opt/data/../escape.txt 2>/dev/null; then
  echo "  WROTE via traversal -- resolved to $(ls -la /escape.txt 2>/dev/null | head -1)"
  echo "  is it on the HOST side of the mount? checking /opt/data:"
  ls /opt/data/escape.txt 2>/dev/null && echo "    (inside the mount)" || echo "    NOT inside the mount -- it landed in the container layer only"
  rm -f /escape.txt
else
  echo "  refused"
fi

echo "=== F6b: symlink escape out of the mount ==="
ln -sf / /opt/data/.rootlink 2>/dev/null
if [ -e /opt/data/.rootlink/etc/passwd ]; then echo "  symlink RESOLVES to container root (expected: it is the same filesystem)"; fi
rm -f /opt/data/.rootlink

echo "=== F4: env audit -- arc secrets inside the runtime? ==="
n=$(env | grep -icE "ARC_|RESEND|STRIPE|SUPABASE|GITHUB_PAT|SENTRY|JUROR" || true)
echo "  arc-shaped env vars present: $n   (0 is the requirement)"
echo "  the runtime's own vars:"
env | grep -oE "^HERMES_[A-Z_]+" | sort | head -10 | sed "s/^/    /"

echo "=== F7: egress -- can the container reach an arbitrary host? ==="
if command -v curl >/dev/null 2>&1; then
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 https://example.com 2>/dev/null || echo "FAILED")
  echo "  curl https://example.com -> $code"
  code2=$(curl -s -o /dev/null -w "%{http_code}" -m 8 https://openrouter.ai/api/v1/models 2>/dev/null || echo "FAILED")
  echo "  curl https://openrouter.ai   -> $code2"
else
  echo "  no curl in image"
fi

echo "=== identity ==="
id
