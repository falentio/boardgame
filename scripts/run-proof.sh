#!/usr/bin/env bash
# Detached proof runner. Boots nothing itself; just runs the UI proof and logs.
#
# All worktrees symlink one node_modules, so node_modules/.vite is a single
# shared Vite dep-optimizer cache. Two dev servers writing it at once corrupt
# the cache and the page never hydrates. Serialize every proof on one lock.
set -u
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/proof.log}"
PORT="${2:-3000}"
LOCK="${TMPDIR:-/tmp}/proof-ui.lock"
{
  echo "=== run start $(date -Is) port=$PORT ==="
  flock "$LOCK" node scripts/proof-ui.mjs --port "$PORT"
  echo "EXIT=$?"
  echo "=== run end $(date -Is) ==="
} >> "$LOG" 2>&1
