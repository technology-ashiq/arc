#!/usr/bin/env bash
set -euo pipefail

# Run one shard of the bats suite. Usage: shard.sh <1..3|lint>
TOTAL=3
SELECTOR="${1:-}"

if [ "$SELECTOR" = "lint" ]; then
  exec npm run lint
fi

INDEX=$((SELECTOR))
if [ "$INDEX" -lt 1 ] || [ "$INDEX" -gt "$TOTAL" ]; then
  echo "shard out of range: $SELECTOR" >&2
  exit 2
fi

mapfile -t FILES < <(git ls-files "tests/*.bats" | sort)
PICK=()
for i in "${!FILES[@]}"; do
  if [ $(( i % TOTAL + 1 )) -eq "$INDEX" ]; then
    PICK+=("${FILES[$i]}")
  fi
done

echo "shard $INDEX/$TOTAL: ${#PICK[@]} of ${#FILES[@]} files"
exec bats "${PICK[@]}"
